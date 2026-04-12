<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RechargePurchase;
use App\Models\RechargeSale;
use Illuminate\Http\Request;

class RechargeController extends Controller
{
    use \App\Traits\SyncsWithCustomer;
    // ── Purchases ──────────────────────────────────────────────────────────
    public function purchaseIndex(Request $request)
    {
        $user = $request->user();
        $query = RechargePurchase::with('supplier', 'user');
        if (! $user->hasFullAccess()) $query->where('shop_id', $user->shop_id);
        return response()->json($query->latest()->get());
    }

    public function purchaseStore(Request $request)
    {
        $user = $request->user();
        $data = $request->validate([
            'supplier_id'   => 'required|exists:suppliers,id',
            'operator'      => 'required|string|max:50',
            'amount'        => 'required|numeric|min:0',
            'cost_price'    => 'required|numeric|min:0',
            'purchase_date' => 'required|date',
        ]);
        $data['shop_id'] = $user->hasFullAccess() ? $request->shop_id : $user->shop_id;
        $data['user_id'] = $user->id;
        return response()->json(RechargePurchase::create($data), 201);
    }

    // ── Sales ───────────────────────────────────────────────────────────────
    public function saleIndex(Request $request)
    {
        $user = $request->user();
        $query = RechargeSale::with('customer', 'user');
        if (! $user->hasFullAccess()) $query->where('shop_id', $user->shop_id);
        return response()->json($query->latest()->get());
    }

    public function saleStore(Request $request)
    {
        $user = $request->user();
        $data = $request->validate([
            'customer_id'    => 'nullable|exists:customers,id',
            'customer_name'  => 'nullable|string|max:150',
            'customer_phone' => 'nullable|string|max:20',
            'mobile_number'  => 'required|string|max:15',
            'operator'       => 'required|string|max:50',
            'amount'         => 'required|numeric|min:0',
            'selling_price'  => 'required|numeric|min:0',
            'sale_date'      => 'required|date',
        ]);

        if (!$data['customer_id'] && !$data['customer_phone']) {
            return response()->json(['message' => 'Customer selection or phone number is required.'], 422);
        }

        $data['customer_id'] = $data['customer_id'] ?? $this->syncCustomer($data, 'RECHARGE');
        $data['shop_id'] = $user->hasFullAccess() ? $request->shop_id : $user->shop_id;
        $data['user_id'] = $user->id;
        return response()->json(RechargeSale::create($data), 201);
    }
}
