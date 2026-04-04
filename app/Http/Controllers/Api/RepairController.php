<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RepairRequest;
use Illuminate\Http\Request;

class RepairController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $query = RepairRequest::with('assignedTo', 'staff');

        if (! $user->hasFullAccess()) {
            $query->where('shop_id', $user->shop_id);
        } elseif ($request->shop_id) {
            $query->where('shop_id', $request->shop_id);
        }

        if ($request->status) $query->where('status', $request->status);

        return response()->json($query->latest()->get());
    }

    /** Public: customer submits repair request */
    public function publicStore(Request $request)
    {
        $data = $request->validate([
            'shop_id'           => 'required|exists:shops,id',
            'customer_name'     => 'required|string|max:150',
            'customer_phone'    => 'required|string|max:20',
            'customer_email'    => 'nullable|email|max:100',
            'device_model'      => 'required|string|max:150',
            'issue_description' => 'required|string',
        ]);

        $repair = RepairRequest::create(array_merge($data, ['created_by' => 'customer']));
        return response()->json(['message' => 'Repair request submitted', 'id' => $repair->id], 201);
    }

    /** Staff creates repair request */
    public function store(Request $request)
    {
        $user = $request->user();
        $shopId = $user->hasFullAccess() ? $request->shop_id : $user->shop_id;

        $data = $request->validate([
            'customer_name'             => 'required|string|max:150',
            'customer_phone'            => 'required|string|max:20',
            'customer_email'            => 'nullable|email|max:100',
            'device_model'              => 'required|string|max:150',
            'issue_description'         => 'required|string',
            'estimated_delivery_date'   => 'nullable|date',
        ]);

        $repair = RepairRequest::create(array_merge($data, [
            'shop_id'    => $shopId,
            'created_by' => 'staff',
            'staff_id'   => $user->id,
        ]));

        return response()->json($repair, 201);
    }

    public function update(Request $request, RepairRequest $repairRequest)
    {
        $user = $request->user();
        if (! $user->hasFullAccess() && $repairRequest->shop_id !== $user->shop_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $data = $request->validate([
            'status'                    => 'in:pending,assigned,in_progress,completed,delivered',
            'assigned_to'               => 'nullable|exists:users,id',
            'estimated_delivery_date'   => 'nullable|date',
            'actual_delivery_date'      => 'nullable|date',
            'customer_name'             => 'sometimes|string',
            'customer_phone'            => 'sometimes|string',
            'device_model'              => 'sometimes|string',
            'issue_description'         => 'sometimes|string',
        ]);

        $repairRequest->update($data);
        return response()->json($repairRequest->fresh()->load('assignedTo'));
    }

    public function show(Request $request, RepairRequest $repairRequest)
    {
        $user = $request->user();
        if (! $user->hasFullAccess() && $repairRequest->shop_id !== $user->shop_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        return response()->json($repairRequest->load('assignedTo', 'staff'));
    }
}
