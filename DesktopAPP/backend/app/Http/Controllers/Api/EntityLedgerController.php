<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Transaction;
use App\Traits\RecordsTransactions;
use App\Services\EntityService;
use App\Services\WhatsAppService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

use App\Services\ReportingService;
use App\Services\TransactionService;

class EntityLedgerController extends Controller
{
    use RecordsTransactions;

    protected $reportingService;
    protected $transactionService;

    public function __construct(ReportingService $reportingService, TransactionService $transactionService)
    {
        $this->reportingService = $reportingService;
        $this->transactionService = $transactionService;
    }

    /**
     * Get summary of all entities with balances.
     * Computed live from transactions to avoid stale cache issues.
     */
    public function summary()
    {
        // Sum up the cached balances (which are now accurate after my fixes)
        $totals = DB::table('entity_balances')
            ->select(
                DB::raw('SUM(CASE WHEN net_balance > 0 THEN net_balance ELSE 0 END) as receivable'),
                DB::raw('SUM(CASE WHEN net_balance < 0 THEN ABS(net_balance) ELSE 0 END) as payable'),
                DB::raw('SUM(net_balance) as overall_total')
            )
            ->first();

        return response()->json([
            'overallTotal' => (float)($totals->overall_total ?? 0),
            'receivable' => (float)($totals->receivable ?? 0),
            'payable' => (float)($totals->payable ?? 0),
        ]);
    }

    /**
     * Send a WhatsApp pending-balance reminder directly to a customer/party
     * (not the owner) — used by the Pending Balance page's per-row action.
     * The message is built server-side from a default template but the
     * caller (frontend) may preview/edit it before sending.
     */
    public function sendPendingBalanceReminder(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string',
            'phone' => 'required|string',
            'message' => 'required|string|max:1000',
        ]);

        $waService = app(WhatsAppService::class);

        if (!$waService->isConfigured()) {
            return response()->json(['message' => 'WhatsApp is not configured (Settings > WhatsApp Config).'], 422);
        }

        $sent = $waService->sendMessage($data['phone'], $data['message']);

        if (!$sent) {
            return response()->json(['message' => "Failed to send WhatsApp message to {$data['name']}. Check the phone number and WhatsApp connection."], 500);
        }

        ActivityLog::log('PENDING_BALANCE_REMINDER_SENT', null, "WhatsApp pending-balance reminder sent to {$data['name']} ({$data['phone']})");

        return response()->json(['message' => "Reminder sent to {$data['name']}"]);
    }

    /**
     * Get summary of all entities with balances (Searchable).
     */
    public function index(Request $request)
    {
        $query = $request->query('q');
        $filterType = $request->query('type', 'ALL'); // ALL, RECEIVABLE, PAYABLE

        // 1. Get Base Entities filtered by query
        $entityQuery = \App\Models\Entity::query();
        if ($query) {
            $entityQuery->where(function($q) use ($query) {
                $q->where('name', 'like', "%{$query}%")
                  ->orWhere('phone', 'like', "%{$query}%");
            });
        }
        
        $entities = $entityQuery->limit(50)->get();
        
        // 2. Identify unregistered names matched by query if it exists
        if ($query) {
            $unregisteredNames = collect()
                ->merge(Transaction::where('entity_name', 'like', "%{$query}%")->distinct()->pluck('entity_name'))
                ->merge(\DB::table('repair_requests')->where('forwarded_to', 'like', "%{$query}%")->distinct()->pluck('forwarded_to'))
                ->unique()
                ->filter(fn($name) => !$entities->contains('name', $name))
                ->take(10); // Limit unregistered results to avoid blowup

            foreach ($unregisteredNames as $name) {
                $entities->push(new \App\Models\Entity(['name' => $name, 'type' => 'UNREGISTERED']));
            }
        } else if ($entities->isEmpty()) {
             // If no query and no entities, maybe show some recent active entities?
             // For now, we return empty or just recent ones.
             $entities = \App\Models\Entity::latest()->take(10)->get();
        }

        // 3. Batch calculate all balances for matched entities
        $statements = \App\Models\Entity::calculateBalances($entities);

        // 4. Apply Type filtering
        if ($filterType === 'RECEIVABLE') {
            $statements = $statements->filter(fn($s) => $s->net_balance > 0);
        } elseif ($filterType === 'PAYABLE') {
            $statements = $statements->filter(fn($s) => $s->net_balance < 0);
        }

        return response()->json($statements->values()->sortByDesc(fn($s) => abs($s->net_balance))->values());
    }

    /**
     * Generate a summary report for all entities within a date range.
     */
    public function report(Request $request)
    {
        $startDate = $request->query('start_date');
        $endDate = $request->query('end_date', now()->toDateString());
        $query = $request->query('q');
        $filterType = $request->query('type', 'ALL');

        // 1. Get Matching Entities
        $entityQuery = \App\Models\Entity::query();
        if ($query) {
            $entityQuery->where(function($q) use ($query) {
                $q->where('name', 'like', "%{$query}%")
                  ->orWhere('phone', 'like', "%{$query}%");
            });
        }
        $entities = $entityQuery->get();

        // 2. Identify active unregistered entities if searching
        if ($query) {
            $unregisteredNames = collect()
                ->merge(Transaction::where('entity_name', 'like', "%{$query}%")->distinct()->pluck('entity_name'))
                ->merge(DB::table('repair_requests')->where('forwarded_to', 'like', "%{$query}%")->distinct()->pluck('forwarded_to'))
                ->unique()
                ->filter(fn($name) => !$entities->contains('name', $name));

            foreach ($unregisteredNames as $name) {
                $entities->push(new \App\Models\Entity(['name' => $name, 'type' => 'UNREGISTERED']));
            }
        }

        if ($entities->isEmpty()) return response()->json([]);

        // 3. Batch Process Aggregates
        $ids = $entities->pluck('id')->filter()->toArray();
        $names = $entities->pluck('name')->toArray();

        // Stats before the period (for Opening Balance)
        $beforeStats = $startDate 
            ? $this->reportingService->getAggregatedMovements($ids, $names, null, date('Y-m-d', strtotime($startDate . ' -1 day'))) 
            : [];

        // Stats within the period (for Movement)
        $periodStats = $this->reportingService->getAggregatedMovements($ids, $names, $startDate, $endDate);
        
        $results = $entities->map(function($entity) use ($beforeStats, $periodStats) {
            $name = $entity->name;
            $id = $entity->id;

            // Get real opening balance from the linked model (Retailer has 'balance' column)
            $openingBase = (float)$entity->opening_balance;
            if ($entity->relation_type && $entity->relation_id) {
                $linkedModel = \DB::table((new $entity->relation_type)->getTable())
                    ->where('id', $entity->relation_id)
                    ->first();
                if ($linkedModel) {
                    $openingBase = (float)($linkedModel->balance ?? $linkedModel->opening_balance ?? $entity->opening_balance ?? 0);
                }
            }
            
            $openingBase = ($entity->balance_type == 'RECEIVABLE' ? 1 : -1) * $openingBase;
            
            // Get stats from batches (match by ID first, then Name)
            $before = $beforeStats[$id] ?? $beforeStats[$name] ?? ['in' => 0, 'out' => 0, 'unrealized' => 0];
            $period = $periodStats[$id] ?? $periodStats[$name] ?? ['in' => 0, 'out' => 0, 'unrealized' => 0];

            $openingBalance = $openingBase + $before['unrealized'] - $before['in'] + $before['out'];
            $closingBalance = $openingBalance + $period['unrealized'] - $period['in'] + $period['out'];

            return [
                'entity_name' => $name,
                'phone' => $entity->phone,
                'relation' => $entity->type,
                'opening_balance' => (float)$openingBalance,
                'period_in' => (float)$period['in'],
                'period_out' => (float)$period['out'],
                'period_unrealized' => (float)$period['unrealized'],
                'net_balance' => (float)$closingBalance
            ];
        })->filter(function($item) use ($filterType) {
            if ($filterType === 'REC') return $item['net_balance'] > 0;
            if ($filterType === 'PAY') return $item['net_balance'] < 0;
            // For 'ALL', show anything that is not zero
            return round($item['net_balance'], 2) != 0;
        });

        // Deduplicate by name just in case there are double entities
        $finalResults = $results->groupBy('entity_name')->map(function($group) {
            return $group->first(); // Take the first one, they should be similar anyway
        })->values();

        return response()->json($finalResults->sortByDesc(fn($r) => abs($r['net_balance']))->values());
    }

    /**
     * Get ledger by customer_id (safe for customer names containing '/' or other special URL chars).
     */
    public function showForCustomer(Request $request)
    {
        $customerId = $request->query('customer_id');
        if (!$customerId) {
            return response()->json(['message' => 'customer_id is required'], 422);
        }
        $customer = \App\Models\Customer::find($customerId);
        if (!$customer) {
            return response()->json(['message' => 'Customer not found'], 404);
        }
        return $this->show($request, $customer->name);
    }

    /**
     * Get detailed ledger for a single entity.
     */
    public function show(Request $request, $entityName)
    {
        $startDate = $request->query('start_date');
        $endDate = $request->query('end_date');
        $excludeSaleInvoiceId = $request->query('exclude_sale_invoice_id');

        $entity = \App\Models\Entity::where('name', $entityName)->first();
        
        if (!$entity) {
            $entity = new \App\Models\Entity([
                'name' => $entityName, 
                'opening_balance' => 0, 
                'balance_type' => 'RECEIVABLE',
                'type' => 'UNREGISTERED'
            ]);
        }

        // Get real opening balance from the linked model (Retailer has 'balance' column)
        $realOpeningBalance = (float)$entity->opening_balance;
        if ($entity->relation_type && $entity->relation_id) {
            $linkedModel = \DB::table((new $entity->relation_type)->getTable())
                ->where('id', $entity->relation_id)
                ->first();
            if ($linkedModel) {
                // Retailer uses 'balance' column for opening balance
                $realOpeningBalance = (float)($linkedModel->balance ?? $linkedModel->opening_balance ?? $entity->opening_balance ?? 0);
                // Sync it back to entity if stale
                if ($realOpeningBalance != (float)$entity->opening_balance) {
                    $entity->opening_balance = $realOpeningBalance;
                }
            }
        }

        $entityId = $entity->id ?? 0;
        $ledgerItems = collect();

        // Bank/Card/UPI entities are asset (cash-holding) accounts, not people/
        // parties — money IN increases their balance instead of "what they owe
        // us going down", and none of the virtual/unrealized charge sections
        // below (sales, repairs, purchases, loans...) are ever posted against
        // an asset account directly, so they're skipped entirely for these.
        $isAssetAccount = \App\Models\Entity::isAssetType($entity->type);

        // 1. REAL TRANSACTIONS (Money In/Out) - match by BOTH entity_name AND accounting_entity_id
        $txQuery = Transaction::where(function($q) use ($entityName, $entityId) {
            $q->where('entity_name', $entityName);
            if ($entityId) $q->orWhere('accounting_entity_id', $entityId);
        });
        if ($startDate) $txQuery->where('transaction_date', '>=', $startDate);
        if ($endDate) $txQuery->where('transaction_date', '<=', $endDate);
        if ($excludeSaleInvoiceId) {
            $txQuery->where(function($q) use ($excludeSaleInvoiceId) {
                $q->whereNull('entity_type')
                  ->orWhere('entity_type', '!=', 'App\Models\SaleInvoice')
                  ->orWhere('entity_id', '!=', $excludeSaleInvoiceId);
            });
        }
        
        $transactions = $txQuery->get();
        foreach ($transactions as $tx) {
            $ledgerItems->push([
                'id' => $tx->id,
                'transaction_date' => $tx->transaction_date,
                'category' => $tx->category,
                'description' => $tx->description,
                'payment_mode' => $tx->payment_mode,
                'in_worth' => $tx->type === 'IN' ? (float)$tx->amount : 0,
                'out_worth' => $tx->type === 'OUT' ? (float)$tx->amount : 0,
                'unrealized_in' => 0,
                'unrealized_out' => 0,
                'type' => $tx->type,
                'entry_type' => 'REAL',
                'created_at' => $tx->created_at
            ]);
        }

        // 2. VIRTUAL CHARGES — none of these apply to an asset account
        if (!$isAssetAccount) {
        // Repairs
        $repQuery = \App\Models\RepairRequest::where('customer_name', $entityName)->where('is_pay_later', true);
        if ($startDate) $repQuery->where('submitted_date', '>=', $startDate);
        if ($endDate) $repQuery->where('submitted_date', '<=', $endDate);
        
        $repQuery->get()->each(function($r) use ($ledgerItems) {
            $ledgerItems->push([
                'id' => 'RC-' . $r->id,
                'transaction_date' => $r->submitted_date,
                'category' => 'REPAIR_CHARGE',
                'description' => "Repair Service: {$r->device_model} - " . (is_array($r->issue_description) ? implode(', ', $r->issue_description) : $r->issue_description) . " (Inv: #{$r->id})",
                'in_worth' => 0,
                'out_worth' => (float)$r->quoted_amount,
                'unrealized_in' => 0,
                'unrealized_out' => 0,
                'type' => 'UNREALIZED',
                'entry_type' => 'UNREALIZED',
                'created_at' => $r->created_at
            ]);
        });

        // Sales
        $saleQuery = \App\Models\SaleInvoice::where('is_cancelled', false)
            ->whereHas('customer', fn($q) => $q->where('name', $entityName));
        if ($startDate) $saleQuery->where('sale_date', '>=', $startDate);
        if ($endDate) $saleQuery->where('sale_date', '<=', $endDate);
        if ($excludeSaleInvoiceId) {
            $saleQuery->where('id', '!=', $excludeSaleInvoiceId);
        }
        
        $saleQuery->with('items.product')->get()->each(function($i) use ($ledgerItems) {
                $itemNames = $i->items->map(function($it) {
                    return ($it->product->name ?? 'Unknown') . ($it->quantity > 1 ? " (x{$it->quantity})" : "");
                })->implode(', ');
                
                $financeText = $i->finance_amount > 0 ? " (Total: ₹" . number_format($i->grand_total) . ", Finance: ₹" . number_format($i->finance_amount) . ", Net Customer: ₹" . number_format($i->grand_total - $i->finance_amount) . ")" : "";
                
                $ledgerItems->push([
                    'id' => 'SL-CHG-' . $i->id,
                    'transaction_date' => $i->sale_date,
                    'category' => 'SALE_CHARGE',
                    'description' => "Sale Invoice: #{$i->invoice_no}" . ($itemNames ? " [{$itemNames}]" : "") . $financeText,
                    'in_worth' => 0,
                    'out_worth' => (float)($i->grand_total - $i->finance_amount),
                    'unrealized_in' => 0,
                    'unrealized_out' => 0,
                    'type' => 'UNREALIZED',
                    'entry_type' => 'UNREALIZED',
                    'created_at' => $i->created_at
                ]);
            });

        // Finance Receivable for Financer
        $financeQuery = \App\Models\SaleInvoice::where('is_cancelled', false);
        if ($entity && $entity->id) {
            $financeQuery->where('financer_id', $entity->id);
        } else {
            $financeQuery->whereHas('financer', fn($q) => $q->where('name', $entityName));
        }
        if ($startDate) $financeQuery->where('sale_date', '>=', $startDate);
        if ($endDate) $financeQuery->where('sale_date', '<=', $endDate);

        $financeQuery->with('customer')->get()->each(function($i) use ($ledgerItems) {
            $customerName = $i->customer->name ?? 'Customer';
            $ledgerItems->push([
                'id' => 'SL-FIN-' . $i->id,
                'transaction_date' => $i->sale_date,
                'category' => 'FINANCE_RECEIVABLE',
                'description' => "Finance Receivable: Invoice #{$i->invoice_no} (Customer: {$customerName}, Financed: ₹" . number_format($i->finance_amount) . ")",
                'in_worth' => 0,
                'out_worth' => (float)$i->finance_amount,
                'unrealized_in' => 0,
                'unrealized_out' => 0,
                'type' => 'UNREALIZED',
                'entry_type' => 'UNREALIZED',
                'created_at' => $i->created_at
            ]);
        });

        // Loans (Typically we might filter by start date of loan, or just show all outstanding)
        $loanQuery = \App\Models\Loan::whereHas('customer', fn($q) => $q->where('name', $entityName))
            ->where('status', '!=', 'closed');
        // Loans are a bit special, usually we show full balance if its active.
        
        $loanQuery->get()->each(function($l) use ($ledgerItems) {
                $rem = $l->remaining();
                if ($rem > 0) {
                    $ledgerItems->push([
                        'id' => 'LN-REM-' . $l->id,
                        'transaction_date' => $l->start_date->toDateString(),
                        'category' => 'LOAN_BALANCE',
                        'description' => "Outstanding Loan Balance: {$l->loan_type} (Int: {$l->interest_rate}%)",
                        'in_worth' => 0,
                        'out_worth' => (float)$rem,
                        'unrealized_in' => 0,
                        'unrealized_out' => 0,
                        'type' => 'UNREALIZED',
                        'entry_type' => 'UNREALIZED',
                        'created_at' => $l->created_at
                    ]);
                }
            });

        // Airtel Drops (Debit — what they owe)
        $airtelQuery = \App\Models\AirtelDrop::whereHas('retailer', fn($q) => $q->where('name', $entityName));
        if ($startDate) $airtelQuery->where('refill_date', '>=', $startDate);
        if ($endDate) $airtelQuery->where('refill_date', '<=', $endDate);
        
        $airtelQuery->get()->each(function($d) use ($ledgerItems) {
                $ledgerItems->push([
                    'id' => 'AR-CHG-' . $d->id,
                    'transaction_date' => $d->refill_date,
                    'category' => 'AIRTEL_DROP',
                    'description' => "Airtel Stock Drop: #{$d->id}",
                    'in_worth' => 0,
                    'out_worth' => (float)$d->amount,
                    'unrealized_in' => 0,
                    'unrealized_out' => 0,
                    'type' => 'UNREALIZED',
                    'entry_type' => 'UNREALIZED',
                    'created_at' => $d->created_at
                ]);
            });

        // Airtel Recoveries (Credit — what they paid back)
        $recoveryQuery = \App\Models\AirtelRecovery::whereHas('retailer', fn($q) => $q->where('name', $entityName));
        if ($startDate) $recoveryQuery->where('recovered_at', '>=', $startDate);
        if ($endDate) $recoveryQuery->where('recovered_at', '<=', $endDate);

        $recoveryQuery->get()->each(function($r) use ($ledgerItems) {
            // Avoid double-counting: skip if there's already a Transaction record for this recovery
            $alreadyRecorded = \App\Models\Transaction::where('amount', $r->amount)
                ->whereDate('transaction_date', $r->recovered_at->toDateString())
                ->where('entity_name', $r->retailer->name ?? '')
                ->where('category', 'AIRTEL_RECOVERY')
                ->exists();

            if (!$alreadyRecorded) {
                $ledgerItems->push([
                    'id' => 'AR-REC-' . $r->id,
                    'transaction_date' => $r->recovered_at->toDateString(),
                    'category' => 'AIRTEL_RECOVERY',
                    'description' => "Airtel Recovery" . ($r->notes ? ": {$r->notes}" : ''),
                    'in_worth' => (float)$r->amount,
                    'out_worth' => 0,
                    'unrealized_in' => 0,
                    'unrealized_out' => 0,
                    'type' => 'IN',
                    'entry_type' => 'REAL',
                    'created_at' => $r->created_at
                ]);
            }
        });

        // Forwarding
        $fwdQuery = \App\Models\RepairRequest::where('forwarded_to', $entityName)->where('service_center_cost', '>', 0);
        if ($startDate) $fwdQuery->where('submitted_date', '>=', $startDate);
        if ($endDate) $fwdQuery->where('submitted_date', '<=', $endDate);
        
        $fwdQuery->get()->each(function($r) use ($ledgerItems) {
                $ledgerItems->push([
                    'id' => 'RFC-CHG-' . $r->id,
                    'transaction_date' => $r->submitted_date,
                    'category' => 'REPAIR_FWD',
                    'description' => "Repair Forwarding: {$r->device_model} (Inv: #{$r->id})",
                    'in_worth' => (float)$r->service_center_cost,
                    'out_worth' => 0,
                    'unrealized_in' => 0,
                    'unrealized_out' => 0,
                    'type' => 'UNREALIZED',
                    'entry_type' => 'UNREALIZED',
                    'created_at' => $r->created_at
                ]);
            });

        // Purchases
        $purQuery = \App\Models\PurchaseInvoice::whereHas('supplier', fn($q) => $q->where('name', $entityName));
        if ($startDate) $purQuery->where('purchase_date', '>=', $startDate);
        if ($endDate) $purQuery->where('purchase_date', '<=', $endDate);
        
        $purQuery->with('items.product')->get()->each(function($i) use ($ledgerItems) {
                $itemNames = $i->items->map(function($it) {
                    return ($it->product->name ?? 'Unknown') . ($it->quantity > 1 ? " (x{$it->quantity})" : "");
                })->implode(', ');
                
                $ledgerItems->push([
                    'id' => 'PR-CHG-' . $i->id,
                    'transaction_date' => $i->purchase_date,
                    'category' => 'PURCHASE_CHG',
                    'description' => "Purchase Transaction: #{$i->invoice_no}" . ($itemNames ? " [{$itemNames}]" : ""),
                    'in_worth' => (float)$i->grand_total,
                    'out_worth' => 0,
                    'unrealized_in' => 0,
                    'unrealized_out' => 0,
                    'type' => 'UNREALIZED',
                    'entry_type' => 'UNREALIZED',
                    'created_at' => $i->created_at
                ]);
            });

        // Old Mobile Purchases (non-exchange)
        $oldMobQuery = \App\Models\OldMobilePurchase::where(function($q) use ($entityName, $entity) {
            $q->whereHas('customer', fn($c) => $c->where('name', $entityName));
            if ($entity && $entity->relation_id && $entity->relation_type === 'App\Models\Customer') {
                $q->orWhere('customer_id', $entity->relation_id);
            }
        })->where('is_exchange', false);
        
        if ($startDate) $oldMobQuery->where('purchase_date', '>=', $startDate);
        if ($endDate) $oldMobQuery->where('purchase_date', '<=', $endDate);
        
        $oldMobQuery->get()->each(function($i) use ($ledgerItems) {
            $ledgerItems->push([
                'id' => 'OM-CHG-' . $i->id,
                'transaction_date' => $i->purchase_date,
                'category' => 'OLD_MOBILE_CHARGE',
                'description' => "Old Mobile Purchase: {$i->model_name} (IMEI: " . ($i->imei ?? '—') . ")",
                'in_worth' => (float)$i->purchase_price,
                'out_worth' => 0,
                'unrealized_in' => 0,
                'unrealized_out' => 0,
                'type' => 'UNREALIZED',
                'entry_type' => 'UNREALIZED',
                'created_at' => $i->created_at
            ]);
        });
        } // end !$isAssetAccount virtual charges

        // Compute running totals directly from ledger items for accuracy
        $totalIn  = $ledgerItems->sum('in_worth');
        $totalOut = $ledgerItems->sum('out_worth');

        // Update entity with live-computed values so frontend shows correct numbers
        $entity->setAttribute('in_worth', (float)$totalIn);
        $entity->setAttribute('out_worth', (float)$totalOut);
        $entity->setAttribute('opening_balance', $realOpeningBalance);
        $entity->setAttribute('is_asset_account', $isAssetAccount);
        if ($isAssetAccount) {
            // Asset account: deposits increase the balance, withdrawals decrease it.
            $liveNet = $realOpeningBalance + $totalIn - $totalOut;
        } else {
            // net_balance = realOpeningBalance (what they owed before) + new drops (out) - payments received (in)
            $liveNet = $realOpeningBalance + $totalOut - $totalIn;
        }
        $entity->setAttribute('net_balance', $liveNet);

        // Reserved exchange credit lives on the Customer record itself, not the
        // ledger — surface it here so pages showing this entity's balance (Sale
        // form, Entity Ledger) can also show what's separately reserved.
        if ($entity->relation_type === \App\Models\Customer::class && $entity->relation_id) {
            $customer = \App\Models\Customer::find($entity->relation_id);
            $entity->setAttribute('exchange_credit_balance', (float) ($customer->exchange_credit_balance ?? 0));
        }

        return response()->json([
            'entity' => $entity,
            'transactions' => $ledgerItems->sortByDesc(function($item) {
                return $item['transaction_date'] . $item['created_at'];
            })->values()
        ]);
    }

    /**
     * Record a manual settlement for an entity.
     *
     * A settlement only ever touched the entity's aggregate ledger balance —
     * it never updated any specific Sale/Purchase invoice's own total_paid,
     * so a customer with several open invoices would keep showing as
     * unpaid/partial on Pending Balance and the Sales list even after being
     * settled here. Auto-apply the settled amount FIFO (oldest invoice
     * first) against the entity's own open invoices so those pages catch up
     * too — without creating a second Transaction, since the settlement
     * Transaction above already accounts for this money in the ledger.
     */
    public function recordSettlement(Request $request)
    {
        $user = $request->user();
        if (! $user->hasFullAccess()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $data = $request->validate([
            'entity_name' => 'required|string',
            'amount' => 'required|numeric|min:0',
            'type' => 'required|in:IN,OUT',
            'payment_mode' => 'required_without:payment_lines|string',
            'payment_lines' => 'nullable|array|min:2',
            'payment_lines.*.payment_mode' => 'required_with:payment_lines|string',
            'payment_lines.*.amount' => 'required_with:payment_lines|numeric|min:0.01',
            'description' => 'nullable|string',
            'category' => 'required|string',
            'transaction_date' => 'nullable|date'
        ]);

        if (!\App\Services\TransactionService::paymentLinesSumMatches($data['payment_lines'] ?? null, (float) $data['amount'])) {
            return response()->json(['message' => 'Split payment lines must add up to the total amount'], 422);
        }

        $entity = \App\Models\Entity::where('name', $data['entity_name'])->first();

        $shopId = $user->hasFullAccess() ? ($request->shop_id ?? $user->shop_id ?? \App\Models\Shop::first()->id ?? 1) : $user->shop_id;

        $modeLabel = !empty($data['payment_lines'])
            ? collect($data['payment_lines'])->map(fn ($l) => "{$l['payment_mode']} (₹" . number_format($l['amount'], 2) . ')')->implode(' + ')
            : $data['payment_mode'];

        return DB::transaction(function () use ($data, $user, $entity, $shopId, $modeLabel) {
            $transaction = $this->transactionService->recordSettlement([
                'shop_id' => $shopId,
                'user_id' => $user->id,
                'transaction_date' => $data['transaction_date'] ?? now()->toDateString(),
                'type' => $data['type'],
                'amount' => $data['amount'],
                'payment_mode' => $data['payment_mode'] ?? null,
                'payment_lines' => $data['payment_lines'] ?? null,
                'category' => $data['category'],
                'description' => $data['description'] ?? "Manual settlement for {$data['entity_name']}",
                'entity_name' => $data['entity_name'],
                'accounting_entity_id' => $entity ? $entity->id : null,
            ]);

            $appliedTo = $this->applySettlementToInvoices($entity, $data['entity_name'], $data['type'], (float) $data['amount']);

            $this->notifyOwner(
                ($data['type'] === 'IN' ? "💰 *Cash IN — {$data['entity_name']}*\n" : "💸 *Cash OUT — {$data['entity_name']}*\n") .
                "Amount: ₹" . number_format($data['amount'], 2) . "\n" .
                "Mode: {$modeLabel}\n" .
                "Category: {$data['category']}\n" .
                ($data['description'] ?? '' ? "Note: {$data['description']}\n" : '') .
                "By: {$user->name}"
            );

            return response()->json([
                'message' => 'Settlement recorded successfully',
                'transaction' => $transaction,
                'applied_to_invoices' => $appliedTo,
            ], 201);
        });
    }

    /**
     * Catch up any Sale/Purchase invoice whose own total_paid fell behind the
     * entity's real ledger balance — the exact gap left by a settlement that
     * was recorded before accounting_entity_id-based matching existed here
     * (or any other case where money got applied to the entity but never to
     * a specific invoice). Posts no new Transaction — the money is already
     * accounted for in the ledger; this only catches the invoice records up
     * to match what the ledger already says.
     */
    public function reconcileInvoices(Request $request, \App\Models\Entity $entity)
    {
        $user = $request->user();
        if (! $user->hasFullAccess()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $result = DB::transaction(fn () => $this->reconcileEntity($entity));

        return response()->json([
            'message' => count($result['applied']) > 0
                ? 'Reconciled ₹' . number_format($result['reconciled'], 2) . ' across ' . count($result['applied']) . ' invoice(s).'
                : 'Already in sync — no unallocated payment found.',
            'applied' => $result['applied'],
        ]);
    }

    /**
     * Run reconcileInvoices() across every entity in one pass, for cleaning up
     * after this bug affected many entities at once — doing it one-by-one via
     * the per-entity button isn't practical when there are dozens/hundreds.
     * Each entity is reconciled in its own transaction so one bad row can't
     * abort the whole batch.
     */
    public function reconcileAllInvoices(Request $request)
    {
        $user = $request->user();
        if (! $user->hasFullAccess()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $entities = \App\Models\Entity::all();
        $fixed = [];
        $totalReconciled = 0;
        $errors = [];

        foreach ($entities as $entity) {
            try {
                $result = DB::transaction(fn () => $this->reconcileEntity($entity));
                if (count($result['applied']) > 0) {
                    $fixed[] = [
                        'entity_id' => $entity->id,
                        'entity_name' => $entity->name,
                        'amount' => $result['reconciled'],
                        'invoices' => count($result['applied']),
                    ];
                    $totalReconciled += $result['reconciled'];
                }
            } catch (\Throwable $e) {
                $errors[] = ['entity_id' => $entity->id, 'entity_name' => $entity->name, 'error' => $e->getMessage()];
            }
        }

        return response()->json([
            'message' => count($fixed) > 0
                ? 'Reconciled ₹' . number_format($totalReconciled, 2) . ' across ' . count($fixed) . ' entit' . (count($fixed) === 1 ? 'y' : 'ies') . '.'
                : 'All entities already in sync — no unallocated payments found.',
            'fixed' => $fixed,
            'errors' => $errors,
        ]);
    }

    /**
     * Core reconcile logic for a single entity, shared by reconcileInvoices()
     * and reconcileAllInvoices(). Caller is responsible for wrapping in a
     * DB transaction and the hasFullAccess() authorization check.
     */
    private function reconcileEntity(\App\Models\Entity $entity): array
    {
        $ledgerBalance = app(\App\Services\AccountingService::class)->getClosingBalance($entity);

        if ($entity->type === 'SUPPLIER' || $entity->type === 'DISTRIBUTOR') {
            $outstandingSum = 0;
            $invoices = \App\Models\PurchaseInvoice::whereIn('payment_status', ['unpaid', 'partial'])
                ->where(function ($q) use ($entity) {
                    $q->where('accounting_entity_id', $entity->id);
                    if ($entity->relation_type === \App\Models\Supplier::class && $entity->relation_id) {
                        $q->orWhere('supplier_id', $entity->relation_id);
                    }
                })
                ->orderBy('purchase_date')->orderBy('id')->lockForUpdate()->get();
            foreach ($invoices as $inv) {
                $outstandingSum += max(0, (float) $inv->grand_total - (float) $inv->total_paid);
            }
            // Payable balance is negative — a real gap means the ledger owes
            // LESS (less negative) than what the invoices still show unpaid.
            $gap = $outstandingSum - abs(min(0, $ledgerBalance));
        } else {
            $outstandingSum = 0;
            $invoices = \App\Models\SaleInvoice::where('is_cancelled', false)
                ->whereIn('payment_status', ['unpaid', 'partial'])
                ->where(function ($q) use ($entity) {
                    $q->where('accounting_entity_id', $entity->id);
                    if ($entity->relation_type === \App\Models\Customer::class && $entity->relation_id) {
                        $q->orWhere('customer_id', $entity->relation_id);
                    }
                })
                ->orderBy('sale_date')->orderBy('id')->lockForUpdate()->get();
            foreach ($invoices as $inv) {
                $alreadyCovered = (float) $inv->total_paid + (float) $inv->exchange_paid
                    + ($inv->finance_payment_status === 'RECEIVED' ? (float) $inv->finance_amount : 0);
                $outstandingSum += max(0, (float) $inv->grand_total - $alreadyCovered);
            }
            $gap = $outstandingSum - max(0, $ledgerBalance);
        }

        if ($gap <= 0.01) {
            return ['applied' => [], 'reconciled' => 0];
        }

        $remaining = $gap;
        $applied = [];
        foreach ($invoices as $invoice) {
            if ($remaining <= 0) break;
            if ($invoice instanceof \App\Models\SaleInvoice) {
                $alreadyCovered = (float) $invoice->total_paid + (float) $invoice->exchange_paid
                    + ($invoice->finance_payment_status === 'RECEIVED' ? (float) $invoice->finance_amount : 0);
                $outstanding = max(0, (float) $invoice->grand_total - $alreadyCovered);
            } else {
                $outstanding = max(0, (float) $invoice->grand_total - (float) $invoice->total_paid);
            }
            if ($outstanding <= 0) continue;

            $apply = min($outstanding, $remaining);
            $invoice->total_paid += $apply;
            $invoice->updatePaymentStatus();
            $remaining -= $apply;
            $applied[] = ['invoice_no' => $invoice->invoice_no, 'amount' => $apply];
        }

        $reconciled = $gap - $remaining;
        ActivityLog::log('RECONCILE_INVOICES', $entity, "Reconciled ₹" . number_format($reconciled, 2) . " of unallocated payment for {$entity->name} across " . count($applied) . " invoice(s)");

        return ['applied' => $applied, 'reconciled' => $reconciled];
    }

    /**
     * FIFO-apply a settled amount onto the entity's own open invoices
     * (Sales for a Customer-type entity when money came IN, Purchases for a
     * Supplier-type entity when money went OUT). Matches by relation first,
     * falling back to name — same pattern used throughout EntityService.
     */
    private function applySettlementToInvoices(?\App\Models\Entity $entity, string $entityName, string $type, float $remaining): array
    {
        $applied = [];
        if ($remaining <= 0) return $applied;

        if ($type === 'IN') {
            $customerIds = \App\Models\Customer::where('name', $entityName)->pluck('id');
            if ($entity && $entity->relation_type === \App\Models\Customer::class && $entity->relation_id) {
                $customerIds->push($entity->relation_id);
            }
            if ($customerIds->isEmpty() && !$entity) return $applied;

            // accounting_entity_id is the direct, unambiguous link a Sale Invoice
            // keeps back to the exact entity it was posted against — matching by
            // customer name/relation alone misses invoices whose entity is typed
            // SHOP_CUSTOMER, or was created separately from the Customer record
            // without that relation ever being wired up, silently allocating
            // nothing even though the settlement's money is real.
            $invoices = \App\Models\SaleInvoice::where('is_cancelled', false)
                ->whereIn('payment_status', ['unpaid', 'partial'])
                ->where(function ($q) use ($entity, $customerIds) {
                    if ($entity) $q->orWhere('accounting_entity_id', $entity->id);
                    if ($customerIds->isNotEmpty()) $q->orWhereIn('customer_id', $customerIds->unique());
                })
                ->orderBy('sale_date')->orderBy('id')
                ->lockForUpdate()->get();

            foreach ($invoices as $invoice) {
                if ($remaining <= 0) break;
                $alreadyCovered = (float) $invoice->total_paid + (float) $invoice->exchange_paid
                    + ($invoice->finance_payment_status === 'RECEIVED' ? (float) $invoice->finance_amount : 0);
                $outstanding = max(0, (float) $invoice->grand_total - $alreadyCovered);
                if ($outstanding <= 0) continue;

                $apply = min($outstanding, $remaining);
                $invoice->total_paid += $apply;
                $invoice->updatePaymentStatus();
                $remaining -= $apply;
                $applied[] = ['invoice_no' => $invoice->invoice_no, 'type' => 'sale', 'amount' => $apply];
            }
        } elseif ($type === 'OUT') {
            $supplierIds = \App\Models\Supplier::where('name', $entityName)->pluck('id');
            if ($entity && $entity->relation_type === \App\Models\Supplier::class && $entity->relation_id) {
                $supplierIds->push($entity->relation_id);
            }
            if ($supplierIds->isEmpty() && !$entity) return $applied;

            // Same accounting_entity_id-first matching as the IN branch above.
            $invoices = \App\Models\PurchaseInvoice::whereIn('payment_status', ['unpaid', 'partial'])
                ->where(function ($q) use ($entity, $supplierIds) {
                    if ($entity) $q->orWhere('accounting_entity_id', $entity->id);
                    if ($supplierIds->isNotEmpty()) $q->orWhereIn('supplier_id', $supplierIds->unique());
                })
                ->orderBy('purchase_date')->orderBy('id')
                ->lockForUpdate()->get();

            foreach ($invoices as $invoice) {
                if ($remaining <= 0) break;
                $outstanding = max(0, (float) $invoice->grand_total - (float) $invoice->total_paid);
                if ($outstanding <= 0) continue;

                $apply = min($outstanding, $remaining);
                $invoice->total_paid += $apply;
                $invoice->updatePaymentStatus();
                $remaining -= $apply;
                $applied[] = ['invoice_no' => $invoice->invoice_no, 'type' => 'purchase', 'amount' => $apply];
            }
        }

        return $applied;
    }
}
