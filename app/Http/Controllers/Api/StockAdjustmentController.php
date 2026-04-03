<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Inventory;
use App\Models\Product;
use App\Models\StockAdjustment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StockAdjustmentController extends Controller
{
    /**
     * List all stock adjustments (with product & shop info)
     */
    public function index(Request $request)
    {
        $query = StockAdjustment::with(['product.category', 'shop', 'user'])
            ->orderBy('created_at', 'desc');

        if ($request->filled('product_id')) {
            $query->where('product_id', $request->product_id);
        }

        return response()->json($query->get());
    }

    /**
     * Create a stock adjustment (add or remove stock)
     * Reasons: opening_stock, previous_purchase, correction_add, correction_remove, damage_write_off, return_to_supplier
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'product_id'      => 'required|exists:products,id',
            'shop_id'         => 'nullable|exists:shops,id',
            'type'            => 'required|in:add,remove',
            'quantity'        => 'required|integer|min:1',
            'reason'          => 'required|string|max:100',
            'purchase_price'  => 'nullable|numeric|min:0',
            'notes'           => 'nullable|string|max:500',
            'adjustment_date' => 'required|date',
        ]);

        // For non-owners, shop_id comes from the middleware-injected value
        $shopId = $request->input('_shop_id')       // from ShopScope middleware
                ?? $validated['shop_id']             // explicitly sent
                ?? null;

        if (!$shopId) {
            return response()->json(['message' => 'Shop ID is required.'], 422);
        }

        return DB::transaction(function () use ($validated, $shopId, $request) {

            $adjustment = StockAdjustment::create([
                'shop_id'         => $shopId,
                'product_id'      => $validated['product_id'],
                'user_id'         => $request->user()->id,
                'type'            => $validated['type'],
                'quantity'        => $validated['quantity'],
                'reason'          => $validated['reason'],
                'purchase_price'  => $validated['purchase_price'] ?? null,
                'notes'           => $validated['notes'] ?? null,
                'adjustment_date' => $validated['adjustment_date'],
            ]);

            // Update inventory stock
            if ($validated['type'] === 'add') {
                Inventory::addStock($shopId, $validated['product_id'], $validated['quantity']);
            } else {
                // Check sufficient stock before removing
                $inv = Inventory::where('shop_id', $shopId)
                    ->where('product_id', $validated['product_id'])->first();
                $current = $inv ? $inv->stock : 0;
                if ($current < $validated['quantity']) {
                    abort(422, "Insufficient stock. Current: {$current}, Trying to remove: {$validated['quantity']}");
                }
                Inventory::removeStock($shopId, $validated['product_id'], $validated['quantity']);
            }

            return response()->json($adjustment->load(['product', 'shop', 'user']), 201);
        });
    }

    /**
     * Current stock levels for all products in a shop
     */
    public function stockLevels(Request $request)
    {
        $shopId = $request->input('_shop_id');

        $query = Inventory::with(['product.category'])
            ->orderByDesc('stock');

        if ($shopId) {
            $query->where('shop_id', $shopId);
        }

        return response()->json($query->get());
    }
}
