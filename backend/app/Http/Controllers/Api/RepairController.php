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

        // Scope by shop
        if (! $user->hasFullAccess()) {
            $query->where('shop_id', $user->shop_id);
        } elseif ($request->filled('shop_id')) {
            $query->where('shop_id', $request->shop_id);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(function($q) use ($s) {
                $q->where('customer_name', 'like', "%$s%")
                  ->orWhere('customer_phone', 'like', "%$s%")
                  ->orWhere('device_model', 'like', "%$s%")
                  ->orWhere('forwarded_to', 'like', "%$s%");
            });
        }

        // Submitted Date Range
        if ($request->filled('submitted_from')) {
            $query->whereDate('submitted_date', '>=', $request->submitted_from);
        }
        if ($request->filled('submitted_to')) {
            $query->whereDate('submitted_date', '<=', $request->submitted_to);
        }

        // Delivery Date Range
        if ($request->filled('delivery_from')) {
            $query->whereDate('estimated_delivery_date', '>=', $request->delivery_from);
        }
        if ($request->filled('delivery_to')) {
            $query->whereDate('estimated_delivery_date', '<=', $request->delivery_to);
        }

        if ($request->filled('is_forwarded') && $request->is_forwarded !== 'all') {
            $val = filter_var($request->is_forwarded, FILTER_VALIDATE_BOOLEAN);
            $query->where('is_forwarded', $val);
        }

        $results = $query->latest()->get();
        
        return response()->json($results);
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
            'issue_description' => 'required|array|min:1',
            'issue_description.*' => 'required|string',
        ]);

        $repair = RepairRequest::create(array_merge($data, ['created_by' => 'customer']));
        return response()->json(['message' => 'Repair request submitted', 'id' => $repair->id], 201);
    }

    public function store(Request $request)
    {
        $user = $request->user();
        $shopId = ($user->hasFullAccess() && $request->shop_id) ? $request->shop_id : $user->shop_id;
        
        // Final fallback for admins/owners not linked to a specific shop
        if (!$shopId && $user->hasFullAccess()) {
            $shopId = \App\Models\Shop::first()?->id;
        }

        $data = $request->validate([
            'customer_name'             => 'required|string|max:150',
            'customer_phone'            => 'required|string|max:20',
            'customer_email'            => 'nullable|email|max:100',
            'submitted_date'            => 'nullable|date',
            'device_model'              => 'required|string|max:150',
            'quoted_amount'             => 'nullable|numeric',
            'service_center_cost'       => 'nullable|numeric',
            'advance_amount'            => 'nullable|numeric',
            'issue_description'         => 'required|array|min:1',
            'issue_description.*'       => 'required|string',
            'estimated_delivery_date'   => 'nullable|date',
            'is_forwarded'              => 'boolean',
            'forwarded_to'              => 'nullable|string|max:255',
            'forwarded_phone'           => 'nullable|string|max:20',
            'external_expected_delivery'=> 'nullable|date',
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
            'quoted_amount'             => 'nullable|numeric',
            'service_center_cost'       => 'nullable|numeric',
            'advance_amount'            => 'nullable|numeric',
            'issue_description'         => 'sometimes|array',
            'issue_description.*'       => 'required|string',
            'submitted_date'            => 'nullable|date',
            'is_forwarded'              => 'boolean',
            'forwarded_to'              => 'nullable|string|max:255',
            'forwarded_phone'           => 'nullable|string|max:20',
            'external_expected_delivery'=> 'nullable|date',
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

    public function destroy(Request $request, RepairRequest $repairRequest)
    {
        if (! $request->user()->hasFullAccess()) {
            return response()->json(['message' => 'Unauthorized. Only Owners/Admins can delete repairs.'], 403);
        }

        $repairRequest->delete();
        return response()->json(['message' => 'Repair request deleted']);
    }

    public function getExternalShops(Request $request)
    {
        $shops = RepairRequest::whereNotNull('forwarded_to')
            ->select('forwarded_to', 'forwarded_phone')
            ->distinct()
            ->orderBy('forwarded_to')
            ->get();
        return response()->json($shops);
    }
}
