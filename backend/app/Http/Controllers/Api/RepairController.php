<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RepairRequest;
use App\Traits\RecordsTransactions;
use App\Traits\SyncsWithCustomer;
use Illuminate\Http\Request;

class RepairController extends Controller
{
    use SyncsWithCustomer, RecordsTransactions;
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

        // Delivery Date Range (Estimated)
        if ($request->filled('delivery_from')) {
            $query->whereDate('estimated_delivery_date', '>=', $request->delivery_from);
        }
        if ($request->filled('delivery_to')) {
            $query->whereDate('estimated_delivery_date', '<=', $request->delivery_to);
        }

        // Actual Delivered Date Range
        if ($request->filled('delivered_from')) {
            $query->whereDate('actual_delivery_date', '>=', $request->delivered_from);
        }
        if ($request->filled('delivered_to')) {
            $query->whereDate('actual_delivery_date', '<=', $request->delivered_to);
        }

        // Payment Settlement Date Range
        if ($request->filled('payment_from')) {
            $query->whereDate('balance_received_at', '>=', $request->payment_from);
        }
        if ($request->filled('payment_to')) {
            $query->whereDate('balance_received_at', '<=', $request->payment_to);
        }

        if ($request->filled('is_forwarded') && $request->is_forwarded !== 'all') {
            $val = filter_var($request->is_forwarded, FILTER_VALIDATE_BOOLEAN);
            $query->where('is_forwarded', $val);
        }

        if ($request->filled('cost_payment_status')) {
            if ($request->cost_payment_status === 'pending') {
                $query->where('is_forwarded', true)->where('is_cost_paid', false)->where('service_center_cost', '>', 0);
            } elseif ($request->cost_payment_status === 'paid') {
                $query->where('is_cost_paid', true);
            }
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
            'customer_address'  => 'nullable|string',
            'device_model'      => 'required|string|max:150',
            'issue_description' => 'required|array|min:1',
            'issue_description.*' => 'required|string',
        ]);

        $customerId = $this->syncCustomer($data, 'REPAIR');
        $repair = RepairRequest::create(array_merge($data, [
            'customer_id' => $customerId,
            'created_by' => 'customer'
        ]));
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
            'customer_address'          => 'nullable|string',
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
            'balance_amount_received'   => 'nullable|numeric',
            'balance_received_at'       => 'nullable|date',
        ]);

        $customerId = $this->syncCustomer($data, 'REPAIR');
        $repair = RepairRequest::create(array_merge($data, [
            'customer_id' => $customerId,
            'shop_id'    => $shopId,
            'created_by' => 'staff',
            'staff_id'   => $user->id,
        ]));

        // Record Advance Payment if any
        if (isset($data['advance_amount']) && $data['advance_amount'] > 0) {
            $this->recordTransaction([
                'type' => 'IN',
                'category' => 'REPAIR_ADVANCE',
                'amount' => $data['advance_amount'],
                'description' => "Advance for repair: {$repair->device_model} (Inv: #{$repair->id}) - Customer: {$repair->customer_name}",
                'entity_type' => get_class($repair),
                'entity_id' => $repair->id,
                'shop_id' => $shopId,
            ]);
        }

        return response()->json($repair, 201);
    }

    public function update(Request $request, RepairRequest $repair)
    {
        $user = $request->user();
        if (! $user->hasFullAccess() && $repair->shop_id !== $user->shop_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $data = $request->validate([
            'status'                    => 'in:pending,assigned,in_progress,completed,delivered',
            'assigned_to'               => 'nullable|exists:users,id',
            'estimated_delivery_date'   => 'nullable|date',
            'actual_delivery_date'      => 'nullable|date',
            'customer_name'             => 'sometimes|string',
            'customer_phone'            => 'sometimes|string',
            'customer_address'          => 'nullable|string',
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
            'balance_amount_received'   => 'nullable|numeric',
            'balance_received_at'       => 'nullable|date',
        ]);

        if ($request->hasAny(['customer_name', 'customer_phone', 'customer_email', 'customer_address'])) {
            $data['customer_id'] = $this->syncCustomer(array_merge($repair->toArray(), $data), 'REPAIR');
        }

        if ($request->status === 'delivered' && !$repair->actual_delivery_date) {
            $data['actual_delivery_date'] = now();
        }

        // Handle auto-settlement/suggested settlement
        if ($request->status === 'delivered' && !$repair->balance_received_at) {
             $balance = (float)$repair->quoted_amount - (float)$repair->advance_amount;
             
             // If user didn't provide an amount, but we are marking as delivered, 
             // assume the standard balance is received.
             if (!$request->filled('balance_amount_received') && $balance > 0) {
                 $data['balance_amount_received'] = $balance;
             }

             // If we have an amount (either from request or from auto-calc), mark settlement date
             if (isset($data['balance_amount_received']) || $request->filled('balance_amount_received')) {
                 $data['balance_received_at'] = now();
             }
        }

        $repair->update($data);

        // Record Balance Settlement
        if ($request->filled('balance_amount_received') && $request->balance_amount_received > 0) {
             $this->recordTransaction([
                'type' => 'IN',
                'category' => 'REPAIR_SETTLEMENT',
                'amount' => $request->balance_amount_received,
                'description' => "Balance collected for repair: {$repair->device_model} (Inv: #{$repair->id})",
                'entity_type' => get_class($repair),
                'entity_id' => $repair->id,
                'shop_id' => $repair->shop_id,
            ]);
        }

        return response()->json($repair->fresh()->load('assignedTo'));
    }

    public function show(Request $request, RepairRequest $repair)
    {
        $user = $request->user();
        if (! $user->hasFullAccess() && $repair->shop_id !== $user->shop_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        return response()->json($repair->load('assignedTo', 'staff'));
    }

    public function destroy(Request $request, RepairRequest $repair)
    {
        if (! $request->user()->hasFullAccess()) {
            return response()->json(['message' => 'Unauthorized. Only Owners/Admins can delete repairs.'], 403);
        }

        $repair->delete();
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

    public function payForwardCost(Request $request, RepairRequest $repair)
    {
        if (!$repair->is_forwarded || $repair->service_center_cost <= 0) {
            return response()->json(['message' => 'This repair is not forwarded or has no cost defined.'], 422);
        }

        if ($repair->is_cost_paid) {
            return response()->json(['message' => 'Cost is already marked as paid.'], 422);
        }

        $repair->update([
            'is_cost_paid' => true,
            'cost_paid_at' => now(),
        ]);

        $this->recordTransaction([
            'type' => 'OUT',
            'category' => 'REPAIR_FORWARDING_EXPENSE',
            'amount' => $repair->service_center_cost,
            'description' => "Settled payment to {$repair->forwarded_to} for repair #{$repair->id} ({$repair->device_model})",
            'entity_type' => get_class($repair),
            'entity_id' => $repair->id,
            'shop_id' => $repair->shop_id,
        ]);

        return response()->json(['message' => 'Cost payment recorded and repair updated', 'repair' => $repair]);
    }
}
