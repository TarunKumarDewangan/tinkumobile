<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PurchaseItem;
use App\Models\Product;
use App\Models\Category;
use App\Models\Supplier;
use App\Models\Inventory;
use App\Models\StockAdjustment;
use App\Models\PurchaseInvoice;
use App\Models\SaleInvoice;
use App\Models\SaleItem;
use App\Models\ActivityLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class StockController extends Controller
{
    /**
     * Update the location of a specific stock item (PurchaseItem).
     */
    public function updateLocation(Request $request, $id)
    {
        // ... (existing code preserved)
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

    /**
     * Closing stock breakdown as of a given date (inclusive) — company/model/config/color/IMEI,
     * grouped the same way as the Model Wise Stock view. Uses the exact same quantity math as
     * dailyLedger()'s running closing_stock total (just <= date, per-product, instead of a
     * single aggregate) so the grand total here always matches the ledger's Closing badge.
     */
    public function closingStockDetail(Request $request)
    {
        $user   = $request->user();
        $shopId = $user->hasFullAccess() ? ($request->shop_id ?: null) : $user->shop_id;
        $date   = Carbon::parse($request->date ?? now())->toDateString();

        $newCatId = Category::mobileNewId();
        $oldCatId = Category::mobileOldId();
        $catIds   = array_values(array_filter([$newCatId, $oldCatId]));

        $purchasesIn = PurchaseItem::whereHas('invoice', function ($q) use ($shopId, $date) {
                $q->where('purchase_date', '<=', $date);
                if ($shopId) $q->where('shop_id', $shopId);
            })
            ->when(!empty($catIds), fn($q) => $q->whereHas('product', fn($p) => $p->whereIn('category_id', $catIds)))
            ->selectRaw('product_id, SUM(quantity) as qty')->groupBy('product_id')->pluck('qty', 'product_id');

        $adjAdd = StockAdjustment::where('type', 'add')->where('adjustment_date', '<=', $date)
            ->where('reason', '!=', 'opening_stock')
            ->when($shopId, fn($q) => $q->where('shop_id', $shopId))
            ->when(!empty($catIds), fn($q) => $q->whereHas('product', fn($p) => $p->whereIn('category_id', $catIds)))
            ->selectRaw('product_id, SUM(quantity) as qty')->groupBy('product_id')->pluck('qty', 'product_id');

        $adjRemove = StockAdjustment::where('type', 'remove')->where('adjustment_date', '<=', $date)
            ->when($shopId, fn($q) => $q->where('shop_id', $shopId))
            ->when(!empty($catIds), fn($q) => $q->whereHas('product', fn($p) => $p->whereIn('category_id', $catIds)))
            ->selectRaw('product_id, SUM(quantity) as qty')->groupBy('product_id')->pluck('qty', 'product_id');

        $salesOut = SaleItem::whereHas('invoice', function ($q) use ($shopId, $date) {
                $q->where('sale_date', '<=', $date)->where('is_cancelled', false);
                if ($shopId) $q->where('shop_id', $shopId);
            })
            ->when(!empty($catIds), fn($q) => $q->whereHas('product', fn($p) => $p->whereIn('category_id', $catIds)))
            ->selectRaw('product_id, SUM(quantity) as qty')->groupBy('product_id')->pluck('qty', 'product_id');

        $productIds = collect()
            ->merge($purchasesIn->keys())->merge($adjAdd->keys())
            ->merge($adjRemove->keys())->merge($salesOut->keys())
            ->unique()->values();

        $products = Product::with('brand:id,name', 'category:id,name')->whereIn('id', $productIds)->get()->keyBy('id');

        // Group the same way ModelWiseStock.jsx does client-side: brand + model + ram + storage + color.
        $groups = [];
        $grandTotal = 0;

        foreach ($productIds as $pid) {
            $product = $products[$pid] ?? null;
            if (!$product) continue;

            $stock = ($purchasesIn[$pid] ?? 0) + ($adjAdd[$pid] ?? 0) - ($adjRemove[$pid] ?? 0) - ($salesOut[$pid] ?? 0);

            // Old Mobile purchases add stock straight via Inventory::addStock(), bypassing
            // PurchaseItem/StockAdjustment entirely, so a handful of products can compute
            // negative here even though they're not really "out of stock". Still fold that
            // negative delta into the grand total (so it always matches dailyLedger()'s own
            // running closing_stock exactly) — just don't render a confusing negative row.
            $grandTotal += $stock;
            if ($stock <= 0) continue;

            $brand = $product->brand?->name ?: ($product->attributes['brand'] ?? '');
            $brand = trim($brand) ?: strtoupper(explode(' ', $product->name)[0] ?? 'OTHER');
            $brand = strtoupper($brand);

            $ram     = $product->attributes['ram'] ?? '';
            $storage = $product->attributes['storage'] ?? '';
            $color   = strtoupper(trim($product->attributes['color'] ?? ''));
            $imei    = $product->attributes['imei'] ?? $product->imei ?? null;

            $key = strtoupper($product->name) . '|' . $ram . '|' . $storage . '|' . $color;

            if (!isset($groups[$key])) {
                $groups[$key] = [
                    'company'  => $brand,
                    'model'    => strtoupper($product->name),
                    'ram'      => $ram,
                    'storage'  => $storage,
                    'color'    => $color,
                    'category' => $product->category?->name,
                    'imeis'    => [],
                    'pcs'      => 0,
                ];
            }

            $groups[$key]['pcs'] += $stock;
            if ($imei) $groups[$key]['imeis'][] = $imei;
        }

        $rows = array_values($groups);
        usort($rows, fn($a, $b) => $a['company'] <=> $b['company'] ?: $a['model'] <=> $b['model']);

        return response()->json([
            'date'  => $date,
            'rows'  => $rows,
            'total' => $grandTotal,
        ]);
    }

    /**
     * Daily Stock Ledger — running balance with purchases, sales, and adjustments per day.
     */
    public function dailyLedger(Request $request)
    {
        $user   = $request->user();
        $shopId = $user->hasFullAccess() ? ($request->shop_id ?: null) : $user->shop_id;

        $fromDate = $request->from_date ? Carbon::parse($request->from_date)->startOfDay() : Carbon::now()->subDays(29)->startOfDay();
        $toDate   = $request->to_date   ? Carbon::parse($request->to_date)->endOfDay()     : Carbon::now()->endOfDay();

        $newCatId = Category::mobileNewId();
        $oldCatId = Category::mobileOldId();
        $catIds   = array_values(array_filter([$newCatId, $oldCatId]));

        // ── Opening stock (all movements strictly before fromDate) ──────────
        $purchasesBefore = PurchaseItem::whereHas('invoice', function ($q) use ($shopId, $fromDate) {
                $q->where('purchase_date', '<', $fromDate->toDateString());
                if ($shopId) $q->where('shop_id', $shopId);
            })
            ->when(!empty($catIds), fn($q) => $q->whereHas('product', fn($p) => $p->whereIn('category_id', $catIds)))
            ->sum('quantity');

        $adjAddBefore    = StockAdjustment::where('type', 'add')->where('adjustment_date', '<', $fromDate->toDateString())
            ->where('reason', '!=', 'opening_stock') // opening_stock adjustments are already counted via their paired LEGACY_BAL PurchaseItem
            ->when($shopId, fn($q) => $q->where('shop_id', $shopId))
            ->when(!empty($catIds), fn($q) => $q->whereHas('product', fn($p) => $p->whereIn('category_id', $catIds)))
            ->sum('quantity');

        $adjRemoveBefore = StockAdjustment::where('type', 'remove')->where('adjustment_date', '<', $fromDate->toDateString())
            ->when($shopId, fn($q) => $q->where('shop_id', $shopId))
            ->when(!empty($catIds), fn($q) => $q->whereHas('product', fn($p) => $p->whereIn('category_id', $catIds)))
            ->sum('quantity');

        $salesBefore = SaleItem::whereHas('invoice', function ($q) use ($shopId, $fromDate) {
                $q->where('sale_date', '<', $fromDate->toDateString())->where('is_cancelled', false);
                if ($shopId) $q->where('shop_id', $shopId);
            })
            ->when(!empty($catIds), fn($q) => $q->whereHas('product', fn($p) => $p->whereIn('category_id', $catIds)))
            ->sum('quantity');

        $openingStock = (int)$purchasesBefore + (int)$adjAddBefore - (int)$adjRemoveBefore - (int)$salesBefore;

        // ── Per-day movements ────────────────────────────────────────────────
        $days     = [];
        $running  = $openingStock;
        $current  = $fromDate->copy();

        while ($current->lte($toDate)) {
            $dateStr = $current->toDateString();

            // Purchases IN
            $purchases = PurchaseItem::with(['product:id,name,purchase_price,selling_price', 'invoice:id,invoice_no,supplier_id,purchase_date'])
                ->whereHas('invoice', function ($q) use ($shopId, $dateStr) {
                    $q->where('purchase_date', $dateStr);
                    if ($shopId) $q->where('shop_id', $shopId);
                })
                ->when(!empty($catIds), fn($q) => $q->whereHas('product', fn($p) => $p->whereIn('category_id', $catIds)))
                ->get();

            // Sales OUT
            $sales = SaleItem::with([
                    'product:id,name,purchase_price',
                    'invoice:id,invoice_no,sale_date,customer_id',
                    'invoice.customer:id,name',
                ])
                ->whereHas('invoice', function ($q) use ($shopId, $dateStr) {
                    $q->where('sale_date', $dateStr)->where('is_cancelled', false);
                    if ($shopId) $q->where('shop_id', $shopId);
                })
                ->when(!empty($catIds), fn($q) => $q->whereHas('product', fn($p) => $p->whereIn('category_id', $catIds)))
                ->get();

            // Adjustments (excludes 'opening_stock' — those are already counted via their paired LEGACY_BAL PurchaseItem, see bulkStore())
            $adjustments = StockAdjustment::with('product:id,name,purchase_price')
                ->where('adjustment_date', $dateStr)
                ->where('reason', '!=', 'opening_stock')
                ->when($shopId, fn($q) => $q->where('shop_id', $shopId))
                ->when(!empty($catIds), fn($q) => $q->whereHas('product', fn($p) => $p->whereIn('category_id', $catIds)))
                ->get();

            $stockIn  = $purchases->sum('quantity')
                      + $adjustments->where('type', 'add')->sum('quantity');
            $stockOut = $sales->sum('quantity')
                      + $adjustments->where('type', 'remove')->sum('quantity');

            if ($stockIn === 0 && $stockOut === 0) {
                $current->addDay();
                continue;
            }

            $running += $stockIn - $stockOut;

            // Aggregate purchase value from purchase items
            $purchaseValue = $purchases->sum(fn($i) => $i->quantity * ($i->unit_price ?? $i->product?->purchase_price ?? 0));
            $saleRevenue   = $sales->sum(fn($i) => $i->quantity * ($i->unit_price ?? 0));
            // A purchase_price of 0 usually means the cost was never recorded (e.g. a bulk/
            // legacy opening-stock entry), not that the unit genuinely cost nothing. Treating
            // that as a real ₹0 cost would make the sale look like 100% profit, so those items
            // are excluded from cost/profit entirely rather than assumed free.
            $saleCost      = $sales->sum(fn($i) => ($i->product?->purchase_price ?? 0) > 0 ? $i->quantity * $i->product->purchase_price : 0);
            $profitableRevenue = $sales->sum(fn($i) => ($i->product?->purchase_price ?? 0) > 0 ? $i->quantity * ($i->unit_price ?? 0) : 0);

            $days[] = [
                'date'           => $dateStr,
                'opening_stock'  => $running - $stockIn + $stockOut,
                'stock_in'       => $stockIn,
                'stock_out'      => $stockOut,
                'closing_stock'  => $running,
                'purchase_value' => round($purchaseValue, 2),
                'sale_revenue'   => round($saleRevenue, 2),
                'sale_cost'      => round($saleCost, 2),
                'profit'         => round($profitableRevenue - $saleCost, 2),
                'purchases'      => $purchases->map(fn($i) => [
                    'product_name'   => $i->product?->name,
                    'quantity'       => $i->quantity,
                    'unit_price'     => $i->unit_price ?? $i->product?->purchase_price,
                    'total_value'    => $i->quantity * ($i->unit_price ?? $i->product?->purchase_price ?? 0),
                    'mop'            => $i->selling_price ?? $i->product?->selling_price,
                    'invoice_no'     => $i->invoice?->invoice_no,
                ])->values(),
                'sales' => $sales->map(function($i) {
                    $purchasePrice = $i->product?->purchase_price ?? 0;
                    return [
                        'product_name'   => $i->product?->name,
                        'quantity'       => $i->quantity,
                        'sale_price'     => $i->unit_price,
                        'purchase_price' => $i->product?->purchase_price,
                        'profit'         => $purchasePrice > 0 ? $i->quantity * (($i->unit_price ?? 0) - $purchasePrice) : null,
                        'customer_name'  => $i->invoice?->customer?->name ?? 'Walk-in',
                        'invoice_no'     => $i->invoice?->invoice_no,
                    ];
                })->values(),
                'adjustments' => $adjustments->map(fn($a) => [
                    'product_name' => $a->product?->name,
                    'quantity'     => $a->quantity,
                    'type'         => $a->type,
                    'reason'       => $a->reason,
                ])->values(),
            ];

            $current->addDay();
        }

        // Overall summary for the period
        $totalIn       = array_sum(array_column($days, 'stock_in'));
        $totalOut      = array_sum(array_column($days, 'stock_out'));
        $totalRevenue  = array_sum(array_column($days, 'sale_revenue'));
        $totalCost     = array_sum(array_column($days, 'sale_cost'));
        $totalProfit   = array_sum(array_column($days, 'profit'));
        $closingStock  = count($days) ? end($days)['closing_stock'] : $openingStock;

        return response()->json([
            'opening_stock' => $openingStock,
            'closing_stock' => $closingStock,
            'total_in'      => $totalIn,
            'total_out'     => $totalOut,
            'total_revenue' => round($totalRevenue, 2),
            'total_cost'    => round($totalCost, 2),
            'total_profit'  => round($totalProfit, 2),
            'days'          => $days,
        ]);
    }

    public function backup(Request $request)
    {
        $adjQuery = StockAdjustment::query();
        if ($request->start_date) $adjQuery->where('adjustment_date', '>=', $request->start_date);
        if ($request->end_date)   $adjQuery->where('adjustment_date', '<=', $request->end_date);

        $data = [
            'type'              => 'STOCK_BACKUP',
            'timestamp'         => now()->toDateTimeString(),
            'categories'        => Category::all(),
            'suppliers'         => Supplier::all(),
            'products'          => Product::withTrashed()->get(),
            'inventories'       => Inventory::all(),
            'stock_adjustments' => $adjQuery->get(),
        ];

        $filename = "stock_backup_" . ($request->start_date ? "{$request->start_date}_to_{$request->end_date}" : "full") . "_" . date('Ymd_His') . ".json";
        
        return response()->json($data)
            ->header('Content-Disposition', "attachment; filename=\"$filename\"");
    }

    public function restoreBackup(Request $request)
    {
        if (!$request->user()->hasFullAccess()) {
            return response()->json(['message' => 'Only the owner or administrator can restore backups'], 403);
        }

        $request->validate([
            'backup_file' => 'required|file|mimetypes:application/json,text/plain'
        ]);

        $file = $request->file('backup_file');
        $jsonContent = file_get_contents($file->getRealPath());
        $data = json_decode($jsonContent, true);

        $requiredKeys = ['categories', 'products', 'purchase_invoices', 'purchase_items', 'inventories'];
        foreach ($requiredKeys as $key) {
            if (!isset($data[$key])) {
                return response()->json(['message' => "Invalid backup file format. Missing key: $key"], 422);
            }
        }

        try {
            DB::beginTransaction();

            \Illuminate\Support\Facades\Schema::disableForeignKeyConstraints();

            // Clear existing tables
            DB::table('inventory')->delete();
            DB::table('stock_adjustments')->delete();
            DB::table('sale_items')->delete();
            DB::table('sale_invoices')->delete();
            DB::table('purchase_items')->delete();
            DB::table('purchase_invoices')->delete();
            DB::table('products')->delete();
            DB::table('suppliers')->delete();
            DB::table('categories')->delete();

            $formatDate = function($dateString) {
                if (!$dateString) return null;
                try {
                    return Carbon::parse($dateString)->format('Y-m-d H:i:s');
                } catch (\Exception $e) {
                    return null;
                }
            };

            $tables = [
                'categories'        => 'categories',
                'suppliers'         => 'suppliers',
                'products'          => 'products',
                'purchase_invoices' => 'purchase_invoices',
                'purchase_items'    => 'purchase_items',
                'sale_invoices'     => 'sale_invoices',
                'sale_items'        => 'sale_items',
                'stock_adjustments' => 'stock_adjustments',
                'inventories'       => 'inventory',
            ];

            foreach ($tables as $dataKey => $tableName) {
                if (!empty($data[$dataKey])) {
                    $items = $data[$dataKey];
                    foreach ($items as &$item) {
                        // General date formatting for all tables
                        if (isset($item['created_at'])) $item['created_at'] = $formatDate($item['created_at']);
                        if (isset($item['updated_at'])) $item['updated_at'] = $formatDate($item['updated_at']);
                        if (isset($item['deleted_at'])) $item['deleted_at'] = $formatDate($item['deleted_at']);
                        
                        // Table specific date fields
                        if ($tableName === 'purchase_invoices') {
                            if (isset($item['purchase_date'])) $item['purchase_date'] = $formatDate($item['purchase_date']);
                            if (isset($item['received_at'])) $item['received_at'] = $formatDate($item['received_at']);
                            if (isset($item['expected_delivery_date'])) $item['expected_delivery_date'] = $formatDate($item['expected_delivery_date']);
                        }
                        if ($tableName === 'sale_invoices' && isset($item['sale_date'])) $item['sale_date'] = $formatDate($item['sale_date']);
                        if ($tableName === 'stock_adjustments' && isset($item['adjustment_date'])) $item['adjustment_date'] = $formatDate($item['adjustment_date']);
                        
                        // JSON field handling
                        if (isset($item['attributes']) && is_array($item['attributes'])) {
                            $item['attributes'] = json_encode($item['attributes']);
                        }
                    }
                    foreach (array_chunk($items, 500) as $chunk) {
                        DB::table($tableName)->insert($chunk);
                    }
                }
            }

            \Illuminate\Support\Facades\Schema::enableForeignKeyConstraints();

            ActivityLog::log('RESTORE_INVENTORY_BACKUP', null, 'Restored full Inventory data from backup file.');

            DB::commit();

            return response()->json(['message' => 'Inventory backup restored successfully']);
        } catch (\Exception $e) {
            DB::rollBack();
            \Illuminate\Support\Facades\Schema::enableForeignKeyConstraints();
            return $this->errorResponse($e, 'Restore failed');
        }
    }
}
