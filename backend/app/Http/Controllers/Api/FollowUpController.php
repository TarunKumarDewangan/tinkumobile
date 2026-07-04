<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FollowUp;
use Illuminate\Http\Request;

class FollowUpController extends Controller
{
    public function index(Request $request)
    {
        $user  = $request->user();
        $query = FollowUp::with('customer', 'createdBy');

        // Shop scope
        if (! $user->hasFullAccess()) {
            $query->where('shop_id', $user->shop_id);
        } elseif ($request->shop_id) {
            $query->where('shop_id', $request->shop_id);
        }

        if ($request->status)   $query->where('status', $request->status);
        if ($request->date)     $query->where('follow_up_date', $request->date);
        if ($request->from)     $query->where('follow_up_date', '>=', $request->from);
        if ($request->to)       $query->where('follow_up_date', '<=', $request->to);

        if ($request->search) {
            $s = $request->search;
            $query->whereHas('customer', fn($q) =>
                $q->where('name', 'like', "%$s%")->orWhere('phone', 'like', "%$s%")
            );
        }

        return response()->json($query->latest('follow_up_date')->get());
    }

    public function store(Request $request)
    {
        $user = $request->user();
        $data = $request->validate([
            'customer_id'            => 'required|exists:customers,id',
            'follow_up_date'         => 'required|date',
            'interested_product_ids' => 'nullable|array',
            'address'                => 'nullable|string',
            'notes'                  => 'nullable|string',
        ]);

        $data['shop_id']    = $user->hasFullAccess() ? ($request->shop_id ?? $user->shop_id) : $user->shop_id;
        $data['created_by'] = $user->id;

        return response()->json(FollowUp::create($data)->load('customer', 'createdBy'), 201);
    }

    public function update(Request $request, FollowUp $followUp)
    {
        $data = $request->validate([
            'status'                 => 'sometimes|in:pending,completed,cancelled',
            'completed_at'           => 'nullable|date',
            'follow_up_date'         => 'sometimes|date',
            'notes'                  => 'nullable|string',
            'interested_product_ids' => 'nullable|array',
        ]);
        $followUp->update($data);
        return response()->json($followUp->fresh()->load('customer', 'createdBy'));
    }

    public function destroy(FollowUp $followUp)
    {
        $followUp->delete();
        return response()->json(['message' => 'Follow-up deleted']);
    }
}
