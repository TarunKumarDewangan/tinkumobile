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
            'version'           => '1.1',
            'timestamp'         => now()->toDateTimeString(),
            'categories'        => Category::all(),
            'suppliers'         => Supplier::all(),
            'customers'         => Customer::all(),
            'retailers'         => \App\Models\Retailer::all(),
            'products'          => Product::withTrashed()->get(),
            'purchase_invoices' => PurchaseInvoice::with('items')->get(),
            'sale_invoices'     => SaleInvoice::with(['items', 'giftItems'])->get(),
            'repair_requests'   => \App\Models\RepairRequest::all(),
            'airtel_drops'      => \App\Models\AirtelDrop::all(),
            'airtel_recoveries' => \App\Models\AirtelRecovery::all(),
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
            DB::table('airtel_recoveries')->delete();
            DB::table('airtel_drops')->delete();
            DB::table('repair_requests')->delete();
            DB::table('sale_gift_items')->delete();
            DB::table('sale_items')->delete();
            DB::table('sale_invoices')->delete();
            DB::table('purchase_items')->delete();
            DB::table('purchase_invoices')->delete();
            DB::table('inventory')->delete();
            DB::table('stock_adjustments')->delete();
            DB::table('products')->delete();
            DB::table('retailers')->delete();
            DB::table('customers')->delete();
            DB::table('suppliers')->delete();
            DB::table('categories')->delete();

            $cleanItem = function($item) {
                if (!$item) return $item;
                $dateFields = [
                    'created_at', 'updated_at', 'deleted_at', 
                    'purchase_date', 'received_at', 'sale_date', 
                    'adjustment_date', 'date', 'expected_delivery_date',
                    'transaction_date', 'dob', 'anniversary_date',
                    'refill_date', 'recovered_at', 'next_recovery_date',
                    'submitted_date', 'estimated_delivery_date', 'actual_delivery_date', 'balance_received_at', 'cost_paid_at'
                ];
                foreach ($item as $key => $value) {
                    if (in_array($key, $dateFields) || str_ends_with($key, '_at') || str_ends_with($key, '_date')) {
                        if ($value) {
                            try {
                                $item[$key] = Carbon::parse($value)->format('Y-m-d H:i:s');
                            } catch (\Exception $e) {
                                // Fallback or ignore
                            }
                        }
                    }
                }
                if (isset($item['attributes']) && is_array($item['attributes'])) {
                    $item['attributes'] = json_encode($item['attributes']);
                }
                if (isset($item['issue_description']) && is_array($item['issue_description'])) {
                    $item['issue_description'] = json_encode($item['issue_description']);
                }
                return $item;
            };

            // 1. Foundation Tables
            if (!empty($data['categories'])) DB::table('categories')->insert(array_map($cleanItem, $data['categories']));
            if (!empty($data['suppliers'])) DB::table('suppliers')->insert(array_map($cleanItem, $data['suppliers']));
            if (!empty($data['customers'])) DB::table('customers')->insert(array_map($cleanItem, $data['customers']));
            if (!empty($data['retailers'])) DB::table('retailers')->insert(array_map($cleanItem, $data['retailers']));

            // 2. Products
            if (!empty($data['products'])) {
                $products = array_map($cleanItem, $data['products']);
                foreach (array_chunk($products, 500) as $chunk) DB::table('products')->insert($chunk);
            }

            // 3. Purchases
            if (!empty($data['purchase_invoices'])) {
                foreach ($data['purchase_invoices'] as $inv) {
                    $items = $inv['items'] ?? [];
                    unset($inv['items'], $inv['supplier'], $inv['user']);
                    DB::table('purchase_invoices')->insert($cleanItem($inv));
                    if (!empty($items)) DB::table('purchase_items')->insert(array_map($cleanItem, $items));
                }
            }

            // 4. Sales
            if (!empty($data['sale_invoices'])) {
                foreach ($data['sale_invoices'] as $inv) {
                    $items = $inv['items'] ?? [];
                    $gifts = $inv['gift_items'] ?? [];
                    unset($inv['items'], $inv['gift_items'], $inv['customer'], $inv['user'], $inv['shop']);
                    DB::table('sale_invoices')->insert($cleanItem($inv));
                    if (!empty($items)) DB::table('sale_items')->insert(array_map($cleanItem, $items));
                    if (!empty($gifts)) DB::table('sale_gift_items')->insert(array_map($cleanItem, $gifts));
                }
            }

            // 5. Repairs
            if (!empty($data['repair_requests'])) {
                DB::table('repair_requests')->insert(array_map($cleanItem, $data['repair_requests']));
            }

            // 6. Airtel Data
            if (!empty($data['airtel_drops'])) {
                DB::table('airtel_drops')->insert(array_map($cleanItem, $data['airtel_drops']));
            }
            if (!empty($data['airtel_recoveries'])) {
                DB::table('airtel_recoveries')->insert(array_map($cleanItem, $data['airtel_recoveries']));
            }

            // 7. Inventory & Adjustments
            if (!empty($data['inventories'])) DB::table('inventory')->insert(array_map($cleanItem, $data['inventories']));
            if (!empty($data['stock_adjustments'])) DB::table('stock_adjustments')->insert(array_map($cleanItem, $data['stock_adjustments']));

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
