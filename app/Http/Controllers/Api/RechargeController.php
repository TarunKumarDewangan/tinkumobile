<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RechargePurchase;
use App\Models\RechargeSale;
use Illuminate\Http\Request;

class RechargeController extends Controller
{
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
            'customer_id'    => 'required|exists:customers,id',
            'mobile_number'  => 'required|string|max:15',
            'operator'       => 'required|string|max:50',
            'amount'         => 'required|numeric|min:0',
            'selling_price'  => 'required|numeric|min:0',
            'sale_date'      => 'required|date',
        ]);
        $data['shop_id'] = $user->hasFullAccess() ? $request->shop_id : $user->shop_id;
        $data['user_id'] = $user->id;
        return response()->json(RechargeSale::create($data), 201);
    }
}
