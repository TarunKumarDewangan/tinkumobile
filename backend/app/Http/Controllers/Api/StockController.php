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
        if (!$request->user()->isOwner()) {
            return response()->json(['message' => 'Only the owner can restore backups'], 403);
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
            return response()->json(['message' => 'Restore failed: ' . $e->getMessage()], 500);
        }
    }
}
