<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\EmployeeIncentive;
use Illuminate\Http\Request;

class IncentiveController extends Controller
{
    public function index(Request $request)
    {
        $user  = $request->user();
        $query = EmployeeIncentive::with('user', 'product', 'saleItem.invoice');

        if (! $user->hasFullAccess()) {
            $query->where('user_id', $user->id);
        } elseif ($request->user_id) {
            $query->where('user_id', $request->user_id);
        }

        if ($request->paid_status !== null) {
            $query->where('paid_status', (bool) $request->paid_status);
        }

        return response()->json($query->latest()->get());
    }

    public function markPaid(Request $request, EmployeeIncentive $incentive)
    {
        $data = $request->validate([
            'payment_date' => 'required|date',
            'notes'        => 'nullable|string',
        ]);
        $incentive->update(array_merge($data, ['paid_status' => true]));
        return response()->json($incentive->fresh());
    }
}
