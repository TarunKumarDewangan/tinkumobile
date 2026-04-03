<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Loan;
use App\Models\LoanPayment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class LoanController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $query = Loan::with('customer', 'payments');

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
        ]);

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
                    'loan_id'  => $loan->id,
                    'due_date' => $startDate->copy()->addMonths($i)->toDateString(),
                    'amount'   => $monthlyInstallment,
                ]);
            }

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

        $loanPayment->update(array_merge($data, ['status' => 'paid']));

        // Check if all paid → close loan
        $loan = $loanPayment->loan;
        $pendingCount = $loan->payments()->where('status', 'pending')->count();
        if ($pendingCount === 0) {
            $loan->update(['status' => 'closed']);
        }

        return response()->json($loanPayment->fresh());
    }
}
