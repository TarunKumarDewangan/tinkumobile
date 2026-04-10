<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SalaryPayment;
use App\Models\User;
use Illuminate\Http\Request;
use App\Traits\RecordsTransactions;
use Illuminate\Support\Facades\DB;

class SalaryPaymentController extends Controller
{
    use RecordsTransactions;
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
            'type'         => 'required|in:salary,advance,bonus',
            'for_month'    => 'nullable|string|max:7', // e.g. "2026-04"
            'payment_date' => 'required|date',
            'notes'        => 'nullable|string',
        ]);

        $targetUser = User::findOrFail($data['user_id']);
        
        // Authorization check
        $user = $request->user();
        if (!$user->hasFullAccess() && $targetUser->shop_id !== $user->shop_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $payment = SalaryPayment::create($data);

        // Record Transaction
        $this->recordTransaction([
            'type'             => 'OUT',
            'category'         => 'SALARY',
            'amount'           => $payment->amount,
            'payment_mode'     => 'CASH', // Default for now
            'description'      => "{$data['type']} payment for {$targetUser->name} (" . ($data['for_month'] ?? 'N/A') . ")",
            'entity_id'        => $payment->id,
            'entity_type'      => \App\Models\SalaryPayment::class,
            'ref_id'           => $payment->id,
            'transaction_date' => $payment->payment_date->toDateString(),
        ]);

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
