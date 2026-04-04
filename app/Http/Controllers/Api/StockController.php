<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PurchaseItem;
use App\Models\Product;
use Illuminate\Http\Request;

class StockController extends Controller
{
    /**
     * Update the location of a specific stock item (PurchaseItem).
     */
    public function updateLocation(Request $request, $id)
    {
        $request->validate([
            'location' => 'nullable|string|max:200',
            'is_product' => 'nullable' // Can be boolean or "true"/"false" string from frontend
        ]);

        $location = $request->location ? strtoupper($request->location) : null;
        $isProduct = filter_var($request->is_product, FILTER_VALIDATE_BOOLEAN);

        // If it's a product-level location update
        if ($isProduct) {
            $product = Product::findOrFail($id);
            $oldLocation = $product->location;
            $product->update(['location' => $location]);

            // PROPAGATE: Update all items that don't have a specific different location set
            // i.e. items where location is NULL or matches the OLD product location
            $query = PurchaseItem::where('product_id', $product->id);
            
            if ($oldLocation) {
                $query->where(function($q) use ($oldLocation) {
                    $q->whereNull('location')->orWhere('location', $oldLocation);
                });
            } else {
                $query->whereNull('location');
            }

            $query->update(['location' => $location]);

            return response()->json(['message' => 'Product and related stock locations updated', 'location' => $location]);
        }

        // Standard case: update specific PurchaseItem (individual unit/batch)
        $realId = $id;
        if (is_string($id) && str_contains($id, 'item_')) {
            $parts = explode('_', $id);
            $realId = (int)$parts[1]; // The purchase_item_id
        }

        $item = PurchaseItem::findOrFail($realId);
        $item->update(['location' => $location]);

        return response()->json([
            'message' => 'Stock location updated',
            'location' => $location
        ]);
    }
}
