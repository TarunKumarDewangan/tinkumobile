<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Supplier;
use App\Models\Customer;
use App\Models\Product;
use App\Models\PurchaseInvoice;
use App\Models\PurchaseItem;
use App\Models\SaleInvoice;
use App\Models\SaleItem;
use App\Models\SaleGiftItem;
use App\Models\Inventory;
use App\Models\StockAdjustment;
use App\Models\Transaction;
use App\Models\ActivityLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Carbon\Carbon;

class SystemBackupController extends Controller
{
    public function export(Request $request)
    {
        if (!$request->user()->isOwner()) return response()->json(['message' => 'Unauthorized'], 403);

        $data = [
            'type'              => 'FULL_SYSTEM_BACKUP',
            'version'           => '1.0',
            'timestamp'         => now()->toDateTimeString(),
            'categories'        => Category::all(),
            'suppliers'         => Supplier::all(),
            'customers'         => Customer::all(),
            'products'          => Product::withTrashed()->get(),
            'purchase_invoices' => PurchaseInvoice::with('items')->get(),
            'sale_invoices'     => SaleInvoice::with(['items', 'giftItems'])->get(),
            'inventories'       => Inventory::all(),
            'stock_adjustments' => StockAdjustment::all(),
            'transactions'      => Transaction::all(),
        ];

        $filename = "tinku_mobiles_full_sync_" . date('Ymd_His') . ".json";
        
        return response()->json($data)
            ->header('Content-Disposition', "attachment; filename=\"$filename\"");
    }

    public function import(Request $request)
    {
        if (!$request->user()->isOwner()) return response()->json(['message' => 'Only the owner can restore system backups'], 403);

        $request->validate([
            'backup_file' => 'required|file'
        ]);

        $jsonContent = file_get_contents($request->file('backup_file')->getRealPath());
        $data = json_decode($jsonContent, true);

        if (!isset($data['type']) || $data['type'] !== 'FULL_SYSTEM_BACKUP') {
            return response()->json(['message' => 'Invalid system backup file format.'], 422);
        }

        try {
            DB::beginTransaction();
            Schema::disableForeignKeyConstraints();

            // Sequence matters for deletion (reverse order of dependencies)
            DB::table('transactions')->delete();
            DB::table('sale_gift_items')->delete();
            DB::table('sale_items')->delete();
            DB::table('sale_invoices')->delete();
            DB::table('purchase_items')->delete();
            DB::table('purchase_invoices')->delete();
            DB::table('inventory')->delete();
            DB::table('stock_adjustments')->delete();
            DB::table('products')->delete();
            DB::table('customers')->delete();
            DB::table('suppliers')->delete();
            DB::table('categories')->delete();

            $formatDate = function($dateString) {
                if (!$dateString) return null;
                try { return Carbon::parse($dateString)->format('Y-m-d H:i:s'); } catch (\Exception $e) { return null; }
            };

            // 1. Categories
            if (!empty($data['categories'])) DB::table('categories')->insert($data['categories']);

            // 2. Suppliers
            if (!empty($data['suppliers'])) DB::table('suppliers')->insert($data['suppliers']);

            // 3. Customers
            if (!empty($data['customers'])) DB::table('customers')->insert($data['customers']);

            // 4. Products
            if (!empty($data['products'])) {
                foreach ($data['products'] as &$p) {
                    if (isset($p['attributes']) && is_array($p['attributes'])) $p['attributes'] = json_encode($p['attributes']);
                    if (isset($p['created_at'])) $p['created_at'] = $formatDate($p['created_at']);
                    if (isset($p['updated_at'])) $p['updated_at'] = $formatDate($p['updated_at']);
                    if (isset($p['deleted_at'])) $p['deleted_at'] = $formatDate($p['deleted_at']);
                }
                foreach (array_chunk($data['products'], 500) as $chunk) DB::table('products')->insert($chunk);
            }

            // 5. Purchases
            if (!empty($data['purchase_invoices'])) {
                foreach ($data['purchase_invoices'] as $inv) {
                    $items = $inv['items'] ?? [];
                    unset($inv['items']);
                    // Format dates
                    if (isset($inv['purchase_date'])) $inv['purchase_date'] = $formatDate($inv['purchase_date']);
                    if (isset($inv['received_at'])) $inv['received_at'] = $formatDate($inv['received_at']);
                    if (isset($inv['created_at'])) $inv['created_at'] = $formatDate($inv['created_at']);
                    if (isset($inv['updated_at'])) $inv['updated_at'] = $formatDate($inv['updated_at']);
                    
                    DB::table('purchase_invoices')->insert($inv);
                    
                    foreach ($items as &$item) {
                        if (isset($item['created_at'])) $item['created_at'] = $formatDate($item['created_at']);
                        if (isset($item['updated_at'])) $item['updated_at'] = $formatDate($item['updated_at']);
                    }
                    if (!empty($items)) DB::table('purchase_items')->insert($items);
                }
            }

            // 6. Sales
            if (!empty($data['sale_invoices'])) {
                foreach ($data['sale_invoices'] as $inv) {
                    $items = $inv['items'] ?? [];
                    $gifts = $inv['gift_items'] ?? [];
                    unset($inv['items'], $inv['gift_items']);
                    
                    if (isset($inv['sale_date'])) $inv['sale_date'] = $formatDate($inv['sale_date']);
                    if (isset($inv['created_at'])) $inv['created_at'] = $formatDate($inv['created_at']);
                    if (isset($inv['updated_at'])) $inv['updated_at'] = $formatDate($inv['updated_at']);
                    
                    DB::table('sale_invoices')->insert($inv);
                    
                    foreach ($items as &$item) {
                        if (isset($item['created_at'])) $item['created_at'] = $formatDate($item['created_at']);
                        if (isset($item['updated_at'])) $item['updated_at'] = $formatDate($item['updated_at']);
                    }
                    if (!empty($items)) DB::table('sale_items')->insert($items);

                    foreach ($gifts as &$gift) {
                        if (isset($gift['created_at'])) $gift['created_at'] = $formatDate($gift['created_at']);
                        if (isset($gift['updated_at'])) $gift['updated_at'] = $formatDate($gift['updated_at']);
                    }
                    if (!empty($gifts)) DB::table('sale_gift_items')->insert($gifts);
                }
            }

            // 7. Inventory & Adjustments
            if (!empty($data['inventories'])) DB::table('inventory')->insert($data['inventories']);
            if (!empty($data['stock_adjustments'])) {
                foreach ($data['stock_adjustments'] as &$adj) {
                    if (isset($adj['adjustment_date'])) $adj['adjustment_date'] = $formatDate($adj['adjustment_date']);
                    if (isset($adj['created_at'])) $adj['created_at'] = $formatDate($adj['created_at']);
                    if (isset($adj['updated_at'])) $adj['updated_at'] = $formatDate($adj['updated_at']);
                }
                DB::table('stock_adjustments')->insert($data['stock_adjustments']);
            }

            // 8. Transactions
            if (!empty($data['transactions'])) {
                foreach ($data['transactions'] as &$tx) {
                    if (isset($tx['date'])) $tx['date'] = $formatDate($tx['date']);
                    if (isset($tx['created_at'])) $tx['created_at'] = $formatDate($tx['created_at']);
                    if (isset($tx['updated_at'])) $tx['updated_at'] = $formatDate($tx['updated_at']);
                }
                foreach (array_chunk($data['transactions'], 500) as $chunk) DB::table('transactions')->insert($chunk);
            }

            Schema::enableForeignKeyConstraints();
            ActivityLog::log('FULL_SYSTEM_RESTORE', null, 'Performed a full system data restore from sync file.');
            DB::commit();

            return response()->json(['message' => 'Full system sync completed successfully! All data has been replaced.']);
        } catch (\Exception $e) {
            DB::rollBack();
            Schema::enableForeignKeyConstraints();
            return response()->json(['message' => 'Sync failed: ' . $e->getMessage()], 500);
        }
    }
}
