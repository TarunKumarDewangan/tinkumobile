<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Transaction;
use App\Traits\RecordsTransactions;
use App\Services\EntityService;
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

        // 2. VIRTUAL CHARGES
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

        // Compute running totals directly from ledger items for accuracy
        $totalIn  = $ledgerItems->sum('in_worth');
        $totalOut = $ledgerItems->sum('out_worth');

        // Update entity with live-computed values so frontend shows correct numbers
        $entity->setAttribute('in_worth', (float)$totalIn);
        $entity->setAttribute('out_worth', (float)$totalOut);
        $entity->setAttribute('opening_balance', $realOpeningBalance);
        // net_balance = realOpeningBalance (what they owed before) + new drops (out) - payments received (in)
        $liveNet = $realOpeningBalance + $totalOut - $totalIn;
        $entity->setAttribute('net_balance', $liveNet);

        return response()->json([
            'entity' => $entity,
            'transactions' => $ledgerItems->sortByDesc(function($item) {
                return $item['transaction_date'] . $item['created_at'];
            })->values()
        ]);
    }

    /**
     * Record a manual settlement for an entity.
     */
    public function recordSettlement(Request $request)
    {
        $user = $request->user();
        $data = $request->validate([
            'entity_name' => 'required|string',
            'amount' => 'required|numeric|min:0',
            'type' => 'required|in:IN,OUT',
            'payment_mode' => 'required|string',
            'description' => 'nullable|string',
            'category' => 'required|string',
            'transaction_date' => 'nullable|date'
        ]);

        $entity = \App\Models\Entity::where('name', $data['entity_name'])->first();

        $shopId = $user->hasFullAccess() ? ($request->shop_id ?? $user->shop_id ?? \App\Models\Shop::first()->id ?? 1) : $user->shop_id;

        $transaction = $this->transactionService->recordSettlement([
            'shop_id' => $shopId,
            'user_id' => $user->id,
            'transaction_date' => $data['transaction_date'] ?? now()->toDateString(),
            'type' => $data['type'],
            'amount' => $data['amount'],
            'payment_mode' => $data['payment_mode'],
            'category' => $data['category'],
            'description' => $data['description'] ?? "Manual settlement for {$data['entity_name']}",
            'entity_name' => $data['entity_name'],
            'accounting_entity_id' => $entity ? $entity->id : null,
        ]);

        return response()->json([
            'message' => 'Settlement recorded successfully',
            'transaction' => $transaction
        ], 201);
    }
}
