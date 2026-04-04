<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\GiftProduct;
use App\Models\GiftInventory;
use Illuminate\Http\Request;

class GiftController extends Controller
{
    public function products(Request $request)
    {
        return response()->json(GiftProduct::all());
    }

    public function storeProduct(Request $request)
    {
        $data = $request->validate([
            'name'           => 'required|string|max:200',
            'sku'            => 'required|string|unique:gift_products,sku',
            'purchase_price' => 'required|numeric|min:0',
        ]);
        return response()->json(GiftProduct::create($data), 201);
    }

    public function inventory(Request $request)
    {
        $user = $request->user();
        $query = GiftInventory::with('giftProduct', 'shop');
        if (! $user->hasFullAccess()) $query->where('shop_id', $user->shop_id);
        return response()->json($query->get());
    }

    public function addStock(Request $request)
    {
        $user = $request->user();
        $data = $request->validate([
            'gift_product_id' => 'required|exists:gift_products,id',
            'quantity'        => 'required|integer|min:1',
        ]);
        $shopId = $user->hasFullAccess() ? $request->shop_id : $user->shop_id;
        $inv = GiftInventory::firstOrCreate(
            ['shop_id' => $shopId, 'gift_product_id' => $data['gift_product_id']],
            ['stock' => 0]
        );
        $inv->increment('stock', $data['quantity']);
        return response()->json($inv->fresh()->load('giftProduct'));
    }
}
