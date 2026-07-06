<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Supplier;
use App\Models\Customer;
use App\Models\Product;
use App\Models\PurchaseInvoice;
use App\Models\SaleInvoice;
use App\Models\Inventory;
use App\Models\StockAdjustment;
use App\Models\Transaction;
use App\Models\CustomerEvent;
use App\Models\Setting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Carbon\Carbon;

class SystemBackupController extends Controller
{
    // Bump this whenever new tables are added to backup so old files are rejected at restore
    private const BACKUP_VERSION = '1.4';

    public function backup(Request $request)
    {
        if (!$request->user()->hasFullAccess()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $data = [
            'type'    => 'FULL_SYSTEM_BACKUP',
            'version' => self::BACKUP_VERSION,
            'timestamp' => now()->toDateTimeString(),

            // ── Auth & Permissions ─────────────────────────────────────
            'shops'                 => \App\Models\Shop::all(),
            'users'                 => \App\Models\User::all(),
            'permissions'           => DB::table('permissions')->get(),
            'roles'                 => DB::table('roles')->get(),
            'role_has_permissions'  => DB::table('role_has_permissions')->get(),
            'model_has_roles'       => DB::table('model_has_roles')->get(),
            'model_has_permissions' => DB::table('model_has_permissions')->get(),

            // ── Foundation ─────────────────────────────────────────────
            'categories'            => Category::all(),
            'subcategories'         => DB::table('subcategories')->get(),
            'brands'                => \App\Models\Brand::all(),
            'expense_categories'    => \App\Models\ExpenseCategory::all(),
            'settings'              => Setting::all(),

            // ── People ─────────────────────────────────────────────────
            'suppliers'             => Supplier::all(),
            'customers'             => Customer::all(),
            'customer_events'       => CustomerEvent::all(),
            'retailers'             => \App\Models\Retailer::all(),
            'employees'             => \App\Models\Employee::all(),
            'emp_id_sequences'      => DB::table('emp_id_sequences')->get(),

            // ── Accounting ─────────────────────────────────────────────
            'entities'              => \App\Models\Entity::all(),
            'entity_balances'       => \App\Models\EntityBalance::all(),
            'ledgers'               => \App\Models\Ledger::all(),
            'transactions'          => Transaction::all(),

            // ── Stock ──────────────────────────────────────────────────
            'products'              => Product::withTrashed()->get(),
            'inventories'           => Inventory::all(),
            'stock_adjustments'     => StockAdjustment::all(),

            // ── Purchases ──────────────────────────────────────────────
            'purchase_invoices'     => PurchaseInvoice::with('items')->get(),

            // ── Sales ──────────────────────────────────────────────────
            'sale_invoices'         => SaleInvoice::with(['items', 'giftItems'])->get(),

            // ── Repairs ────────────────────────────────────────────────
            'repair_requests'       => \App\Models\RepairRequest::all(),

            // ── Airtel ─────────────────────────────────────────────────
            'airtel_drops'          => \App\Models\AirtelDrop::all(),
            'airtel_recoveries'     => \App\Models\AirtelRecovery::all(),

            // ── Finance ────────────────────────────────────────────────
            'loans'                 => \App\Models\Loan::all(),
            'loan_payments'         => \App\Models\LoanPayment::all(),
            'salary_payments'       => \App\Models\SalaryPayment::all(),

            // ── Other Products ─────────────────────────────────────────
            'old_mobile_purchases'  => \App\Models\OldMobilePurchase::all(),
            'recharge_purchases'    => DB::table('recharge_purchases')->get(),
            'recharge_sales'        => DB::table('recharge_sales')->get(),
            'sim_cards'             => DB::table('sim_cards')->get(),

            // ── Gifts & Offers ─────────────────────────────────────────
            'gift_products'         => DB::table('gift_products')->get(),
            'gift_inventory'        => DB::table('gift_inventory')->get(),
            'company_offers'        => \App\Models\CompanyOffer::all(),
            'offer_fulfillments'    => DB::table('offer_fulfillments')->get(),

            // ── CRM & Tasks ────────────────────────────────────────────
            'follow_ups'            => \App\Models\FollowUp::all(),
            'tasks'                 => \App\Models\Task::all(),
            'task_updates'          => DB::table('task_updates')->get(),

            // ── Incentives ─────────────────────────────────────────────
            'employee_incentives'   => DB::table('employee_incentives')->get(),

            // ── Audit ──────────────────────────────────────────────────
            'activity_logs'         => DB::table('activity_logs')->get(),
        ];

        $filename = "tinku_mobiles_full_backup_" . date('Ymd_His') . ".json";

        return response()->json($data)
            ->header('Content-Disposition', "attachment; filename=\"$filename\"");
    }

    public function restoreBackup(Request $request)
    {
        if (!$request->user()->hasFullAccess()) {
            return response()->json(['message' => 'Only the owner or administrator can restore system backups'], 403);
        }

        $request->validate([
            'backup_file' => 'required|file|max:102400|mimetypes:application/json,text/plain',
        ]);

        $lock = Cache::lock('system_restore', 600);
        if (!$lock->get()) {
            return response()->json(['message' => 'A system restore is already in progress. Please wait.'], 429);
        }

        $jsonContent = file_get_contents($request->file('backup_file')->getRealPath());
        $data = json_decode($jsonContent, true);

        if ($data === null) {
            $lock->release();
            return response()->json(['message' => 'Invalid JSON in backup file.'], 422);
        }

        if (!isset($data['type']) || $data['type'] !== 'FULL_SYSTEM_BACKUP') {
            $lock->release();
            return response()->json(['message' => 'Invalid system backup file format.'], 422);
        }

        $fileVersion = $data['version'] ?? '1.0';
        if (version_compare($fileVersion, self::BACKUP_VERSION) < 0) {
            $lock->release();
            return response()->json([
                'message' => "Backup version $fileVersion is too old (minimum: " . self::BACKUP_VERSION . "). "
                    . "Please export a fresh backup from the current system and restore that instead.",
            ], 422);
        }

        $cleanItem = function ($item) {
            if (!$item) return $item;
            $item = (array) $item;
            foreach ($item as $key => $value) {
                // Normalise date/time strings to Y-m-d H:i:s
                if ($value && (str_ends_with($key, '_at') || str_ends_with($key, '_date')
                    || in_array($key, [
                        'purchase_date', 'sale_date', 'adjustment_date', 'date',
                        'expected_delivery_date', 'transaction_date', 'dob', 'anniversary_date',
                        'refill_date', 'recovered_at', 'next_recovery_date', 'submitted_date',
                        'estimated_delivery_date', 'actual_delivery_date', 'balance_received_at',
                        'cost_paid_at', 'disbursal_date', 'payment_date', 'joining_date', 'join_date',
                    ]))) {
                    try {
                        $item[$key] = Carbon::parse($value)->format('Y-m-d H:i:s');
                    } catch (\Exception $e) {
                        $item[$key] = null;
                    }
                }
                // Encode any nested arrays to JSON string for DB storage
                if (is_array($value)) {
                    $item[$key] = json_encode($value);
                }
            }
            return $item;
        };

        try {
            Schema::disableForeignKeyConstraints();
            DB::beginTransaction();

            // ── Clear in reverse dependency order ─────────────────────
            // Audit / activity first (FK → users)
            DB::table('activity_logs')->delete();

            // Spatie pivot tables (FK → permissions/roles/users)
            DB::table('model_has_permissions')->delete();
            DB::table('model_has_roles')->delete();
            DB::table('role_has_permissions')->delete();
            DB::table('permissions')->delete();
            DB::table('roles')->delete();

            // Auth tokens then users then shops
            DB::table('personal_access_tokens')->delete();
            DB::table('users')->delete();
            DB::table('shops')->delete();

            // Tasks & ledger
            DB::table('task_updates')->delete();
            DB::table('tasks')->delete();
            DB::table('ledgers')->delete();
            DB::table('transactions')->delete();

            // Finance
            DB::table('salary_payments')->delete();
            DB::table('loan_payments')->delete();
            DB::table('loans')->delete();

            // Airtel
            DB::table('airtel_recoveries')->delete();
            DB::table('airtel_drops')->delete();

            // Repairs & CRM
            DB::table('repair_requests')->delete();
            DB::table('follow_ups')->delete();

            // Sales
            DB::table('sale_gift_items')->delete();
            DB::table('sale_items')->delete();
            DB::table('sale_invoices')->delete();

            // Purchases
            DB::table('purchase_items')->delete();
            DB::table('purchase_invoices')->delete();

            // Stock & Inventory
            DB::table('inventory')->delete();
            DB::table('stock_adjustments')->delete();
            DB::table('products')->delete();

            // Accounting
            DB::table('entity_balances')->delete();
            DB::table('entities')->delete();

            // People
            DB::table('customer_events')->delete();
            DB::table('customers')->delete();
            DB::table('suppliers')->delete();
            DB::table('retailers')->delete();
            DB::table('employees')->delete();
            DB::table('emp_id_sequences')->delete();

            // Foundation
            DB::table('expense_categories')->delete();
            DB::table('settings')->delete();
            DB::table('subcategories')->delete();
            DB::table('categories')->delete();
            DB::table('brands')->delete();

            // Other products
            DB::table('old_mobile_purchases')->delete();
            DB::table('recharge_purchases')->delete();
            DB::table('recharge_sales')->delete();
            DB::table('sim_cards')->delete();

            // Gifts & Offers
            DB::table('gift_products')->delete();
            DB::table('gift_inventory')->delete();
            DB::table('offer_fulfillments')->delete();
            DB::table('company_offers')->delete();

            // Incentives
            DB::table('employee_incentives')->delete();

            // ── Insert in dependency order ────────────────────────────

            // 1. Auth foundation
            $this->safeInsert('shops', array_map($cleanItem, $data['shops'] ?? []));
            $this->safeInsert('users', array_map($cleanItem, $data['users'] ?? []));

            // 2. Spatie permissions
            $this->safeInsert('permissions', array_map($cleanItem, $data['permissions'] ?? []));
            $this->safeInsert('roles', array_map($cleanItem, $data['roles'] ?? []));
            $this->safeInsert('role_has_permissions', array_map($cleanItem, $data['role_has_permissions'] ?? []));
            $this->safeInsert('model_has_roles', array_map($cleanItem, $data['model_has_roles'] ?? []));
            $this->safeInsert('model_has_permissions', array_map($cleanItem, $data['model_has_permissions'] ?? []));

            // 3. Foundation tables
            $this->safeInsert('categories', array_map($cleanItem, $data['categories'] ?? []));
            $this->safeInsert('subcategories', array_map($cleanItem, $data['subcategories'] ?? []));
            $this->safeInsert('brands', array_map($cleanItem, $data['brands'] ?? []));
            $this->safeInsert('expense_categories', array_map($cleanItem, $data['expense_categories'] ?? []));
            $this->safeInsert('settings', array_map($cleanItem, $data['settings'] ?? []));

            // 4. People
            $this->safeInsert('suppliers', array_map($cleanItem, $data['suppliers'] ?? []));
            $this->safeInsert('customers', array_map($cleanItem, $data['customers'] ?? []));
            $this->safeInsert('customer_events', array_map($cleanItem, $data['customer_events'] ?? []));
            $this->safeInsert('retailers', array_map($cleanItem, $data['retailers'] ?? []));
            $this->safeInsert('employees', array_map($cleanItem, $data['employees'] ?? []));
            $this->safeInsert('emp_id_sequences', array_map($cleanItem, $data['emp_id_sequences'] ?? []));

            // 5. Accounting
            $this->safeInsert('entities', array_map($cleanItem, $data['entities'] ?? []));
            $this->safeInsert('entity_balances', array_map($cleanItem, $data['entity_balances'] ?? []));

            // 6. Stock
            if (!empty($data['products'])) {
                $this->safeInsert('products', array_map($cleanItem, $data['products']));
            }
            $this->safeInsert('inventory', array_map($cleanItem, $data['inventories'] ?? []));
            $this->safeInsert('stock_adjustments', array_map($cleanItem, $data['stock_adjustments'] ?? []));

            // 7. Purchases (header + items)
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

            // 8. Sales (header + items + gifts)
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
                    foreach (($gifts ?: []) as $g)  $allGifts[] = $cleanItem($g);
                }
                $this->safeInsert('sale_invoices', $allInvoices);
                $this->safeInsert('sale_items', $allItems);
                $this->safeInsert('sale_gift_items', $allGifts);
            }

            // 9. Repairs & follow-ups
            $this->safeInsert('repair_requests', array_map($cleanItem, $data['repair_requests'] ?? []));
            $this->safeInsert('follow_ups', array_map($cleanItem, $data['follow_ups'] ?? []));

            // 10. Airtel
            $this->safeInsert('airtel_drops', array_map($cleanItem, $data['airtel_drops'] ?? []));
            $this->safeInsert('airtel_recoveries', array_map($cleanItem, $data['airtel_recoveries'] ?? []));

            // 11. Finance
            $this->safeInsert('loans', array_map($cleanItem, $data['loans'] ?? []));
            $this->safeInsert('loan_payments', array_map($cleanItem, $data['loan_payments'] ?? []));
            $this->safeInsert('salary_payments', array_map($cleanItem, $data['salary_payments'] ?? []));

            // 12. Ledger & transactions (restored directly — no post-commit rebuild needed)
            $this->safeInsert('transactions', array_map($cleanItem, $data['transactions'] ?? []));
            $this->safeInsert('ledgers', array_map($cleanItem, $data['ledgers'] ?? []));

            // 13. Other products
            $this->safeInsert('old_mobile_purchases', array_map($cleanItem, $data['old_mobile_purchases'] ?? []));
            $this->safeInsert('recharge_purchases', array_map($cleanItem, $data['recharge_purchases'] ?? []));
            $this->safeInsert('recharge_sales', array_map($cleanItem, $data['recharge_sales'] ?? []));
            $this->safeInsert('sim_cards', array_map($cleanItem, $data['sim_cards'] ?? []));

            // 14. Gifts & Offers
            $this->safeInsert('gift_products', array_map($cleanItem, $data['gift_products'] ?? []));
            $this->safeInsert('gift_inventory', array_map($cleanItem, $data['gift_inventory'] ?? []));
            $this->safeInsert('company_offers', array_map($cleanItem, $data['company_offers'] ?? []));
            $this->safeInsert('offer_fulfillments', array_map($cleanItem, $data['offer_fulfillments'] ?? []));

            // 15. Tasks & incentives
            $this->safeInsert('tasks', array_map($cleanItem, $data['tasks'] ?? []));
            $this->safeInsert('task_updates', array_map($cleanItem, $data['task_updates'] ?? []));
            $this->safeInsert('employee_incentives', array_map($cleanItem, $data['employee_incentives'] ?? []));

            // 16. Audit log (last — FK → users)
            $this->safeInsert('activity_logs', array_map($cleanItem, $data['activity_logs'] ?? []));

            DB::commit();

            // ── Post-commit: clear Spatie permission cache ────────────
            // (critical after restoring roles/permissions to avoid stale cache)
            try {
                app('cache')
                    ->store(config('permission.cache.store') !== 'default' ? config('permission.cache.store') : null)
                    ->forget(config('permission.cache.key'));
            } catch (\Exception $e) {
                \Log::warning('[RestoreBackup] Could not clear permission cache: ' . $e->getMessage());
            }

            // ── Post-commit: recalculate entity balances from restored ledgers ──
            try {
                app(\App\Services\EntityService::class)->syncAll();
            } catch (\Exception $e) {
                \Log::warning('[RestoreBackup] Balance recalculation failed: ' . $e->getMessage());
            }

            return response()->json(['message' => 'Full system restore completed successfully! All data has been replaced. Please log in again.']);
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->errorResponse($e, 'Restore failed');
        } finally {
            try { Schema::enableForeignKeyConstraints(); } catch (\Exception $e) {}
            $lock->release();
        }
    }

    /**
     * Chunk insertion dynamically based on column count to avoid MySQL variable limits.
     */
    private function safeInsert(string $table, array $rows): void
    {
        if (empty($rows)) return;

        $firstRow  = reset($rows);
        $colCount  = is_array($firstRow) ? count($firstRow) : count((array) $firstRow);
        $chunkSize = max(1, (int) floor(950 / max(1, $colCount)));

        foreach (array_chunk($rows, $chunkSize) as $chunk) {
            DB::table($table)->insert($chunk);
        }
    }
}
