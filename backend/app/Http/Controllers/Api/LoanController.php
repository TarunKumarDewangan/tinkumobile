<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Loan;
use App\Models\LoanPayment;
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
        ]);

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
                'description'      => "Loan disbursed to {$loan->customer->name}",
                'shop_id'          => $loan->shop_id,
            ]);

            DB::commit();
            return response()->json($loan->load('customer', 'payments'), 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }

    public function show(Loan $loan)
    {
        $loan->total_paid = $loan->totalPaid();
        $loan->remaining  = $loan->remaining();
        return response()->json($loan->load('customer', 'payments'));
    }

    public function recordPayment(Request $request, LoanPayment $loanPayment)
    {
        $data = $request->validate([
            'paid_date' => 'required|date',
            'penalty'   => 'nullable|numeric|min:0',
            'notes'     => 'nullable|string',
        ]);

        return DB::transaction(function () use ($data, $loanPayment) {
            // Lock target payment record safely
            $payment = LoanPayment::lockForUpdate()->findOrFail($loanPayment->id);

            // Short-circuit if prior request successfully processed this record
            if ($payment->status === 'paid') {
                return response()->json($payment->load('loan.customer'));
            }

            $payment->update(array_merge($data, ['status' => 'paid']));

            // Record Transaction (Repayment) using Service
            $this->transactionService->recordForModel($payment, [
                'type'             => 'IN',
                'category'         => 'LOAN_REPAYMENT',
                'amount'           => $payment->amount + ($data['penalty'] ?? 0),
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
