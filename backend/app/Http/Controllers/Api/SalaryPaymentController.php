<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SalaryPayment;
use App\Models\User;
use App\Models\ActivityLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class SalaryPaymentController extends Controller
{
    protected $transactionService;

    public function __construct(\App\Services\TransactionService $transactionService)
    {
        $this->transactionService = $transactionService;
    }

    public function index(Request $request)
    {
        $user = $request->user();
        $query = SalaryPayment::with('user.shop');

        if ($request->user_id) {
            $query->where('user_id', $request->user_id);
        }

        if (!$user->hasFullAccess()) {
            $query->whereHas('user', function($q) use ($user) {
                $q->where('shop_id', $user->shop_id);
            });
        }

        if ($request->month) {
            $query->where('for_month', $request->month);
        }

        return response()->json($query->latest()->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'user_id'      => 'required|exists:users,id',
            'amount'       => 'required|numeric|min:0.01',
            'payment_mode' => 'required|string',
            'payment_lines' => 'nullable|array|min:2',
            'payment_lines.*.payment_mode' => 'required_with:payment_lines|string',
            'payment_lines.*.amount'       => 'required_with:payment_lines|numeric|min:0.01',
            'type'         => 'required|in:salary,advance,bonus',
            'for_month'    => 'nullable|string|max:7', // e.g. "2026-04"
            'payment_date' => 'required|date',
            'notes'        => 'nullable|string',
            'force'        => 'nullable|boolean',
        ]);

        $targetUser = User::findOrFail($data['user_id']);

        // Authorization check
        $user = $request->user();
        if (!$user->hasFullAccess() && $targetUser->shop_id !== $user->shop_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if (!\App\Services\TransactionService::paymentLinesSumMatches($data['payment_lines'] ?? null, (float) $data['amount'])) {
            return response()->json(['message' => 'Split payment lines must add up to the amount'], 422);
        }

        // Guard: prevent double-payment for same employee in same month
        $existingPayment = SalaryPayment::where('user_id', $data['user_id'])
            ->whereYear('payment_date', Carbon::parse($data['payment_date'])->year)
            ->whereMonth('payment_date', Carbon::parse($data['payment_date'])->month)
            ->exists();

        if ($existingPayment && !$request->boolean('force')) {
            $month = Carbon::parse($data['payment_date'])->format('F Y');
            return response()->json([
                'message' => "Salary already recorded for {$targetUser->name} for {$month}. Use force=true to override."
            ], 422);
        }

        $payment = SalaryPayment::create($data);

        // Record Transaction — previously used the RecordsTransactions trait,
        // which creates the ledger row but never dual-posts to a matching
        // Bank/Card/UPI/Cash-Counter entity, unlike every other payment flow.
        $this->transactionService->recordForModel($payment, [
            'type'             => 'OUT',
            'category'         => 'SALARY',
            'amount'           => $payment->amount,
            'payment_mode'     => $payment->payment_mode,
            'payment_lines'    => $data['payment_lines'] ?? null,
            'entity_type'      => \App\Models\SalaryPayment::class,
            'entity_id'        => $payment->id,
            'description'      => "{$data['type']} payment for {$targetUser->name} (" . ($data['for_month'] ?? 'N/A') . ")",
            'transaction_date' => $payment->payment_date->toDateString(),
            'shop_id'          => $targetUser->shop_id,
        ]);

        // Audit log
        ActivityLog::log('SALARY_PAID', $request->user(), "Salary paid to {$targetUser->name} — ₹{$payment->amount}");

        return response()->json($payment, 201);
    }

    public function show(SalaryPayment $salaryPayment)
    {
        return response()->json($salaryPayment->load('user'));
    }

    public function destroy(SalaryPayment $salaryPayment, Request $request)
    {
        $user = $request->user();
        if (!$user->hasFullAccess() && $salaryPayment->user->shop_id !== $user->shop_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $salaryPayment->delete();
        return response()->json(['message' => 'Payment record deleted']);
    }
}
