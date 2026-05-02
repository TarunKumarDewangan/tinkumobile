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
    public function backup(Request $request)
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

    public function restoreBackup(Request $request)
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

            $cleanItem = function($item) {
                if (!$item) return $item;
                $dateFields = ['created_at', 'updated_at', 'deleted_at', 'purchase_date', 'received_at', 'sale_date', 'adjustment_date', 'date', 'expected_delivery_date'];
                foreach ($dateFields as $field) {
                    if (isset($item[$field]) && $item[$field]) {
                        try {
                            $item[$field] = Carbon::parse($item[$field])->format('Y-m-d H:i:s');
                        } catch (\Exception $e) {
                            $item[$field] = null;
                        }
                    }
                }
                if (isset($item['attributes']) && is_array($item['attributes'])) {
                    $item['attributes'] = json_encode($item['attributes']);
                }
                return $item;
            };

            // 1. Categories
            if (!empty($data['categories'])) {
                $categories = array_map($cleanItem, $data['categories']);
                DB::table('categories')->insert($categories);
            }

            // 2. Suppliers
            if (!empty($data['suppliers'])) {
                $suppliers = array_map($cleanItem, $data['suppliers']);
                DB::table('suppliers')->insert($suppliers);
            }

            // 3. Customers
            if (!empty($data['customers'])) {
                $customers = array_map($cleanItem, $data['customers']);
                DB::table('customers')->insert($customers);
            }

            // 4. Products
            if (!empty($data['products'])) {
                $products = array_map($cleanItem, $data['products']);
                foreach (array_chunk($products, 500) as $chunk) DB::table('products')->insert($chunk);
            }

            // 5. Purchases
            if (!empty($data['purchase_invoices'])) {
                foreach ($data['purchase_invoices'] as $inv) {
                    $items = $inv['items'] ?? [];
                    unset($inv['items'], $inv['supplier'], $inv['user']);
                    
                    DB::table('purchase_invoices')->insert($cleanItem($inv));
                    
                    $cleanedItems = array_map($cleanItem, $items);
                    if (!empty($cleanedItems)) DB::table('purchase_items')->insert($cleanedItems);
                }
            }

            // 6. Sales
            if (!empty($data['sale_invoices'])) {
                foreach ($data['sale_invoices'] as $inv) {
                    $items = $inv['items'] ?? [];
                    $gifts = $inv['gift_items'] ?? [];
                    unset($inv['items'], $inv['gift_items'], $inv['customer'], $inv['user'], $inv['shop']);
                    
                    DB::table('sale_invoices')->insert($cleanItem($inv));
                    
                    $cleanedItems = array_map($cleanItem, $items);
                    if (!empty($cleanedItems)) DB::table('sale_items')->insert($cleanedItems);

                    $cleanedGifts = array_map($cleanItem, $gifts);
                    if (!empty($cleanedGifts)) DB::table('sale_gift_items')->insert($cleanedGifts);
                }
            }

            // 7. Inventory & Adjustments
            if (!empty($data['inventories'])) {
                $inventories = array_map($cleanItem, $data['inventories']);
                DB::table('inventory')->insert($inventories);
            }
            if (!empty($data['stock_adjustments'])) {
                $adjustments = array_map($cleanItem, $data['stock_adjustments']);
                DB::table('stock_adjustments')->insert($adjustments);
            }

            // 8. Transactions
            if (!empty($data['transactions'])) {
                $transactions = array_map($cleanItem, $data['transactions']);
                foreach (array_chunk($transactions, 500) as $chunk) DB::table('transactions')->insert($chunk);
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
