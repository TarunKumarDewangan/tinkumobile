<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Inventory;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;

class ProductController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $shopId = $user->hasFullAccess() ? $request->shop_id : $user->shop_id;
        if ($user->hasFullAccess() && !$shopId) $shopId = 1;

        // If user wants ungrouped "every single product" view
        if ($request->group_by_config === 'false') {
            $query = \App\Models\PurchaseItem::with(['product.category', 'invoice.supplier'])
                ->whereHas('invoice', function($q) use ($shopId, $request) {
                    $q->where('status', 'received');
                    if ($shopId) $q->where('shop_id', $shopId);
                    if ($request->supplier_id) $q->where('supplier_id', $request->supplier_id);
                    if ($request->from) $q->where('purchase_date', '>=', $request->from);
                    if ($request->to) $q->where('purchase_date', '<=', $request->to);
                })
                ->whereHas('product', function($q) use ($request) {
                    if ($request->category_id) $q->where('category_id', $request->category_id);
                });

            if ($request->search) {
                $s = $request->search;
                $query->where(function($q) use ($s) {
                    $q->whereHas('product', function($pq) use ($s) {
                        $pq->where('name', 'like', "%{$s}%")
                          ->orWhere('attributes->model', 'like', "%{$s}%");
                    })
                    ->orWhere('imei', 'like', "%{$s}%");
                });
            }

            if ($request->model) {
                $query->whereHas('product', fn($q) => $q->where('name', 'like', "%{$request->model}%"));
            }

            if ($request->ram)     $query->where('ram', 'like', "%{$request->ram}%");
            if ($request->storage) $query->where('storage', 'like', "%{$request->storage}%");
            if ($request->color)   $query->where('color', 'like', "%{$request->color}%");
            
            $items = $query->get();
            $expanded = [];

            foreach ($items as $item) {
                $imeis = $item->imei ? array_map('trim', explode(',', $item->imei)) : [null];
                
                foreach ($imeis as $index => $imei) {
                    $expanded[] = [
                        'id' => 'item_' . $item->id . '_' . $index,
                        'name' => $item->product->name,
                        'attributes' => [
                            'color' => $item->color,
                            'ram' => $item->ram,
                            'storage' => $item->storage,
                            'imei' => $imei
                        ],
                        'current_stock' => 1,
                        'selling_price' => $item->selling_price,
                        'location' => $item->location ?? $item->product->location, // Fallback
                        'category' => $item->product->category
                    ];
                }
            }

            return response()->json($expanded);
        }

        $query = Product::with('category')->withTrashed()->where('deleted_at', null);

        if ($request->category_id) $query->where('category_id', $request->category_id);
        
        if ($request->search) {
            $query->where(function($q) use ($request) {
                $q->where('name', 'like', "%{$request->search}%")
                  ->orWhere('attributes->model', 'like', "%{$request->search}%");
            });
        }
        
        if ($request->model) $query->where('attributes->model', 'like', "%{$request->model}%");
        if ($request->color) $query->where('attributes->color', 'like', "%{$request->color}%");
        if ($request->ram) $query->where('attributes->ram', 'like', "%{$request->ram}%");
        if ($request->storage) $query->where('attributes->storage', 'like', "%{$request->storage}%");

        $products = $query->get();

        if ($shopId) {
            $inventoryMap = Inventory::where('shop_id', $shopId)
                ->pluck('stock', 'product_id');

            $products = $products->map(function ($p) use ($inventoryMap) {
                return [
                    'id'            => $p->id,
                    'category_id'   => $p->category_id,
                    'name'          => $p->name,
                    'category'      => $p->category,
                    'attributes'    => $p->attributes,
                    'selling_price' => $p->selling_price,
                    'current_stock' => $inventoryMap[$p->id] ?? 0,
                    'location'      => $p->location,
                ];
            });
        }

        return response()->json($products);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'category_id'    => 'required|exists:categories,id',
            'name'           => 'required|string|max:200',
            'sku'            => 'required|string|max:100|unique:products,sku',
            'imei'           => 'nullable|string|max:20|unique:products,imei',
            'purchase_price' => 'required|numeric|min:0',
            'selling_price'  => 'required|numeric|min:0',
            'condition'      => 'in:new,used',
            'attributes'     => 'nullable|array',
        ]);
        return response()->json(Product::create($data), 201);
    }

    public function show(Product $product)
    {
        return response()->json($product->load('category', 'inventory.shop'));
    }

    public function update(Request $request, Product $product)
    {
        $data = $request->validate([
            'category_id'    => 'sometimes|exists:categories,id',
            'name'           => 'sometimes|string|max:200',
            'sku'            => 'sometimes|string|max:100|unique:products,sku,' . $product->id,
            'imei'           => 'nullable|string|max:20|unique:products,imei,' . $product->id,
            'purchase_price' => 'sometimes|numeric|min:0',
            'selling_price'  => 'sometimes|numeric|min:0',
            'condition'      => 'in:new,used',
            'attributes'     => 'nullable|array',
        ]);
        $product->update($data);
        return response()->json($product);
    }

    public function destroy(Product $product)
    {
        $product->delete();
        return response()->json(['message' => 'Product deleted']);
    }

    public function deleteStock(Request $request, $id)
    {
        $user = $request->user();
        if (!$user->hasFullAccess()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Parsing ID if it's 'item_123_0' from expanded view
        if (str_starts_with($id, 'item_')) {
            $parts = explode('_', $id);
            $itemId = $parts[1];
        } else {
            $itemId = $id;
        }

        return DB::transaction(function () use ($itemId) {
            $item = \App\Models\PurchaseItem::with('invoice')->findOrFail($itemId);
            $invoice = $item->invoice;

            // 1. Dec स्टॉक
            Inventory::removeStock($invoice->shop_id, $item->product_id, 1);

            // 2. Adjust or Delete PurchaseItem
            if ($item->quantity > 1) {
                $item->decrement('quantity');
                $item->decrement('received_quantity');
                $item->total = $item->quantity * $item->unit_price;
                $item->save();
            } else {
                $item->delete();
            }

            // 3. Recalculate Invoice Totals
            $invoice->refresh();
            $items = $invoice->items;
            $totalAmount = $items->sum(fn($i) => $i->quantity * $i->unit_price);
            
            $cgstAmount = ($totalAmount * ($invoice->cgst_rate ?? 9)) / 100;
            $sgstAmount = ($totalAmount * ($invoice->sgst_rate ?? 9)) / 100;
            $rawGrandTotal = $totalAmount + $cgstAmount + $sgstAmount - ($invoice->discount ?? 0);
            
            if ($invoice->rounding_mode === 'up') $grandTotal = ceil($rawGrandTotal);
            else if ($invoice->rounding_mode === 'down') $grandTotal = floor($rawGrandTotal);
            else $grandTotal = round($rawGrandTotal);

            $invoice->update([
                'total_amount' => $totalAmount,
                'cgst_amount'  => $cgstAmount,
                'sgst_amount'  => $sgstAmount,
                'grand_total'  => $grandTotal,
            ]);
            $invoice->updatePaymentStatus();

            return response()->json(['message' => 'Stock item deleted and invoice updated successfully.']);
        });
    }
}
