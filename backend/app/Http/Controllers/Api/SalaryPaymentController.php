<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SalaryPayment;
use App\Models\Employee;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SalaryPaymentController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $query = SalaryPayment::with('employee.shop');

        if ($request->employee_id) {
            $query->where('employee_id', $request->employee_id);
        }

        if (!$user->hasFullAccess()) {
            $query->whereHas('employee', function($q) use ($user) {
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
            'employee_id'  => 'required|exists:employees,id',
            'amount'       => 'required|numeric|min:0.01',
            'type'         => 'required|in:salary,advance,bonus',
            'for_month'    => 'nullable|string|max:7', // e.g. "2026-04"
            'payment_date' => 'required|date',
            'notes'        => 'nullable|string',
        ]);

        $employee = Employee::findOrFail($data['employee_id']);
        
        // Authorization check
        $user = $request->user();
        if (!$user->hasFullAccess() && $employee->shop_id !== $user->shop_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $payment = SalaryPayment::create($data);

        return response()->json($payment, 201);
    }

    public function show(SalaryPayment $salaryPayment)
    {
        return response()->json($salaryPayment->load('employee'));
    }

    public function destroy(SalaryPayment $salaryPayment, Request $request)
    {
        $user = $request->user();
        if (!$user->hasFullAccess() && $salaryPayment->employee->shop_id !== $user->shop_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $salaryPayment->delete();
        return response()->json(['message' => 'Payment record deleted']);
    }
}
