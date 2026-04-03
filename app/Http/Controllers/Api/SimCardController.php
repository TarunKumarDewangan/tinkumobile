<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SimCard;
use Illuminate\Http\Request;

class SimCardController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $query = SimCard::with('supplier', 'customer');
        if (! $user->hasFullAccess()) $query->where('shop_id', $user->shop_id);
        if ($request->status) $query->where('status', $request->status);
        return response()->json($query->latest()->get());
    }

    public function purchase(Request $request)
    {
        $user = $request->user();
        $data = $request->validate([
            'sim_number'     => 'required|string|max:20|unique:sim_cards',
            'mobile_number'  => 'nullable|string|max:15',
            'operator'       => 'required|string|max:50',
            'purchase_price' => 'required|numeric|min:0',
            'selling_price'  => 'required|numeric|min:0',
            'purchased_from' => 'required|exists:suppliers,id',
            'purchase_date'  => 'required|date',
        ]);
        $data['shop_id']          = $user->hasFullAccess() ? $request->shop_id : $user->shop_id;
        $data['user_id_purchase'] = $user->id;
        return response()->json(SimCard::create($data), 201);
    }

    public function sell(Request $request, SimCard $simCard)
    {
        $user = $request->user();
        if (! $user->hasFullAccess() && $simCard->shop_id !== $user->shop_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        if ($simCard->status === 'sold') {
            return response()->json(['message' => 'Already sold'], 422);
        }

        $data = $request->validate([
            'sold_to'   => 'required|exists:customers,id',
            'sale_date' => 'required|date',
        ]);

        $simCard->update(array_merge($data, [
            'status'       => 'sold',
            'user_id_sale' => $user->id,
        ]));

        return response()->json($simCard->fresh()->load('customer'));
    }
}
