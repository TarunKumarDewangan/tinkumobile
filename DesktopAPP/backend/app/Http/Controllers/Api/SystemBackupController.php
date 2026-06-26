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
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Carbon\Carbon;

class SystemBackupController extends Controller
{
    public function backup(Request $request)
    {
        if (!$request->user()->hasFullAccess()) return response()->json(['message' => 'Unauthorized'], 403);

        $data = [
            'type'              => 'FULL_SYSTEM_BACKUP',
            'version'           => '1.3',
            'timestamp'         => now()->toDateTimeString(),
            'categories'        => Category::all(),
            'suppliers'         => Supplier::all(),
            'customers'         => Customer::all(),
            'retailers'         => \App\Models\Retailer::all(),
            'employees'         => \App\Models\Employee::all(),
            'expense_categories'=> \App\Models\ExpenseCategory::all(),
            'entities'          => \App\Models\Entity::all(),
            'entity_balances'   => \App\Models\EntityBalance::all(),
            'ledgers'           => \App\Models\Ledger::all(),
            'products'          => Product::withTrashed()->get(),
            'purchase_invoices' => PurchaseInvoice::with('items')->get(),
            'sale_invoices'     => SaleInvoice::with(['items', 'giftItems'])->get(),
            'repair_requests'   => \App\Models\RepairRequest::all(),
            'airtel_drops'      => \App\Models\AirtelDrop::all(),
            'airtel_recoveries' => \App\Models\AirtelRecovery::all(),
            'loans'             => \App\Models\Loan::all(),
            'loan_payments'     => \App\Models\LoanPayment::all(),
            'salary_payments'   => \App\Models\SalaryPayment::all(),
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
        if (!$request->user()->hasFullAccess()) return response()->json(['message' => 'Only the owner or administrator can restore system backups'], 403);

        $request->validate([
            'backup_file' => 'required|file|max:51200|mimetypes:application/json,text/plain'
        ]);

        // Acquire an exclusive lock — prevents two simultaneous restores from corrupting data
        $lock = Cache::lock('system_restore', 600);
        if (!$lock->get()) {
            return response()->json(['message' => 'A system restore is already in progress. Please wait.'], 429);
        }

        $jsonContent = file_get_contents($request->file('backup_file')->getRealPath());
        $data = json_decode($jsonContent, true);

        if ($data === null) {
            return response()->json(['message' => 'Invalid JSON in backup file.'], 422);
        }

        if (!isset($data['type']) || $data['type'] !== 'FULL_SYSTEM_BACKUP') {
            return response()->json(['message' => 'Invalid system backup file format.'], 422);
        }

        // Version compatibility check: warn if older backup version is used
        $supportedVersion = '1.2';
        $fileVersion = $data['version'] ?? '1.0';
        if (version_compare($fileVersion, $supportedVersion) < 0) {
            return response()->json(['message' => "Unsupported backup version ($fileVersion). Minimum supported version: $supportedVersion. Please generate a fresh backup first."], 422);
        }

        try {
            DB::beginTransaction();
            Schema::disableForeignKeyConstraints();

            // Sequence matters for deletion (reverse order of dependencies)
            DB::table('ledgers')->delete();
            DB::table('transactions')->delete();
            DB::table('salary_payments')->delete();
            DB::table('loan_payments')->delete();
            DB::table('loans')->delete();
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
            DB::table('entity_balances')->delete();
            DB::table('entities')->delete();
            DB::table('expense_categories')->delete();
            DB::table('employees')->delete();
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
                    'submitted_date', 'estimated_delivery_date', 'actual_delivery_date', 'balance_received_at', 'cost_paid_at',
                    'disbursal_date', 'payment_date'
                ];
                foreach ($item as $key => $value) {
                    if (in_array($key, $dateFields) || str_ends_with($key, '_at') || str_ends_with($key, '_date')) {
                        if ($value) {
                            try {
                                $item[$key] = Carbon::parse($value)->format('Y-m-d H:i:s');
                            } catch (\Exception $e) {
                                // If date parsing fails, set to null to avoid DB constraint violations
                                $item[$key] = null;
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
            if (!empty($data['employees'])) DB::table('employees')->insert(array_map($cleanItem, $data['employees']));
            if (!empty($data['expense_categories'])) DB::table('expense_categories')->insert(array_map($cleanItem, $data['expense_categories']));

            // 2. Entities & Balances
            if (!empty($data['entities'])) DB::table('entities')->insert(array_map($cleanItem, $data['entities']));
            if (!empty($data['entity_balances'])) DB::table('entity_balances')->insert(array_map($cleanItem, $data['entity_balances']));

            // 3. Products
            if (!empty($data['products'])) {
                $products = array_map($cleanItem, $data['products']);
                foreach (array_chunk($products, 500) as $chunk) DB::table('products')->insert($chunk);
            }

            // 4. Purchases — batch insert invoices + items
            if (!empty($data['purchase_invoices'])) {
                $allInvoices = [];
                $allItems = [];
                foreach ($data['purchase_invoices'] as $inv) {
                    $items = $inv['items'] ?? [];
                    unset($inv['items'], $inv['supplier'], $inv['user']);
                    $allInvoices[] = $cleanItem($inv);
                    foreach (($items ?: []) as $it) $allItems[] = $cleanItem($it);
                }
                foreach (array_chunk($allInvoices, 500) as $chunk) DB::table('purchase_invoices')->insert($chunk);
                foreach (array_chunk($allItems, 500) as $chunk) DB::table('purchase_items')->insert($chunk);
            }

            // 5. Sales — batch insert invoices + items + gifts
            if (!empty($data['sale_invoices'])) {
                $allInvoices = [];
                $allItems = [];
                $allGifts = [];
                foreach ($data['sale_invoices'] as $inv) {
                    $items = $inv['items'] ?? [];
                    $gifts = $inv['gift_items'] ?? [];
                    unset($inv['items'], $inv['gift_items'], $inv['customer'], $inv['user'], $inv['shop']);
                    $allInvoices[] = $cleanItem($inv);
                    foreach (($items ?: []) as $it) $allItems[] = $cleanItem($it);
                    foreach (($gifts ?: []) as $g) $allGifts[] = $cleanItem($g);
                }
                foreach (array_chunk($allInvoices, 500) as $chunk) DB::table('sale_invoices')->insert($chunk);
                foreach (array_chunk($allItems, 500) as $chunk) DB::table('sale_items')->insert($chunk);
                foreach (array_chunk($allGifts, 500) as $chunk) DB::table('sale_gift_items')->insert($chunk);
            }

            // 6. Repairs & Airtel
            if (!empty($data['repair_requests'])) DB::table('repair_requests')->insert(array_map($cleanItem, $data['repair_requests']));
            if (!empty($data['airtel_drops'])) DB::table('airtel_drops')->insert(array_map($cleanItem, $data['airtel_drops']));
            if (!empty($data['airtel_recoveries'])) DB::table('airtel_recoveries')->insert(array_map($cleanItem, $data['airtel_recoveries']));

            // 7. Loans & Salaries
            if (!empty($data['loans'])) DB::table('loans')->insert(array_map($cleanItem, $data['loans']));
            if (!empty($data['loan_payments'])) DB::table('loan_payments')->insert(array_map($cleanItem, $data['loan_payments']));
            if (!empty($data['salary_payments'])) DB::table('salary_payments')->insert(array_map($cleanItem, $data['salary_payments']));

            // 8. Inventory & Adjustments
            if (!empty($data['inventories'])) DB::table('inventory')->insert(array_map($cleanItem, $data['inventories']));
            if (!empty($data['stock_adjustments'])) DB::table('stock_adjustments')->insert(array_map($cleanItem, $data['stock_adjustments']));

            // 9. Transactions
            if (!empty($data['transactions'])) {
                $transactions = array_map($cleanItem, $data['transactions']);
                foreach (array_chunk($transactions, 500) as $chunk) DB::table('transactions')->insert($chunk);
            }

            Schema::enableForeignKeyConstraints();
            ActivityLog::log('FULL_SYSTEM_RESTORE', null, 'Performed a full system data restore from sync file.');
            DB::commit();

            // ── Post-commit: Rebuild ledger and balances (outside transaction) ──
            // This avoids massive transaction log growth and timeout risks
            try {
                \App\Models\AirtelDrop::chunk(100, function ($drops) {
                    foreach ($drops as $drop) $drop->postToLedger();
                });
                \App\Models\RepairRequest::chunk(100, function ($repairs) {
                    foreach ($repairs as $repair) $repair->postToLedger();
                });
                \App\Models\SaleInvoice::chunk(100, function ($sales) {
                    foreach ($sales as $sale) $sale->postToLedger();
                });
                \App\Models\PurchaseInvoice::chunk(100, function ($purchases) {
                    foreach ($purchases as $purchase) $purchase->postToLedger();
                });
                \App\Models\Transaction::chunk(100, function ($transactions) {
                    foreach ($transactions as $transaction) $transaction->postToLedger();
                });
                app(\App\Services\EntityService::class)->syncAll();
            } catch (\Exception $e) {
                // Ledger rebuild failure is non-fatal — data is restored, ledger can be rebuilt manually
                \Log::error('Post-restore ledger rebuild failed: ' . $e->getMessage());
            }

            return response()->json(['message' => 'Full system sync completed successfully! All data has been replaced.']);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Sync failed: ' . $e->getMessage()], 500);
        } finally {
            // Always re-enable FK constraints, even on timeout or fatal error
            try { Schema::enableForeignKeyConstraints(); } catch (\Exception $e) {}
            // Always release the lock
            $lock->release();
        }
    }
}
