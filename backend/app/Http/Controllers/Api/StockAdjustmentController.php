<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Inventory;
use App\Models\Product;
use App\Models\StockAdjustment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

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
     * Bulk create stock adjustments (Opening Stock)
     */
    public function bulkStore(Request $request)
    {
        $request->validate([
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'nullable|exists:products,id',
            'items.*.is_new' => 'boolean',
            'items.*.new_product_name' => 'required_if:items.*.is_new,true|nullable|string|max:200',
            'items.*.category_id' => 'required_if:items.*.is_new,true|nullable|exists:categories,id',
            'items.*.imei' => 'nullable|string|max:20',
            'items.*.ram' => 'nullable|string|max:50',
            'items.*.storage' => 'nullable|string|max:50',
            'items.*.color' => 'nullable|string|max:50',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit_price' => 'nullable|numeric|min:0',
            'items.*.selling_price' => 'nullable|numeric|min:0',
            'items.*.wholeseller_price' => 'nullable|numeric|min:0',
            'items.*.min_selling_price' => 'nullable|numeric|min:0',
            'items.*.max_selling_price' => 'nullable|numeric|min:0',
            'items.*.incentive_amount' => 'nullable|numeric|min:0',
            'adjustment_date' => 'required|date',
            'shop_id' => 'required|exists:shops,id',
            'notes' => 'nullable|string|max:500',
        ]);

        $shopId = $request->shop_id;

        try {
            return DB::transaction(function () use ($request, $shopId) {
                $created = [];
            $ignoredImeis = [];

            // ── Create a Dummy Invoice for Legacy Stock ──
            $supplier = \App\Models\Supplier::firstOrCreate(
                ['name' => 'OPENING STOCK'],
                ['phone' => '0000000000', 'address' => 'AUTO GENERATED']
            );

            // Find matching accounting entity for the audit logic
            $accountingEntityId = \App\Models\Entity::where('name', $supplier->name)->value('id');

            $invoice = \App\Models\PurchaseInvoice::create([
                'shop_id'               => $shopId,
                'supplier_id'           => $supplier->id,
                'accounting_entity_id'  => $accountingEntityId,
                'user_id'               => $request->user()->id,
                'invoice_no'            => 'LEGACY_BAL_' . strtoupper(Str::random(6)),
                'purchase_date'         => $request->adjustment_date,
                'status'                => 'received',
                'notes'                 => 'Opening stock from bulk entry. ' . ($request->notes ?? ''),
                'total_amount'          => 0,
                'grand_total'           => 0,
                'payment_status'        => 'paid'
            ]);

            foreach ($request->items as $item) {
                $imeis = [];
                if (!empty($item['imei'])) {
                    $imeis = preg_split('/[\s,]+/', trim($item['imei']), -1, PREG_SPLIT_NO_EMPTY);
                }

                if (count($imeis) > 0) {
                    foreach ($imeis as $imei) {
                        // Check if IMEI already exists in the system
                        $exists = \App\Models\PurchaseItem::where('imei', $imei)->exists();
                        if ($exists) {
                            $ignoredImeis[] = $imei;
                            continue; // Skip this IMEI and continue with others
                        }

                        $productId = $this->getOrCreateProduct($item, $imei);
                        if (!$productId) continue;

                        // 1. Stock Adjustment (for history)
                        $adjustment = StockAdjustment::create([
                            'shop_id'         => $shopId,
                            'product_id'      => $productId,
                            'user_id'         => $request->user()->id,
                            'type'            => 'add',
                            'quantity'        => 1,
                            'reason'          => 'opening_stock',
                            'purchase_price'  => $item['unit_price'] ?: null,
                            'notes'           => $request->notes,
                            'adjustment_date' => $request->adjustment_date,
                        ]);

                        // 2. Purchase Item (for Stock Visibility & Reports)
                        \App\Models\PurchaseItem::create([
                            'purchase_invoice_id' => $invoice->id,
                            'product_id'          => $productId,
                            'imei'                => $imei,
                            'ram'                 => $item['ram'] ?? null,
                            'storage'             => $item['storage'] ?? null,
                            'color'               => $item['color'] ?? null,
                            'quantity'            => 1,
                            'received_quantity'   => 1,
                            'unit_price'          => $item['unit_price'] ?: 0,
                            'selling_price'       => $item['selling_price'] ?: 0,
                            'wholeseller_price'   => $item['wholeseller_price'] ?? 0,
                            'min_selling_price'   => $item['min_selling_price'] ?? 0,
                            'max_selling_price'   => $item['max_selling_price'] ?? 0,
                            'incentive_amount'    => $item['incentive_amount'] ?? 0,
                            'total'               => $item['unit_price'] ?: 0
                        ]);

                        Inventory::addStock($shopId, $productId, 1);
                        $created[] = $adjustment;
                    }
                } else {
                    $productId = $this->getOrCreateProduct($item, null);
                    if ($productId) {
                        $quantity = $item['quantity'] ?: 1;
                        $adjustment = StockAdjustment::create([
                            'shop_id'         => $shopId,
                            'product_id'      => $productId,
                            'user_id'         => $request->user()->id,
                            'type'            => 'add',
                            'quantity'        => $quantity,
                            'reason'          => 'opening_stock',
                            'purchase_price'  => $item['unit_price'] ?: null,
                            'notes'           => $request->notes,
                            'adjustment_date' => $request->adjustment_date,
                        ]);

                        \App\Models\PurchaseItem::create([
                            'purchase_invoice_id' => $invoice->id,
                            'product_id'          => $productId,
                            'ram'                 => $item['ram'] ?? null,
                            'storage'             => $item['storage'] ?? null,
                            'color'               => $item['color'] ?? null,
                            'quantity'            => $quantity,
                            'received_quantity'   => $quantity,
                            'unit_price'          => $item['unit_price'] ?: 0,
                            'selling_price'       => $item['selling_price'] ?: 0,
                            'wholeseller_price'   => $item['wholeseller_price'] ?? 0,
                            'min_selling_price'   => $item['min_selling_price'] ?? 0,
                            'max_selling_price'   => $item['max_selling_price'] ?? 0,
                            'incentive_amount'    => $item['incentive_amount'] ?? 0,
                            'total'               => ($item['unit_price'] ?: 0) * $quantity
                        ]);

                        Inventory::addStock($shopId, $productId, $quantity);
                        $created[] = $adjustment;
                    }
                }
            }

            // If no items were created but there were ignored items
            if (count($created) === 0 && count($ignoredImeis) > 0) {
                // Throw clean exception to trigger standard outer transaction rolling automatically
                throw new \RuntimeException(json_encode([
                    'message' => 'No items were added. All provided IMEIs were duplicates.',
                    'ignored_imeis' => $ignoredImeis,
                    'adjustments' => []
                ]));
            }

            // Update invoice total
            $invoice->update([
                'total_amount' => $invoice->items()->sum('total'),
                'grand_total'  => $invoice->items()->sum('total'),
            ]);

            $message = 'Successfully added ' . count($created) . ' entries to stock.';
            if (count($ignoredImeis) > 0) {
                $message .= ' Skipped ' . count($ignoredImeis) . ' duplicate IMEIs.';
            }

            return response()->json([
                'message' => $message,
                'ignored_imeis' => $ignoredImeis,
                'adjustments' => $created
            ], 201);
        });
        } catch (\RuntimeException $ex) {
            $decoded = json_decode($ex->getMessage(), true);
            if (is_array($decoded) && isset($decoded['ignored_imeis'])) {
                return response()->json($decoded, 200);
            }
            throw $ex;
        }
    }

    /** Helper for bulkStore */
    private function getOrCreateProduct($item, $imei = null)
    {
        $productId = $item['product_id'] ?? null;

        if (!empty($item['is_new']) && $item['is_new']) {
            // Safety check: Prevent duplicate creation if a product with the same name already exists
            $existingProduct = Product::where('name', $item['new_product_name'])->first();
            if ($existingProduct) {
                return $existingProduct->id;
            }

            $product = Product::create([
                'category_id'    => $item['category_id'],
                'name'           => $item['new_product_name'],
                'sku'            => Product::generateSku($item['new_product_name']),
                'imei'           => $imei, // Set specific IMEI if provided
                'purchase_price' => $item['unit_price'] ?? 0,
                'selling_price'  => $item['selling_price'] ?? 0,
                'min_selling_price' => $item['min_selling_price'] ?? 0,
                'max_selling_price' => $item['max_selling_price'] ?? 0,
                'wholeseller_price' => $item['wholeseller_price'] ?? 0,
                'incentive_amount'  => $item['incentive_amount'] ?? 0,
                'attributes'     => [
                    'ram'     => $item['ram'] ?? null,
                    'storage' => $item['storage'] ?? null,
                    'color'   => $item['color'] ?? null,
                ]
            ]);
            $productId = $product->id;
        }

        return $productId;
    }

    /**
     * Update a stock adjustment
     */
    public function update(Request $request, $id)
    {
        $adjustment = StockAdjustment::findOrFail($id);
        
        $validated = $request->validate([
            'quantity'        => 'sometimes|required|integer|min:1',
            'purchase_price'  => 'nullable|numeric|min:0',
            'notes'           => 'nullable|string|max:500',
            'adjustment_date' => 'sometimes|required|date',
            'reason'          => 'sometimes|required|string|max:100',
        ]);

        return DB::transaction(function () use ($adjustment, $validated) {
            // Handle quantity change
            if (isset($validated['quantity']) && $validated['quantity'] != $adjustment->quantity) {
                $diff = $validated['quantity'] - $adjustment->quantity;
                
                if ($adjustment->type === 'add') {
                    // If we added 10, now we want to add 12 (diff = 2) -> Add 2
                    // If we added 10, now we want to add 8 (diff = -2) -> Remove 2
                    if ($diff > 0) {
                        Inventory::addStock($adjustment->shop_id, $adjustment->product_id, abs($diff));
                    } else {
                        Inventory::removeStock($adjustment->shop_id, $adjustment->product_id, abs($diff));
                    }
                } else {
                    // Logic for 'remove' type adjustments...
                    if ($diff > 0) {
                         // Removed 10, now want to remove 12 (diff = 2) -> Remove 2 more
                         Inventory::removeStock($adjustment->shop_id, $adjustment->product_id, abs($diff));
                    } else {
                         // Removed 10, now want to remove 8 (diff = -2) -> Add 2 back
                         Inventory::addStock($adjustment->shop_id, $adjustment->product_id, abs($diff));
                    }
                }
            }

            $adjustment->update($validated);
            return response()->json($adjustment->load(['product', 'shop', 'user']));
        });
    }

    /**
     * Delete a stock adjustment (Undo)
     */
    public function destroy($id)
    {
        $adjustment = StockAdjustment::findOrFail($id);

        return DB::transaction(function () use ($adjustment) {
            // Reverse the impact on inventory
            if ($adjustment->type === 'add') {
                Inventory::removeStock($adjustment->shop_id, $adjustment->product_id, $adjustment->quantity);
            } else {
                Inventory::addStock($adjustment->shop_id, $adjustment->product_id, $adjustment->quantity);
            }

            $adjustment->delete();
            return response()->json(['message' => 'Adjustment deleted and inventory reverted.']);
        });
    }

    /**
     * Bulk delete stock adjustments
     */
    public function bulkDestroy(Request $request)
    {
        $request->validate([
            'ids' => 'required|array|min:1',
            'ids.*' => 'exists:stock_adjustments,id'
        ]);

        return DB::transaction(function () use ($request) {
            $adjustments = StockAdjustment::whereIn('id', $request->ids)->get();
            $count = 0;

            foreach ($adjustments as $adjustment) {
                if ($adjustment->type === 'add') {
                    Inventory::removeStock($adjustment->shop_id, $adjustment->product_id, $adjustment->quantity);
                } else {
                    Inventory::addStock($adjustment->shop_id, $adjustment->product_id, $adjustment->quantity);
                }
                $adjustment->delete();
                $count++;
            }

            return response()->json(['message' => "Successfully deleted $count adjustments and reverted inventory."]);
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

    /**
     * Get a report of duplicate IMEIs in the system
     */
    public function duplicatesReport(Request $request)
    {
        $duplicates = DB::table('purchase_items')
            ->select('imei', DB::raw('COUNT(*) as count'))
            ->whereNotNull('imei')
            ->where('imei', '!=', '')
            ->groupBy('imei')
            ->having('count', '>', 1)
            ->get();

        $details = [];
        foreach ($duplicates as $dup) {
            $items = \App\Models\PurchaseItem::with(['product', 'invoice.shop'])
                ->where('imei', $dup->imei)
                ->get();
            
            $details[] = [
                'imei' => $dup->imei,
                'count' => $dup->count,
                'occurrences' => $items->map(fn($i) => [
                    'id' => $i->id,
                    'product' => $i->product->name ?? 'Unknown',
                    'shop' => $i->invoice->shop->name ?? 'Unknown',
                    'date' => $i->invoice->purchase_date ?? 'Unknown',
                    'invoice' => $i->invoice->invoice_no ?? 'Unknown'
                ])
            ];
        }

        return response()->json($details);
    }

    /**
     * Clear all duplicate IMEIs, keeping only the first one
     */
    public function clearDuplicates(Request $request)
    {
        return DB::transaction(function () {
            $duplicates = DB::table('purchase_items')
                ->select('imei', DB::raw('MIN(id) as keep_id'), DB::raw('COUNT(*) as count'))
                ->whereNotNull('imei')
                ->where('imei', '!=', '')
                ->groupBy('imei')
                ->having('count', '>', 1)
                ->get();

            $deletedCount = 0;
            foreach ($duplicates as $dup) {
                // Get all occurrences except the one we keep
                $toDelete = \App\Models\PurchaseItem::with('invoice')
                    ->where('imei', $dup->imei)
                    ->where('id', '!=', $dup->keep_id)
                    ->get();

                foreach ($toDelete as $item) {
                    if (!$item->invoice) continue;

                    // Reduce inventory stock
                    Inventory::removeStock($item->invoice->shop_id, $item->product_id, 1);
                    
                    // Also find and delete the corresponding StockAdjustment if it exists
                    StockAdjustment::where('product_id', $item->product_id)
                        ->where('shop_id', $item->invoice->shop_id)
                        ->where('reason', 'opening_stock')
                        ->where('quantity', 1)
                        ->where('adjustment_date', $item->invoice->purchase_date)
                        ->orderBy('id', 'desc')
                        ->limit(1)
                        ->delete();

                    $item->delete();
                    $deletedCount++;
                }
            }

            return response()->json([
                'message' => "Successfully cleared $deletedCount duplicate IMEI entries.",
                'deleted_count' => $deletedCount
            ]);
        });
    }

    /**
     * Clear all stocks specifically for New Mobiles.
     * This wipes all stock adjustments, purchase invoices, and sale invoices.
     */
    public function clearAllStocks(Request $request)
    {
        $request->validate([
            'pin' => 'required|string'
        ]);

        if ($request->pin !== '71727378') {
            return response()->json(['message' => 'Invalid PIN provided. Access denied.'], 403);
        }

        DB::transaction(function () {
            // Disable foreign key checks temporarily to allow aggressive cleanup
            DB::statement('SET FOREIGN_KEY_CHECKS=0;');

            // 1. Wipe Stock Adjustments and Inventory counts
            DB::table('stock_adjustments')->truncate();
            DB::table('inventory')->truncate();

            // 2. Wipe Purchase Invoices and Items (Supplier Bills)
            DB::table('purchase_items')->truncate();
            DB::table('purchase_invoices')->truncate();

            // 3. Wipe Sale Invoices and Items (Customer Bills)
            DB::table('sale_items')->truncate();
            DB::table('sale_invoices')->truncate();

            // 4. Delete ledger transactions specifically linked to Purchase/Sale
            \App\Models\Transaction::whereIn('entity_type', [
                'App\Models\PurchaseInvoice', 
                'App\Models\SaleInvoice'
            ])->delete();

            // Re-enable foreign key checks
            DB::statement('SET FOREIGN_KEY_CHECKS=1;');

            // 5. Recalculate and Sync all Entity Balances to reflect the wiped bills
            $entityService = app(\App\Services\EntityService::class);
            $entityService->syncAll();
        });

        return response()->json(['message' => 'All New Mobile stocks and related bills have been permanently cleared!']);
    }
}
