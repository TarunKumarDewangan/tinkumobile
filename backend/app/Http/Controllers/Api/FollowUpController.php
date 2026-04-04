<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FollowUp;
use Illuminate\Http\Request;

class FollowUpController extends Controller
{
    public function index(Request $request)
    {
        $query = FollowUp::with('customer');
        if ($request->status) $query->where('status', $request->status);
        if ($request->date) $query->where('follow_up_date', $request->date);
        return response()->json($query->latest('follow_up_date')->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'customer_id'           => 'required|exists:customers,id',
            'follow_up_date'        => 'required|date',
            'interested_product_ids'=> 'nullable|array',
            'address'               => 'nullable|string',
            'notes'                 => 'nullable|string',
        ]);
        return response()->json(FollowUp::create($data), 201);
    }

    public function update(Request $request, FollowUp $followUp)
    {
        $data = $request->validate([
            'status'                => 'in:pending,completed,cancelled',
            'completed_at'          => 'nullable|date',
            'follow_up_date'        => 'sometimes|date',
            'notes'                 => 'nullable|string',
            'interested_product_ids'=> 'nullable|array',
        ]);
        $followUp->update($data);
        return response()->json($followUp->fresh()->load('customer'));
    }

    public function destroy(FollowUp $followUp)
    {
        $followUp->delete();
        return response()->json(['message' => 'Follow-up deleted']);
    }
}
