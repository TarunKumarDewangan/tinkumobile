<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Ledger;
use App\Models\Entity;
use Illuminate\Support\Facades\DB;
use App\Services\AccountingService;

class LedgerController extends Controller
{
    /**
     * Get the Daybook (All ledger entries for a specific date range)
     */
    public function daybook(Request $request)
    {
        $startDate = $request->query('start_date', now()->startOfMonth()->toDateString());
        $endDate = $request->query('end_date', now()->endOfMonth()->toDateString());

        $ledgers = Ledger::with('entity:id,name,type')
            ->whereHas('entity', function($q) {
                $q->where('type', '!=', 'RETAILER');
            })
            ->whereNotIn('voucher_type', ['SALE_FINANCE', 'FINANCE_PENDING'])
            ->whereBetween('date', [$startDate, $endDate])
            ->orderBy('date', 'desc')
            ->orderBy('id', 'desc')
            ->get();

        $totals = [
            'debit' => $ledgers->sum('debit'),
            'credit' => $ledgers->sum('credit'),
        ];

        // Attach each row's own voucher payment status (how much has actually
        // been paid on that specific invoice as of now, and what's still
        // outstanding) — only meaningful for SALE/PURCHASE voucher rows,
        // which are the only ones with a "grand total" to measure against.
        $saleIds = $ledgers->where('voucher_type', 'SALE')->pluck('voucher_id')->unique()->filter();
        $purchaseIds = $ledgers->where('voucher_type', 'PURCHASE')->pluck('voucher_id')->unique()->filter();

        $sales = \App\Models\SaleInvoice::whereIn('id', $saleIds)->get()->keyBy('id');
        $purchases = \App\Models\PurchaseInvoice::whereIn('id', $purchaseIds)->get()->keyBy('id');

        foreach ($ledgers as $ledger) {
            $paymentReceived = null;
            $balance = null;

            if ($ledger->voucher_type === 'SALE' && ($sale = $sales[$ledger->voucher_id] ?? null)) {
                $financeReceived = $sale->finance_payment_status === 'RECEIVED' ? (float) $sale->finance_amount : 0;
                $paymentReceived = (float) $sale->total_paid + (float) $sale->exchange_paid + $financeReceived;
                $balance = max(0, (float) $sale->grand_total - $paymentReceived);
            } elseif ($ledger->voucher_type === 'PURCHASE' && ($purchase = $purchases[$ledger->voucher_id] ?? null)) {
                $paymentReceived = (float) $purchase->total_paid;
                $balance = max(0, (float) $purchase->grand_total - $paymentReceived);
            }

            $ledger->payment_received = $paymentReceived;
            $ledger->voucher_balance = $balance;
        }

        return response()->json([
            'entries' => $ledgers,
            'totals' => $totals
        ]);
    }

    /**
     * Get the Ledger Statement for a specific Entity
     */
    public function statement(Request $request, $entityId)
    {
        $entity = Entity::findOrFail($entityId);

        // Bank/Card/UPI/Cash-Counter entities are asset (cash-holding) accounts,
        // not parties — money IN increases the balance instead of reducing
        // "what they owe us", so both the opening balance and the running
        // total below need the opposite sign convention from a normal party.
        $isAssetAccount = Entity::isAssetType($entity->type);

        $startDate = $request->query('start_date'); // null = all time
        $endDate = $request->query('end_date');

        // Calculate opening balance up to start_date
        $accounting = app(AccountingService::class);
        if ($isAssetAccount) {
            $openingBalance = (float) $entity->opening_balance;
            if ($startDate) {
                $priorMovements = Ledger::where('entity_id', $entityId)
                    ->where('date', '<', $startDate)
                    ->selectRaw('SUM(debit) as dr, SUM(credit) as cr')
                    ->first();
                $openingBalance += (float) ($priorMovements->cr ?? 0) - (float) ($priorMovements->dr ?? 0);
            }
        } else {
            $openingBalance = $startDate
                ? $accounting->getClosingBalance($entity, date('Y-m-d', strtotime($startDate . ' - 1 day')))
                : (($entity->balance_type === 'RECEIVABLE' ? 1 : -1) * (float)$entity->opening_balance);
        }

        $query = Ledger::where('entity_id', $entityId);
        if ($startDate) $query->where('date', '>=', $startDate);
        if ($endDate)   $query->where('date', '<=', $endDate);
        $ledgers = $query->orderBy('date', 'asc')
            ->orderBy('debit', 'desc')
            ->orderBy('id', 'asc')
            ->get();

        // Preload associated sale invoices, purchase invoices, and transactions to determine mobile category relevance
        $saleInvoiceIds = [];
        $purchaseInvoiceIds = [];
        $transactionIds = [];
        foreach ($ledgers as $ledger) {
            if ($ledger->voucher_type === 'SALE' || $ledger->voucher_type === 'SALE_FINANCE') {
                $saleInvoiceIds[] = $ledger->voucher_id;
            } elseif ($ledger->voucher_type === 'PURCHASE') {
                $purchaseInvoiceIds[] = $ledger->voucher_id;
            } elseif ($ledger->voucher_type === 'RECEIPT' || $ledger->voucher_type === 'PAYMENT') {
                $transactionIds[] = $ledger->voucher_id;
            }
        }
        
        $saleInvoices = \App\Models\SaleInvoice::whereIn('id', array_unique(array_filter($saleInvoiceIds)))
            ->with('items.product.category')
            ->get()
            ->keyBy('id');
            
        $purchaseInvoices = \App\Models\PurchaseInvoice::whereIn('id', array_unique(array_filter($purchaseInvoiceIds)))
            ->with('items.product.category')
            ->get()
            ->keyBy('id');
            
        $transactions = \App\Models\Transaction::whereIn('id', array_unique(array_filter($transactionIds)))
            ->get()
            ->keyBy('id');

        // Calculate running balances
        $runningBalance = $openingBalance;
        $statement = [];
        
        foreach ($ledgers as $ledger) {
            $vType = $ledger->voucher_type;
            $vId = $ledger->voucher_id;

            // Skip RECEIPT/PAYMENT entries whose transaction was soft-deleted (orphaned ledger rows)
            if (($vType === 'RECEIPT' || $vType === 'PAYMENT') && !isset($transactions[$vId])) {
                continue;
            }

            $runningBalance += $isAssetAccount
                ? ($ledger->credit - $ledger->debit)
                : ($ledger->debit - $ledger->credit);
            $ledger->running_balance = $runningBalance;

            $isNonMobile = false;
            $productNames = null;

            if ($vType === 'SALE' || $vType === 'SALE_FINANCE') {
                $invoice = $saleInvoices[$vId] ?? null;
                if ($invoice) {
                    $hasMobileItem = false;
                    foreach ($invoice->items as $item) {
                        $slug = strtolower(optional(optional($item->product)->category)->slug ?? '');
                        if ($slug === 'mobile-new' || $slug === 'mobile-old') {
                            $hasMobileItem = true;
                            break;
                        }
                    }
                    if (!$hasMobileItem) {
                        $isNonMobile = true;
                    }
                    $productNames = $invoice->items
                        ->map(fn($it) => ($it->product->name ?? 'Unknown') . ($it->quantity > 1 ? " (x{$it->quantity})" : ''))
                        ->implode(', ');
                }
            } elseif ($vType === 'PURCHASE') {
                $invoice = $purchaseInvoices[$vId] ?? null;
                if ($invoice) {
                    $hasMobileItem = false;
                    foreach ($invoice->items as $item) {
                        $slug = strtolower(optional(optional($item->product)->category)->slug ?? '');
                        if ($slug === 'mobile-new' || $slug === 'mobile-old') {
                            $hasMobileItem = true;
                            break;
                        }
                    }
                    if (!$hasMobileItem) {
                        $isNonMobile = true;
                    }
                    $productNames = $invoice->items
                        ->map(fn($it) => ($it->product->name ?? 'Unknown') . ($it->quantity > 1 ? " (x{$it->quantity})" : ''))
                        ->implode(', ');
                }
            } elseif ($vType === 'REPAIR') {
                $isNonMobile = true;
            } elseif ($vType === 'RECEIPT' || $vType === 'PAYMENT') {
                $tx = $transactions[$vId] ?? null;
                if ($tx) {
                    $txCategory = $tx->category;
                    $txType = $tx->entity_type;
                    $txRefId = $tx->entity_id;

                    $nonMobileCategories = ['RECHARGE_SALE', 'RECHARGE_PURCHASE', 'ACCESSORY_SALE', 'ACCESSORY_PURCHASE', 'SIM_SALE', 'SIM_PURCHASE', 'REPAIR'];
                    if (in_array($txCategory, $nonMobileCategories)) {
                        $isNonMobile = true;
                    } elseif (($txType === 'App\Models\SaleInvoice' || $txType === 'sale') && $txRefId) {
                        $invoice = \App\Models\SaleInvoice::with('items.product.category')->find($txRefId);
                        if ($invoice) {
                            $hasMobileItem = false;
                            foreach ($invoice->items as $item) {
                                $slug = strtolower(optional(optional($item->product)->category)->slug ?? '');
                                if ($slug === 'mobile-new' || $slug === 'mobile-old') {
                                    $hasMobileItem = true;
                                    break;
                                }
                            }
                            if (!$hasMobileItem) {
                                $isNonMobile = true;
                            }
                            $productNames = $invoice->items
                                ->map(fn($it) => ($it->product->name ?? 'Unknown') . ($it->quantity > 1 ? " (x{$it->quantity})" : ''))
                                ->implode(', ');
                        }
                    } elseif (($txType === 'App\Models\PurchaseInvoice' || $txType === 'purchase') && $txRefId) {
                        $invoice = \App\Models\PurchaseInvoice::with('items.product.category')->find($txRefId);
                        if ($invoice) {
                            $hasMobileItem = false;
                            foreach ($invoice->items as $item) {
                                $slug = strtolower(optional(optional($item->product)->category)->slug ?? '');
                                if ($slug === 'mobile-new' || $slug === 'mobile-old') {
                                    $hasMobileItem = true;
                                    break;
                                }
                            }
                            if (!$hasMobileItem) {
                                $isNonMobile = true;
                            }
                            $productNames = $invoice->items
                                ->map(fn($it) => ($it->product->name ?? 'Unknown') . ($it->quantity > 1 ? " (x{$it->quantity})" : ''))
                                ->implode(', ');
                        }
                    }
                }
            }
            $ledger->is_non_mobile = $isNonMobile;
            $ledger->product_names = $productNames ?: null;
            $statement[] = $ledger;
        }

        $entity->setAttribute('is_asset_account', $isAssetAccount);

        // Reserved exchange credit lives on the Customer record itself, not the
        // ledger — surface it here so the Entity Ledger page can show what's
        // separately reserved (see also EntityLedgerController::show, used by
        // the Sale form's own credit lookup).
        if ($entity->relation_type === \App\Models\Customer::class && $entity->relation_id) {
            $customer = \App\Models\Customer::find($entity->relation_id);
            $entity->setAttribute('exchange_credit_balance', (float) ($customer->exchange_credit_balance ?? 0));
        }

        return response()->json([
            'entity' => $entity,
            'opening_balance' => $openingBalance,
            'closing_balance' => $runningBalance,
            'entries' => $statement
        ]);
    }

    /**
     * Get entity balances (Entity Manager / Report)
     */
    public function entityBalances(Request $request)
    {
        $query = $request->query('q');
        $type = $request->query('type');
        
        $entities = Entity::query();
        if ($query) {
            $entities->where(function($q) use ($query) {
                $q->where('name', 'like', "%{$query}%")
                  ->orWhere('phone', 'like', "%{$query}%");
            });
        }
        if ($type) {
            $entities->where('type', $type);
        } else {
            $entities->where('type', '!=', 'RETAILER');
        }

        $entities = $entities->get();
        $accounting = app(AccountingService::class);

        // Bulk load all ledgers for the fetched entities to avoid N+1 query issues
        $entityIds = $entities->pluck('id');
        $ledgers = Ledger::whereIn('entity_id', $entityIds)->get();
        
        // Find transactions linked to RECEIPTS or PAYMENTS to check their target model type
        $transactionIds = $ledgers->whereIn('voucher_type', ['RECEIPT', 'PAYMENT'])->pluck('voucher_id')->unique();
        $transactions = \App\Models\Transaction::whereIn('id', $transactionIds)->get(['id', 'entity_type', 'entity_id', 'category']);
        $transactionMap = $transactions->pluck('entity_type', 'id')->toArray();
        $transactionCategoryMap = $transactions->pluck('category', 'id')->toArray();
        $transactionEntityIdMap = $transactions->pluck('entity_id', 'id')->toArray();

        // Find sale invoices and purchase invoices linked to ledgers to resolve product categories
        $saleInvoiceIds = collect();
        $purchaseInvoiceIds = collect();

        foreach ($ledgers as $ledger) {
            if ($ledger->voucher_type === 'SALE' || $ledger->voucher_type === 'SALE_FINANCE') {
                $saleInvoiceIds->push($ledger->voucher_id);
            } elseif ($ledger->voucher_type === 'PURCHASE') {
                $purchaseInvoiceIds->push($ledger->voucher_id);
            } elseif ($ledger->voucher_type === 'RECEIPT' || $ledger->voucher_type === 'PAYMENT') {
                $txId = $ledger->voucher_id;
                $txType = $transactionMap[$txId] ?? null;
                $txRefId = $transactionEntityIdMap[$txId] ?? null;
                if (($txType === 'App\Models\SaleInvoice' || $txType === 'sale') && $txRefId) {
                    $saleInvoiceIds->push($txRefId);
                } elseif (($txType === 'App\Models\PurchaseInvoice' || $txType === 'purchase') && $txRefId) {
                    $purchaseInvoiceIds->push($txRefId);
                }
            }
        }

        $saleInvoiceIds = $saleInvoiceIds->unique()->filter()->toArray();
        $purchaseInvoiceIds = $purchaseInvoiceIds->unique()->filter()->toArray();

        $saleInvoices = \App\Models\SaleInvoice::whereIn('id', $saleInvoiceIds)
            ->with('items.product.category')
            ->get()
            ->keyBy('id');

        $purchaseInvoices = \App\Models\PurchaseInvoice::whereIn('id', $purchaseInvoiceIds)
            ->with('items.product.category')
            ->get()
            ->keyBy('id');

        $results = $entities->map(function ($entity) use ($accounting, $ledgers, $transactionMap, $transactionCategoryMap, $transactionEntityIdMap, $saleInvoices, $purchaseInvoices) {
            $closing = $accounting->getClosingBalance($entity);
            
            // Filter ledgers in memory for this entity
            $entityLedgers = $ledgers->where('entity_id', $entity->id);

            // Bank/Card/UPI entities are asset (cash-holding) accounts, not
            // parties — money IN increases the balance instead of reducing
            // "what they owe us", and none of the sales/purchase/repair
            // category splitting below applies to them.
            if (\App\Models\Entity::isAssetType($entity->type)) {
                $totalIn = 0.0;
                $totalOut = 0.0;
                foreach ($entityLedgers as $ledger) {
                    // RECEIPT/PAYMENT rows: credit = money IN, debit = money OUT (see Transaction::getLedgerData()).
                    $totalIn += (float)$ledger->credit;
                    $totalOut += (float)$ledger->debit;
                }
                $assetNet = (float)$entity->opening_balance + $totalIn - $totalOut;

                return [
                    'id' => $entity->id,
                    'name' => $entity->name,
                    'phone' => $entity->phone,
                    'type' => $entity->type,
                    'opening_balance' => $entity->opening_balance,
                    'balance_type' => $entity->balance_type,
                    'net_balance' => $assetNet,
                    'sales_balance' => 0.0,
                    'purchase_balance' => 0.0,
                    'repairs_balance' => 0.0,
                    'works_balance' => $assetNet,
                    'sub_balances' => [
                        'NEW_MOBILE_SALE' => 0.0, 'NEW_MOBILE_PURCHASE' => 0.0,
                        'OLD_MOBILE_SALE' => 0.0, 'OLD_MOBILE_PURCHASE' => 0.0,
                        'RECHARGE_SALE' => 0.0, 'RECHARGE_PURCHASE' => 0.0,
                        'ACCESSORY_SALE' => 0.0, 'ACCESSORY_PURCHASE' => 0.0,
                        'SIM_SALE' => 0.0, 'SIM_PURCHASE' => 0.0,
                        'REPAIR' => 0.0, 'OTHER' => 0.0,
                    ],
                    'has_mobile' => false,
                    'is_asset_account' => true,
                ];
            }

            $salesBalance = 0.0;
            $repairsBalance = 0.0;
            $purchaseBalance = 0.0;
            $worksBalance = 0.0;

            $subBalances = [
                'NEW_MOBILE_SALE' => 0.0,
                'NEW_MOBILE_PURCHASE' => 0.0,
                'OLD_MOBILE_SALE' => 0.0,
                'OLD_MOBILE_PURCHASE' => 0.0,
                'RECHARGE_SALE' => 0.0,
                'RECHARGE_PURCHASE' => 0.0,
                'ACCESSORY_SALE' => 0.0,
                'ACCESSORY_PURCHASE' => 0.0,
                'SIM_SALE' => 0.0,
                'SIM_PURCHASE' => 0.0,
                'REPAIR' => 0.0,
                'OTHER' => 0.0,
            ];
            
            $hasMobile = false;
            $opBal = ($entity->balance_type === 'RECEIVABLE' ? 1 : -1) * (float)$entity->opening_balance;
            if ($entity->type === 'CUSTOMER' || $entity->type === 'SHOP_CUSTOMER') {
                $salesBalance += $opBal;
                $subBalances['NEW_MOBILE_SALE'] += $opBal;
                if ($entity->opening_balance > 0) {
                    $hasMobile = true;
                }
            } elseif ($entity->type === 'SUPPLIER' || $entity->type === 'DISTRIBUTOR') {
                $purchaseBalance += $opBal;
                $subBalances['NEW_MOBILE_PURCHASE'] += $opBal;
                if ($entity->opening_balance > 0) {
                    $hasMobile = true;
                }
            } else {
                $worksBalance += $opBal;
                $subBalances['OTHER'] += $opBal;
            }
            
            foreach ($entityLedgers as $ledger) {
                $vType = $ledger->voucher_type;
                $vId = $ledger->voucher_id;
                $movement = (float)$ledger->debit - (float)$ledger->credit;
                
                if ($vType === 'SALE' || $vType === 'SALE_FINANCE') {
                    $salesBalance += $movement;
                    $invoice = $saleInvoices[$vId] ?? null;
                    if ($invoice) {
                        $totalItemsVal = $invoice->items->sum('total');
                        if ($totalItemsVal > 0) {
                            foreach ($invoice->items as $item) {
                                $categorySlug = strtolower(optional(optional($item->product)->category)->slug ?? '');
                                $itemRatio = $item->total / $totalItemsVal;
                                $itemShare = $movement * $itemRatio;
                                
                                $mappedCategory = 'NEW_MOBILE_SALE';
                                if ($categorySlug === 'mobile-new') {
                                    $mappedCategory = 'NEW_MOBILE_SALE';
                                    $hasMobile = true;
                                } elseif ($categorySlug === 'mobile-old') {
                                    $mappedCategory = 'OLD_MOBILE_SALE';
                                    $hasMobile = true;
                                } elseif ($categorySlug === 'accessory') {
                                    $mappedCategory = 'ACCESSORY_SALE';
                                } elseif ($categorySlug === 'sim') {
                                    $mappedCategory = 'SIM_SALE';
                                } elseif ($categorySlug === 'recharge') {
                                    $mappedCategory = 'RECHARGE_SALE';
                                } elseif ($categorySlug === 'repair-service') {
                                    $mappedCategory = 'REPAIR';
                                }
                                
                                $subBalances[$mappedCategory] += $itemShare;
                            }
                        } else {
                            $subBalances['NEW_MOBILE_SALE'] += $movement;
                            $hasMobile = true;
                        }
                    } else {
                        $subBalances['NEW_MOBILE_SALE'] += $movement;
                        $hasMobile = true;
                    }
                } elseif ($vType === 'PURCHASE') {
                    $purchaseBalance += $movement;
                    $invoice = $purchaseInvoices[$vId] ?? null;
                    if ($invoice) {
                        $totalItemsVal = $invoice->items->sum('total');
                        if ($totalItemsVal > 0) {
                            foreach ($invoice->items as $item) {
                                $categorySlug = strtolower(optional(optional($item->product)->category)->slug ?? '');
                                $itemRatio = $item->total / $totalItemsVal;
                                $itemShare = $movement * $itemRatio;
                                
                                $mappedCategory = 'NEW_MOBILE_PURCHASE';
                                if ($categorySlug === 'mobile-new') {
                                    $mappedCategory = 'NEW_MOBILE_PURCHASE';
                                    $hasMobile = true;
                                } elseif ($categorySlug === 'mobile-old') {
                                    $mappedCategory = 'OLD_MOBILE_PURCHASE';
                                    $hasMobile = true;
                                } elseif ($categorySlug === 'accessory') {
                                    $mappedCategory = 'ACCESSORY_PURCHASE';
                                } elseif ($categorySlug === 'sim') {
                                    $mappedCategory = 'SIM_PURCHASE';
                                } elseif ($categorySlug === 'recharge') {
                                    $mappedCategory = 'RECHARGE_PURCHASE';
                                }
                                
                                $subBalances[$mappedCategory] += $itemShare;
                            }
                        } else {
                            $subBalances['NEW_MOBILE_PURCHASE'] += $movement;
                            $hasMobile = true;
                        }
                    } else {
                        $subBalances['NEW_MOBILE_PURCHASE'] += $movement;
                        $hasMobile = true;
                    }
                } elseif ($vType === 'REPAIR') {
                    $repairsBalance += $movement;
                    $subBalances['REPAIR'] += $movement;
                } elseif ($vType === 'RECEIPT' || $vType === 'PAYMENT') {
                    $txType = $transactionMap[$vId] ?? null;
                    $txRefId = $transactionEntityIdMap[$vId] ?? null;
                    $txCategory = $transactionCategoryMap[$vId] ?? null;
                    
                    if ($txType === 'App\Models\SaleInvoice' || $txType === 'sale') {
                        $salesBalance += $movement;
                    } elseif ($txType === 'App\Models\PurchaseInvoice' || $txType === 'purchase') {
                        $purchaseBalance += $movement;
                    } elseif ($txType === 'App\Models\RepairRequest' || $txType === 'repair') {
                        $repairsBalance += $movement;
                    } else {
                        $worksBalance += $movement;
                    }
 
                    if ($txCategory === 'RECHARGE_SALE') {
                        $subBalances['RECHARGE_SALE'] += $movement;
                    } elseif ($txCategory === 'RECHARGE_PURCHASE') {
                        $subBalances['RECHARGE_PURCHASE'] += $movement;
                    } elseif (($txType === 'App\Models\SaleInvoice' || $txType === 'sale') && $txRefId) {
                        $invoice = $saleInvoices[$txRefId] ?? null;
                        if ($invoice) {
                            $totalItemsVal = $invoice->items->sum('total');
                            if ($totalItemsVal > 0) {
                                foreach ($invoice->items as $item) {
                                    $categorySlug = strtolower(optional(optional($item->product)->category)->slug ?? '');
                                    $itemRatio = $item->total / $totalItemsVal;
                                    $itemShare = $movement * $itemRatio;
                                    
                                    $mappedCategory = 'NEW_MOBILE_SALE';
                                    if ($categorySlug === 'mobile-new') {
                                        $mappedCategory = 'NEW_MOBILE_SALE';
                                        $hasMobile = true;
                                    } elseif ($categorySlug === 'mobile-old') {
                                        $mappedCategory = 'OLD_MOBILE_SALE';
                                        $hasMobile = true;
                                    } elseif ($categorySlug === 'accessory') {
                                        $mappedCategory = 'ACCESSORY_SALE';
                                    } elseif ($categorySlug === 'sim') {
                                        $mappedCategory = 'SIM_SALE';
                                    } elseif ($categorySlug === 'recharge') {
                                        $mappedCategory = 'RECHARGE_SALE';
                                    } elseif ($categorySlug === 'repair-service') {
                                        $mappedCategory = 'REPAIR';
                                    }
                                    
                                    $subBalances[$mappedCategory] += $itemShare;
                                }
                            } else {
                                $subBalances['NEW_MOBILE_SALE'] += $movement;
                                $hasMobile = true;
                            }
                        } else {
                            $subBalances['NEW_MOBILE_SALE'] += $movement;
                            $hasMobile = true;
                        }
                    } elseif (($txType === 'App\Models\PurchaseInvoice' || $txType === 'purchase') && $txRefId) {
                        $invoice = $purchaseInvoices[$txRefId] ?? null;
                        if ($invoice) {
                            $totalItemsVal = $invoice->items->sum('total');
                            if ($totalItemsVal > 0) {
                                foreach ($invoice->items as $item) {
                                    $categorySlug = strtolower(optional(optional($item->product)->category)->slug ?? '');
                                    $itemRatio = $item->total / $totalItemsVal;
                                    $itemShare = $movement * $itemRatio;
                                    
                                    $mappedCategory = 'NEW_MOBILE_PURCHASE';
                                    if ($categorySlug === 'mobile-new') {
                                        $mappedCategory = 'NEW_MOBILE_PURCHASE';
                                        $hasMobile = true;
                                    } elseif ($categorySlug === 'mobile-old') {
                                        $mappedCategory = 'OLD_MOBILE_PURCHASE';
                                        $hasMobile = true;
                                    } elseif ($categorySlug === 'accessory') {
                                        $mappedCategory = 'ACCESSORY_PURCHASE';
                                    } elseif ($categorySlug === 'sim') {
                                        $mappedCategory = 'SIM_PURCHASE';
                                    } elseif ($categorySlug === 'recharge') {
                                        $mappedCategory = 'RECHARGE_PURCHASE';
                                    }
                                    
                                    $subBalances[$mappedCategory] += $itemShare;
                                }
                            } else {
                                $subBalances['NEW_MOBILE_PURCHASE'] += $movement;
                                $hasMobile = true;
                            }
                        } else {
                            $subBalances['NEW_MOBILE_PURCHASE'] += $movement;
                            $hasMobile = true;
                        }
                    } elseif (($txType === 'App\Models\RepairRequest' || $txType === 'repair') && $txRefId) {
                        $subBalances['REPAIR'] += $movement;
                    } else {
                        $subBalances['OTHER'] += $movement;
                    }
                } else {
                    $worksBalance += $movement;
                    $subBalances['OTHER'] += $movement;
                }
            }
            
            return [
                'id' => $entity->id,
                'name' => $entity->name,
                'phone' => $entity->phone,
                'type' => $entity->type,
                'opening_balance' => $entity->opening_balance,
                'balance_type' => $entity->balance_type,
                'net_balance' => $closing,
                'sales_balance' => $salesBalance,
                'purchase_balance' => $purchaseBalance,
                'repairs_balance' => $repairsBalance,
                'works_balance' => $worksBalance,
                'sub_balances' => $subBalances,
                'has_mobile' => $hasMobile,
                'is_asset_account' => false,
            ];
        })->filter(function($e) use ($query) {
            // Show all entities including zero balance entities
            return true;
        })->values();

        return response()->json($results);
    }

    /**
     * Get overall summary of all entities (Receivable vs Payable)
     */
    public function summary()
    {
        $entities = DB::select("
            SELECT 
                e.id, 
                e.opening_balance * CASE WHEN e.balance_type = 'RECEIVABLE' THEN 1 ELSE -1 END as op_bal,
                COALESCE(SUM(l.debit), 0) as total_debit,
                COALESCE(SUM(l.credit), 0) as total_credit
            FROM entities e
            LEFT JOIN ledgers l ON e.id = l.entity_id
            WHERE e.type != 'RETAILER'
            GROUP BY e.id, e.opening_balance, e.balance_type
        ");

        $receivable = 0;
        $payable = 0;
        
        foreach($entities as $e) {
            $bal = $e->op_bal + $e->total_debit - $e->total_credit;
            if ($bal > 0) $receivable += $bal;
            if ($bal < 0) $payable += abs($bal);
        }

        return response()->json([
            'overallTotal' => $receivable - $payable,
            'receivable' => $receivable,
            'payable' => $payable,
        ]);
    }

    /**
     * Get detailed breakdown of accounts contributing to summary totals
     */
    public function breakdown(Request $request)
    {
        $type = $request->query('type', 'OVERALL'); // RECEIVABLE, PAYABLE, OVERALL
        
        $entities = Entity::where('type', '!=', 'RETAILER')->get();
        $accounting = app(AccountingService::class);
        
        $results = [];
        foreach($entities as $entity) {
            $balance = $accounting->getClosingBalance($entity);
            
            if (round($balance, 2) == 0) continue;
            
            if ($type === 'RECEIVABLE' && $balance <= 0) continue;
            if ($type === 'PAYABLE' && $balance >= 0) continue;
            
            $results[] = [
                'id' => $entity->id,
                'name' => $entity->name,
                'phone' => $entity->phone,
                'type' => $entity->type,
                'balance' => (float)$balance
            ];
        }
        
        // Sort by magnitude of balance
        usort($results, function($a, $b) {
            return abs($b['balance']) <=> abs($a['balance']);
        });
        
        return response()->json($results);
    }
}
