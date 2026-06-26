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
            
            // New Sync tables
            'brands'            => \App\Models\Brand::all(),
            'old_mobile_purchases'=> \App\Models\OldMobilePurchase::all(),
            'recharge_purchases'=> DB::table('recharge_purchases')->get(),
            'recharge_sales'    => DB::table('recharge_sales')->get(),
            'sim_cards'         => DB::table('sim_cards')->get(),
            'gift_products'     => DB::table('gift_products')->get(),
            'gift_inventory'    => DB::table('gift_inventory')->get(),
            'follow_ups'        => \App\Models\FollowUp::all(),
            'employee_incentives'=> DB::table('employee_incentives')->get(),
            'company_offers'    => \App\Models\CompanyOffer::all(),
            'offer_fulfillments'=> DB::table('offer_fulfillments')->get(),
            'tasks'             => \App\Models\Task::all(),
            'task_updates'      => DB::table('task_updates')->get(),
            'emp_id_sequences'  => DB::table('emp_id_sequences')->get(),
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
            // Disable foreign keys BEFORE beginning the database transaction!
            Schema::disableForeignKeyConstraints();
            DB::beginTransaction();

            // Sequence matters for deletion (reverse order of dependencies)
            DB::table('task_updates')->delete();
            DB::table('tasks')->delete();
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
            DB::table('brands')->delete();
            
            DB::table('old_mobile_purchases')->delete();
            DB::table('recharge_purchases')->delete();
            DB::table('recharge_sales')->delete();
            DB::table('sim_cards')->delete();
            DB::table('gift_products')->delete();
            DB::table('gift_inventory')->delete();
            DB::table('follow_ups')->delete();
            DB::table('employee_incentives')->delete();
            DB::table('company_offers')->delete();
            DB::table('offer_fulfillments')->delete();
            DB::table('emp_id_sequences')->delete();

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
                    // Auto JSON encode any PHP arrays/objects to prevent array-to-string database conversion errors
                    if (is_array($value)) {
                        $item[$key] = json_encode($value);
                    }
                }
                return $item;
            };

            // 1. Foundation Tables
            $this->safeInsert('categories', array_map($cleanItem, $data['categories'] ?? []));
            $this->safeInsert('brands', array_map($cleanItem, $data['brands'] ?? []));
            $this->safeInsert('suppliers', array_map($cleanItem, $data['suppliers'] ?? []));
            $this->safeInsert('customers', array_map($cleanItem, $data['customers'] ?? []));
            $this->safeInsert('retailers', array_map($cleanItem, $data['retailers'] ?? []));
            $this->safeInsert('employees', array_map($cleanItem, $data['employees'] ?? []));
            $this->safeInsert('expense_categories', array_map($cleanItem, $data['expense_categories'] ?? []));

            // 2. Entities & Balances
            $this->safeInsert('entities', array_map($cleanItem, $data['entities'] ?? []));
            $this->safeInsert('entity_balances', array_map($cleanItem, $data['entity_balances'] ?? []));

            // 3. Products
            if (!empty($data['products'])) {
                $this->safeInsert('products', array_map($cleanItem, $data['products']));
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
                $this->safeInsert('purchase_invoices', $allInvoices);
                $this->safeInsert('purchase_items', $allItems);
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
                $this->safeInsert('sale_invoices', $allInvoices);
                $this->safeInsert('sale_items', $allItems);
                $this->safeInsert('sale_gift_items', $allGifts);
            }

            // 6. Repairs & Airtel
            $this->safeInsert('repair_requests', array_map($cleanItem, $data['repair_requests'] ?? []));
            $this->safeInsert('airtel_drops', array_map($cleanItem, $data['airtel_drops'] ?? []));
            $this->safeInsert('airtel_recoveries', array_map($cleanItem, $data['airtel_recoveries'] ?? []));

            // 7. Loans & Salaries
            $this->safeInsert('loans', array_map($cleanItem, $data['loans'] ?? []));
            $this->safeInsert('loan_payments', array_map($cleanItem, $data['loan_payments'] ?? []));
            $this->safeInsert('salary_payments', array_map($cleanItem, $data['salary_payments'] ?? []));

            // 8. Inventory & Adjustments
            $this->safeInsert('inventory', array_map($cleanItem, $data['inventories'] ?? []));
            $this->safeInsert('stock_adjustments', array_map($cleanItem, $data['stock_adjustments'] ?? []));

            // 9. Transactions
            $this->safeInsert('transactions', array_map($cleanItem, $data['transactions'] ?? []));

            // 10. New Sync Tables
            $this->safeInsert('old_mobile_purchases', array_map($cleanItem, $data['old_mobile_purchases'] ?? []));
            $this->safeInsert('recharge_purchases', array_map($cleanItem, $data['recharge_purchases'] ?? []));
            $this->safeInsert('recharge_sales', array_map($cleanItem, $data['recharge_sales'] ?? []));
            $this->safeInsert('sim_cards', array_map($cleanItem, $data['sim_cards'] ?? []));
            $this->safeInsert('gift_products', array_map($cleanItem, $data['gift_products'] ?? []));
            $this->safeInsert('gift_inventory', array_map($cleanItem, $data['gift_inventory'] ?? []));
            $this->safeInsert('follow_ups', array_map($cleanItem, $data['follow_ups'] ?? []));
            $this->safeInsert('employee_incentives', array_map($cleanItem, $data['employee_incentives'] ?? []));
            $this->safeInsert('company_offers', array_map($cleanItem, $data['company_offers'] ?? []));
            $this->safeInsert('offer_fulfillments', array_map($cleanItem, $data['offer_fulfillments'] ?? []));
            $this->safeInsert('tasks', array_map($cleanItem, $data['tasks'] ?? []));
            $this->safeInsert('task_updates', array_map($cleanItem, $data['task_updates'] ?? []));
            $this->safeInsert('emp_id_sequences', array_map($cleanItem, $data['emp_id_sequences'] ?? []));

            DB::commit();

            // ── Post-commit: Rebuild ledger and balances (outside transaction) ──
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
                \Log::error('Post-restore ledger rebuild failed: ' . $e->getMessage());
            }

            return response()->json(['message' => 'Full system sync completed successfully! All data has been replaced.']);
        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('[RestoreBackup] Database restore failed: ' . $e->getMessage(), [
                'exception' => $e,
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json(['message' => 'Sync failed: ' . $e->getMessage()], 500);
        } finally {
            // Always re-enable FK constraints, even on timeout or fatal error
            try { Schema::enableForeignKeyConstraints(); } catch (\Exception $e) {}
            // Always release the lock
            $lock->release();
        }
    }

    /**
     * Chunk insertion dynamically based on column count to avoid SQLite 999 variable limit
     */
    private function safeInsert(string $table, array $rows): void
    {
        if (empty($rows)) {
            return;
        }

        $firstRow = reset($rows);
        $colCount = is_array($firstRow) ? count($firstRow) : (is_object($firstRow) ? count((array)$firstRow) : 1);

        // SQLite's variable limit is 999. Use a safe ceiling of 950.
        $chunkSize = max(1, (int) floor(950 / $colCount));

        foreach (array_chunk($rows, $chunkSize) as $chunk) {
            DB::table($table)->insert($chunk);
        }
    }
}
