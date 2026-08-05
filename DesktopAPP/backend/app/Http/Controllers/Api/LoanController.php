<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Loan;
use App\Models\LoanPayment;
use App\Models\ActivityLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;
use App\Traits\RecordsTransactions;

class LoanController extends Controller
{
    protected $transactionService;

    public function __construct(\App\Services\TransactionService $transactionService)
    {
        $this->transactionService = $transactionService;
    }

    public function index(Request $request)
    {
        $user = $request->user();
        $query = Loan::with('customer', 'payments');
        if (! $user->hasFullAccess()) $query->where('shop_id', $user->shop_id);
        if ($request->status) $query->where('status', $request->status);

        return response()->json($query->latest()->get()->map(function ($loan) {
            $loan->total_paid  = $loan->totalPaid();
            $loan->remaining   = $loan->remaining();
            $loan->next_due    = $loan->payments()->where('status', 'pending')->orderBy('due_date')->first();
            return $loan;
        }));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'customer_id'   => 'required|exists:customers,id',
            'principal'     => 'required|numeric|min:1',
            'interest_rate' => 'required|numeric|min:0',
            'total_months'  => 'required|integer|min:1',
            'start_date'    => 'required|date',
            'notes'         => 'nullable|string',
            'interest_type' => 'in:simple,compound',
            'shop_id'       => 'nullable|integer',
            'payment_mode'  => 'nullable|string',
            'payment_lines' => 'nullable|array|min:2',
            'payment_lines.*.payment_mode' => 'required_with:payment_lines|string',
            'payment_lines.*.amount'       => 'required_with:payment_lines|numeric|min:0.01',
        ]);

        if (!\App\Services\TransactionService::paymentLinesSumMatches($data['payment_lines'] ?? null, (float) $data['principal'])) {
            return response()->json(['message' => 'Split payment lines must add up to the principal'], 422);
        }

        $user = $request->user();
        $shopId = ($user->hasFullAccess() && $request->shop_id) ? $request->shop_id : $user->shop_id;
        if (!$shopId) $shopId = \App\Models\Shop::first()?->id;

        DB::beginTransaction();
        try {
            $principal    = $data['principal'];
            $rate         = $data['interest_rate'] / 100;
            $months       = $data['total_months'];
            $interestType = $data['interest_type'] ?? 'simple';

            if ($interestType === 'compound') {
                $totalAmount = $principal * pow(1 + $rate, $months);
            } else {
                $totalAmount = $principal + ($principal * $rate * $months);
            }

            $monthlyInstallment = round($totalAmount / $months, 2);

            $loan = Loan::create([
                'shop_id'              => $shopId,
                'customer_id'          => $data['customer_id'],
                'principal'            => $principal,
                'interest_rate'        => $data['interest_rate'],
                'total_months'         => $months,
                'monthly_installment'  => $monthlyInstallment,
                'start_date'           => $data['start_date'],
                'notes'                => $data['notes'] ?? null,
            ]);

            // Generate payment schedule
            $startDate = Carbon::parse($data['start_date']);
            for ($i = 1; $i <= $months; $i++) {
                LoanPayment::create([
                    'shop_id'  => $shopId,
                    'loan_id'  => $loan->id,
                    'due_date' => $startDate->copy()->addMonths($i)->toDateString(),
                    'amount'   => $monthlyInstallment,
                ]);
            }

            // Record Transaction (Disbursement) using Service
            $this->transactionService->recordForModel($loan, [
                'type'             => 'OUT',
                'category'         => 'LOAN_DISBURSEMENT',
                'amount'           => $principal,
                'payment_mode'     => $data['payment_mode'] ?? 'CASH',
                'payment_lines'    => $data['payment_lines'] ?? null,
                'description'      => "Loan disbursed to {$loan->customer->name}",
                'shop_id'          => $loan->shop_id,
            ]);

            DB::commit();
            // Audit log
            ActivityLog::log('LOAN_CREATED', $request->user(), "Loan of ₹{$loan->amount} created for {$loan->customer->name}");
            return response()->json($loan->load('customer', 'payments'), 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->errorResponse($e, 'Failed to create loan');
        }
    }

    public function show(Request $request, Loan $loan)
    {
        $user = $request->user();
        if (!$user->hasFullAccess() && $loan->shop_id !== $user->shop_id) {
            return response()->json(['message' => 'Not found.'], 404);
        }
        $loan->total_paid = $loan->totalPaid();
        $loan->remaining  = $loan->remaining();
        return response()->json($loan->load('customer', 'payments'));
    }

    public function recordPayment(Request $request, LoanPayment $loanPayment)
    {
        $data = $request->validate([
            'paid_date'     => 'required|date',
            'penalty'       => 'nullable|numeric|min:0',
            'notes'         => 'nullable|string',
            'payment_mode'  => 'nullable|string',
            'payment_lines' => 'nullable|array|min:2',
            'payment_lines.*.payment_mode' => 'required_with:payment_lines|string',
            'payment_lines.*.amount'       => 'required_with:payment_lines|numeric|min:0.01',
        ]);

        if (!\App\Services\TransactionService::paymentLinesSumMatches($data['payment_lines'] ?? null, (float) ($loanPayment->amount + ($data['penalty'] ?? 0)))) {
            return response()->json(['message' => 'Split payment lines must add up to the payment amount'], 422);
        }

        return DB::transaction(function () use ($data, $loanPayment, $request) {
            // Lock target payment record safely
            $payment = LoanPayment::lockForUpdate()->findOrFail($loanPayment->id);

            // Short-circuit if prior request successfully processed this record
            if ($payment->status === 'paid') {
                return response()->json($payment->load('loan.customer'));
            }

            // Guard: prevent overpayment beyond outstanding balance
            $loan = $payment->loan;
            $outstanding = $loan->remaining();
            $paymentAmount = $payment->amount + ($data['penalty'] ?? 0);
            if ($paymentAmount > $outstanding) {
                return response()->json([
                    'message' => "Payment amount ₹{$paymentAmount} exceeds outstanding balance ₹{$outstanding}. Please adjust the amount."
                ], 422);
            }

            $payment->update(array_merge($data, ['status' => 'paid']));

            // Record Transaction (Repayment) using Service
            $this->transactionService->recordForModel($payment, [
                'type'             => 'IN',
                'category'         => 'LOAN_REPAYMENT',
                'amount'           => $payment->amount + ($data['penalty'] ?? 0),
                'payment_mode'     => $data['payment_mode'] ?? 'CASH',
                'payment_lines'    => $data['payment_lines'] ?? null,
                'description'      => "Loan repayment from {$payment->loan->customer->name} (EMI)",
                'transaction_date' => Carbon::parse($payment->paid_date)->toDateString(),
                'shop_id'          => $payment->shop_id,
            ]);

            // Check if all paid → close loan
            $loan = $payment->loan;
            $pendingCount = $loan->payments()->where('status', 'pending')->count();
            if ($pendingCount === 0) {
                $loan->update(['status' => 'closed']);
            }

            return response()->json($payment->fresh()->load('loan.customer'));
        });
    }
}
