<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SaleInvoice;
use App\Models\SaleItem;
use App\Models\SaleGiftItem;
use App\Models\Inventory;
use App\Models\GiftInventory;
use App\Models\EmployeeIncentive;
use App\Models\Category;
use App\Models\ActivityLog;
use App\Models\Setting;
use App\Traits\RecordsTransactions;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

use App\Http\Resources\SaleInvoiceResource;

class SaleInvoiceController extends Controller
{
    protected $transactionService;
    protected $invoiceService;

    public function __construct(\App\Services\TransactionService $transactionService, \App\Services\InvoiceService $invoiceService)
    {
        $this->transactionService = $transactionService;
        $this->invoiceService = $invoiceService;
    }

    public function index(Request $request)
    {
        $user = $request->user();
        $query = SaleInvoice::with('customer', 'user', 'items.product.brand', 'items.product.category', 'financer', 'financePlan', 'shop');

        if (! $user->hasFullAccess()) {
            $query->where('shop_id', $user->shop_id);
        } elseif ($request->shop_id) {
            $query->where('shop_id', $request->shop_id);
        }

        if ($request->bill_type) $query->where('bill_type', $request->bill_type);
        if ($request->from) $query->where('sale_date', '>=', $request->from);
        if ($request->to) $query->where('sale_date', '<=', $request->to);

        if ($request->category_group) {
            $group = $request->category_group;
            if ($group === 'new_mobile') {
                $query->whereHas('items.product.category', function($q) {
                    $q->whereIn('slug', ['MOBILE-NEW', 'mobile-new']);
                });
            } elseif ($group === 'old_mobile') {
                $query->whereHas('items.product.category', function($q) {
                    $q->whereIn('slug', ['MOBILE-OLD', 'mobile-old']);
                });
            } elseif ($group === 'other') {
                $query->whereHas('items.product.category', function($q) {
                    $q->whereNotIn('slug', ['MOBILE-NEW', 'mobile-new', 'MOBILE-OLD', 'mobile-old']);
                });
            }
        } elseif ($request->has('is_old_mobile')) {
            $isOld = filter_var($request->is_old_mobile, FILTER_VALIDATE_BOOLEAN);
            if ($isOld) {
                $query->whereHas('items.product.category', function($q) {
                    $q->whereIn('slug', ['MOBILE-OLD', 'mobile-old']);
                });
            } else {
                $query->whereDoesntHave('items.product.category', function($q) {
                    $q->whereIn('slug', ['MOBILE-OLD', 'mobile-old']);
                });
            }
        }

        // Customer type filter
        if ($request->customer_category === 'WALK_IN') {
            $query->whereNull('customer_id');
        } elseif ($request->customer_category) {
            $query->whereHas('customer', fn($q) => $q->where('category', $request->customer_category));
        }

        // Financer-based sales filter (for Finance Tracker)
        if ($request->has_financer) {
            $query->whereNotNull('financer_id');
        }
        if ($request->finance_payment_status) {
            $query->where('finance_payment_status', $request->finance_payment_status);
        }

        // Pending Balance page — only New Mobile + Old/2nd Mobile sales with money
        // still outstanding, never cancelled ones.
        if ($request->has_balance) {
            $query->whereIn('payment_status', ['unpaid', 'partial'])
                ->where('is_cancelled', false)
                ->whereHas('items.product.category', function ($q) {
                    $q->whereIn('slug', ['MOBILE-NEW', 'mobile-new', 'MOBILE-OLD', 'mobile-old']);
                });
        }

        if ($request->search) {
            $s = $request->search;
            $query->where(function($q) use ($s) {
                $q->where('invoice_no', 'like', "%$s%")
                  ->orWhereHas('customer', fn($cq) => $cq->where('name', 'like', "%$s%")->orWhere('phone', 'like', "%$s%"))
                  ->orWhereHas('items', fn($iq) => $iq->where('imei', 'like', "%$s%"));
            });
        }

        if ($request->model) {
            $m = $request->model;
            $query->whereHas('items.product', fn($q) => $q->where('name', 'like', "%$m%"));
        }
        if ($request->color) {
            $c = $request->color;
            $query->whereHas('items', fn($q) => $q->where('color', 'like', "%$c%"));
        }
        if ($request->imei) {
            $i = $request->imei;
            $query->whereHas('items', fn($q) => $q->where('imei', 'like', "%$i%"));
        }

        return SaleInvoiceResource::collection($query->latest()->paginate($request->per_page ?? 50));
    }

    public function store(Request $request)
    {
        $user = $request->user();
        $shopId = $user->hasFullAccess() ? $request->shop_id : $user->shop_id;

        $data = $request->validate([
            'idempotency_key'  => 'nullable|string|max:100',
            'shop_id'          => $user->hasFullAccess() ? 'required|exists:shops,id' : 'nullable',
            'sold_by_id'       => 'nullable|exists:users,id',
            'customer_id'      => 'nullable|exists:customers,id',
            'customer_name'    => 'nullable|string|max:150',
            'customer_phone'   => 'nullable|string|max:20',
            'customer_email'   => 'nullable|email|max:100',
            'customer_address' => 'nullable|string',
            'sale_date'        => 'required|date',
            'bill_type'        => 'in:kaccha,pakka',
            'payment_method'   => 'nullable|string',
            'discount'         => 'nullable|numeric|min:0',
            'total_paid'       => 'nullable|numeric|min:0',
            'exchange_paid'    => 'nullable|numeric|min:0',
            'cgst_rate'        => 'nullable|numeric|min:0',
            'sgst_rate'        => 'nullable|numeric|min:0',
            'calculate_gst'    => 'nullable|boolean',
            'cash_discount'    => 'nullable|numeric|min:0',
            'is_cash_discount_on_bill' => 'nullable|boolean',
            'rounding_mode'    => 'nullable|in:auto,up,down,manual',
            'round_off'        => 'nullable|numeric',
            'cgst_amount'      => 'nullable|numeric',
            'sgst_amount'      => 'nullable|numeric',
            'is_gst_manual'    => 'nullable|boolean',
            'notes'            => 'nullable|string',
            'items'            => 'required|array|min:1',
            'items.*.product_id'  => 'required|exists:products,id',
            'items.*.quantity'    => 'required|integer|min:1',
            'items.*.unit_price'  => 'required|numeric|min:0',
            // sale_items.imei is varchar(255) — cap validation to match so an
            // over-long value fails cleanly here instead of erroring at the DB.
            'items.*.imei'        => 'nullable|string|max:255',
            'items.*.ram'         => 'nullable|string',
            'items.*.storage'     => 'nullable|string',
            'items.*.color'       => 'nullable|string',
            'items.*.description' => 'nullable|string',
            'items.*.apply_gst'   => 'nullable|boolean',
            'gift_items'          => 'nullable|array',
            'gift_items.*.gift_product_id' => 'exists:gift_products,id',
            'gift_items.*.quantity'        => 'integer|min:1',
            // External Finance / EMI (Bajaj, HDB, etc.)
            'financer_id'              => 'nullable|exists:entities,id',
            'down_payment'             => 'nullable|numeric|min:0',
            'finance_amount'           => 'nullable|numeric|min:0',
            'finance_payment_status'   => 'nullable|in:RECEIVED,PENDING',
            // Shop Finance Plan (Personal EMI or Favor)
            'shop_finance.type'           => 'nullable|in:PERSONAL,FAVOR',
            'shop_finance.principal'      => 'nullable|numeric|min:0.01',
            'shop_finance.down_payment'   => 'nullable|numeric|min:0',
            'shop_finance.interest_rate'  => 'nullable|numeric|min:0',
            'shop_finance.interest_type'  => 'nullable|in:FLAT,REDUCING',
            'shop_finance.total_payable'  => 'nullable|numeric|min:0',
            'shop_finance.tenure_months'  => 'nullable|integer|min:1|max:360',
            'shop_finance.emi_start_date' => 'nullable|date',
        ]);

        if (!$data['customer_id'] && !$data['customer_phone']) {
            return response()->json(['message' => 'Customer selection or phone number is required.'], 422);
        }

        if ($priceError = $this->validateItemPriceBounds($data['items'], $user)) {
            return $priceError;
        }

        if ($imeiError = $this->validateNewMobileImeiRequired($data['items'], $user)) {
            return $imeiError;
        }

        // Idempotency check — prevent duplicate submissions
        if (!empty($data['idempotency_key'])) {
            $existing = SaleInvoice::where('shop_id', $shopId)
                ->where('idempotency_key', $data['idempotency_key'])
                ->where('created_at', '>=', now()->subMinutes(5))
                ->first();
            if ($existing) {
                return response()->json($existing->load('items.product.brand', 'giftItems.giftProduct', 'customer'), 200);
            }
        }

        $customerId = $data['customer_id'] ?? $this->syncCustomer($data, 'SALE');

        DB::beginTransaction();
        try {
            // GST calculation via shared InvoiceService (inclusive-pricing model)
            $gst = $this->invoiceService->calculateInclusiveTotals($data, $data['items']);
            extract($gst);

            $roundingMode = $data['rounding_mode'] ?? 'auto';
            $roundOff     = (float) ($data['round_off'] ?? 0);

            if ($roundingMode === 'up') $grandTotal = ceil($rawGrandTotal);
            else if ($roundingMode === 'down') $grandTotal = floor($rawGrandTotal);
            else if ($roundingMode === 'auto') $grandTotal = round($rawGrandTotal);
            else $grandTotal = $rawGrandTotal + $roundOff; 
            
            if ($request->has('round_off')) {
                $grandTotal = $rawGrandTotal + $roundOff;
            }

            $invoiceNo   = ($data['bill_type'] === 'pakka' ? 'SAL-PKK-' : 'SAL-KCH-') . date('Ymd') . '-' . strtoupper(substr(uniqid(), -4));

            $invoice = SaleInvoice::create([
                'invoice_no'     => $invoiceNo,
                'shop_id'        => $shopId,
                'customer_id'    => $customerId,
                'user_id'        => $user->id,
                'sold_by_id'     => $data['sold_by_id'] ?? null,
                'sale_date'      => $data['sale_date'],
                'total_amount'   => $totalAmount,
                'cgst_rate'      => $cgstRate,
                'sgst_rate'      => $sgstRate,
                'cgst_amount'    => $cgstAmount,
                'sgst_amount'    => $sgstAmount,
                'calculate_gst'  => $calculateGst,
                'discount'       => $discount,
                'cash_discount'  => $cashDiscount,
                'is_cash_discount_on_bill' => $isCashDiscOnBill,
                'grand_total'    => $grandTotal,
                'rounding_mode'  => $roundingMode,
                'round_off'      => $roundOff,
                'total_paid'     => $data['total_paid'] ?? 0,
                'exchange_paid'  => $data['exchange_paid'] ?? 0,
                'payment_method' => $data['payment_method'] ?? 'cash',
                'bill_type'      => $data['bill_type'] ?? 'kaccha',
                'notes'          => $data['notes'] ?? null,
                // Finance fields
                'financer_id'           => $data['financer_id'] ?? null,
                'down_payment'          => $data['down_payment'] ?? 0,
                'finance_amount'        => $data['finance_amount'] ?? 0,
                'finance_payment_status' => $data['finance_payment_status'] ?? null,
            ]);

            $invoice->updatePaymentStatus();

            // Record Income Transaction using Service (Only for the cash portion, not exchange credit)
            $cashPaid = (float) ($invoice->total_paid);
            if ($cashPaid > 0) {
                $itemNames = $this->itemNamesSummary($data['items']);
                $this->transactionService->recordForModel($invoice, [
                    'type'        => 'IN',
                    'category'    => 'SALE_INCOME',
                    'amount'      => $cashPaid,
                    'description' => "Sale income recorded for Invoice #{$invoice->invoice_no} ({$invoice->customer_name})" . ($itemNames ? " [{$itemNames}]" : ''),
                ]);
            }

            // Record Finance Company transaction if applicable
            $financeAmt = (float) ($data['finance_amount'] ?? 0);
            $financerId = $data['financer_id'] ?? null;
            if ($financeAmt > 0 && $financerId) {
                $financer = \App\Models\Entity::find($financerId);
                $financePayStatus = $data['finance_payment_status'] ?? 'RECEIVED';
                if ($financer) {
                    if ($financePayStatus === 'RECEIVED') {
                        // Finance company paid us — record transaction linked to their entity
                        // so it creates a Credit (Cr) entry in their ledger.
                        $this->transactionService->recordForModel($invoice, [
                            'type'                 => 'IN',
                            'category'             => 'FINANCE_INCOME',
                            'amount'               => $financeAmt,
                            'payment_mode'         => 'FINANCE',
                            'accounting_entity_id' => $financer->id,
                            'entity_name'          => $financer->name,
                            'description'          => "Finance payment received from {$financer->name} for Invoice #{$invoice->invoice_no}",
                        ]);
                    }
                    // For PENDING: the SaleInvoice model's getLedgerData() automatically posts 
                    // the FINANCE_PENDING Debit (Dr) to the financer's ledger. No manual code needed!
                }
            }

            $mobileCatId = Category::mobileNewId();

            foreach ($data['items'] as $item) {
                $total = $item['quantity'] * $item['unit_price'];
                $saleItem = SaleItem::create([
                    'sale_invoice_id' => $invoice->id,
                    'product_id'      => $item['product_id'],
                    'imei'            => $item['imei'] ?? null,
                    'ram'             => $item['ram'] ?? null,
                    'storage'         => $item['storage'] ?? null,
                    'color'           => $item['color'] ?? null,
                    'description'     => $item['description'] ?? null,
                    'quantity'        => $item['quantity'],
                    'unit_price'      => $item['unit_price'],
                    'total'           => $total,
                    'apply_gst'       => !isset($item['apply_gst']) || filter_var($item['apply_gst'], FILTER_VALIDATE_BOOLEAN),
                ]);

                Inventory::removeStock($shopId, $item['product_id'], $item['quantity']);

                if ($mobileCatId) {
                    $product = \App\Models\Product::find($item['product_id']);
                    if ($product && $product->category_id == $mobileCatId) {
                        $incentiveRate = (float) Cache::remember('incentive_rate_percent', 3600, function () {
                            return Setting::where('key', 'incentive_rate_percent')->value('value') ?? 1;
                        });
                        $incentive = $item['unit_price'] * ($incentiveRate / 100);
                        EmployeeIncentive::create([
                            'user_id'          => $user->id,
                            'sale_item_id'     => $saleItem->id,
                            'product_id'       => $item['product_id'],
                            'incentive_amount' => $incentive,
                        ]);
                    }
                }
            }

            if (!empty($data['gift_items'])) {
                foreach ($data['gift_items'] as $gift) {
                    SaleGiftItem::create([
                        'sale_invoice_id' => $invoice->id,
                        'gift_product_id' => $gift['gift_product_id'],
                        'quantity'        => $gift['quantity'],
                    ]);
                    $gInv = GiftInventory::firstOrCreate(
                        ['shop_id' => $shopId, 'gift_product_id' => $gift['gift_product_id']],
                        ['stock' => 0]
                    );
                    $gInv->decrement('stock', $gift['quantity']);
                }
            }

            // Track idempotency_key on the invoice if provided
            if (!empty($data['idempotency_key'])) {
                DB::table('sale_invoices')->where('id', $invoice->id)->update(['idempotency_key' => $data['idempotency_key']]);
            }

            // Create Shop Finance Plan if requested
            if (!empty($data['shop_finance']['type']) && !empty($data['shop_finance']['principal'])) {
                $sf           = $data['shop_finance'];
                $interestType = $sf['interest_type'] ?? 'REDUCING';
                $months       = (int) ($sf['tenure_months'] ?? 0);
                $principal    = (float) $sf['principal'];

                // "Total payable" is an alternative way to specify the deal
                // (staff already agreed a fixed repayment figure with the
                // customer) — derive the effective interest_rate from it
                // here, authoritatively, rather than trusting the client's
                // preview calculation.
                if (empty($sf['interest_rate']) && !empty($sf['total_payable'])) {
                    [$monthlyEmi, $totalPayable, $impliedRate] = \App\Http\Controllers\Api\FinancePlanController::calcEmiFromTotalPayable(
                        $principal,
                        (float) $sf['total_payable'],
                        $months,
                        $interestType
                    );
                    $interestRate = $impliedRate;
                } else {
                    $interestRate = (float) ($sf['interest_rate'] ?? 0);
                    [$monthlyEmi, $totalPayable] = \App\Http\Controllers\Api\FinancePlanController::calcEmi(
                        $principal,
                        $interestRate,
                        $months,
                        $interestType
                    );
                }

                \App\Models\SaleFinancePlan::create([
                    'sale_invoice_id' => $invoice->id,
                    'customer_id'     => $invoice->customer_id,
                    'type'            => $sf['type'],
                    'down_payment'    => $sf['down_payment'] ?? 0,
                    'principal'       => $principal,
                    'interest_rate'   => $interestRate ?: null,
                    'interest_type'   => $sf['type'] === 'PERSONAL' ? $interestType : 'REDUCING',
                    'tenure_months'   => $sf['tenure_months'] ?? null,
                    'monthly_emi'     => $sf['type'] === 'PERSONAL' ? $monthlyEmi : null,
                    'emi_start_date'  => $sf['type'] === 'PERSONAL'
                                            ? ($sf['emi_start_date'] ?? now()->addMonth()->startOfMonth()->toDateString())
                                            : null,
                    'total_payable'   => $sf['type'] === 'PERSONAL' ? $totalPayable : $principal,
                    'total_paid'      => 0,
                    'status'          => 'ACTIVE',
                    'created_by'      => $user->id,
                ]);

                // A Shop Finance down payment is real cash received, exactly like
                // the total_paid branch above — but it lives on the finance plan,
                // not on the invoice, so it was never reaching the Ledger. Without
                // this, the customer's Entity Ledger/net balance kept counting the
                // full grand_total as owed even after the down payment was taken.
                $downPayment = (float) ($sf['down_payment'] ?? 0);
                if ($downPayment > 0) {
                    $this->transactionService->recordForModel($invoice, [
                        'type'        => 'IN',
                        'category'    => 'SHOP_FINANCE_DOWN_PAYMENT',
                        'amount'      => $downPayment,
                        'description' => "Shop Finance down payment for Invoice #{$invoice->invoice_no}",
                    ]);
                }

                // Personal (EMI) plans repay principal + interest — the invoice's
                // own SALE debit only ever reflected the goods' sale price, so the
                // interest portion (what the customer will actually pay on top of
                // that) was invisible to the Ledger. Post it as its own debit so
                // the customer's ledger balance matches total_payable exactly, the
                // same figure Finance Tracker/Personal Finance already show.
                if ($sf['type'] === 'PERSONAL') {
                    $interestPortion = max(0, $totalPayable - $principal);
                    if ($interestPortion > 0) {
                        $entity = $this->resolveCustomerEntity($invoice);
                        if ($entity) {
                            app(\App\Services\AccountingService::class)->post(
                                $entity->id,
                                $invoice->sale_date,
                                'SHOP_FINANCE_INTEREST',
                                $invoice->id,
                                "Shop Finance interest for Invoice #{$invoice->invoice_no}",
                                $interestPortion,
                                0,
                                $invoice->shop_id,
                                $user->id
                            );
                        }
                    }
                }
            }

            DB::commit();

            // Audit log
            ActivityLog::log('SALE_CREATED', $user, "Sale #{$invoice->invoice_no} created — Total: ₹{$grandTotal}");

            // Send Sale Notification (WhatsApp + Telegram)
            $customerName = $invoice->customer_name ?? 'Walk-in';
            $itemsSummary = $this->itemNamesSummary($data['items']);
            $cashPaid = (float) $invoice->total_paid;
            $shopName = \App\Models\Shop::find($shopId)?->name;

            // External finance (Bajaj/HDB/etc.) money is tracked separately from
            // total_paid — only count it as "collected" toward the balance when it's
            // actually been received, not just pending, otherwise the balance due looks
            // wrong (e.g. shows the full unfinanced amount even though a finance company
            // already covered most of it).
            $financeAmt = (float) $invoice->finance_amount;
            $financer = $invoice->financer_id ? \App\Models\Entity::find($invoice->financer_id) : null;
            $financeReceived = ($financer && $invoice->finance_payment_status === 'RECEIVED') ? $financeAmt : 0;
            $totalCollected = $cashPaid + $financeReceived;
            $balance = max(0, $grandTotal - $totalCollected);

            $msg = "🛍️ *New Sale!*\n";
            $msg .= "Invoice: #{$invoiceNo}\n";
            if ($shopName) $msg .= "Shop: {$shopName}\n";
            $msg .= "Customer: {$customerName}\n";
            if ($itemsSummary) $msg .= "Items: {$itemsSummary}\n";
            $msg .= "Amount: ₹" . number_format($grandTotal, 2) . "\n";
            $msg .= "Cash/Card Paid: ₹" . number_format($cashPaid, 2) . "\n";
            if ($financer) {
                $msg .= "Finance ({$financer->name}): ₹" . number_format($financeAmt, 2) . " — " . ($invoice->finance_payment_status === 'RECEIVED' ? 'Received' : 'Pending') . "\n";
            }
            if ($balance > 0.01) $msg .= "Balance Due: ₹" . number_format($balance, 2) . "\n";
            $msg .= "Payment Mode: " . strtoupper($invoice->payment_method ?? 'CASH') . "\n";
            $msg .= "Bill Type: " . strtoupper($invoice->bill_type) . "\n";
            if (!empty($data['shop_finance']['type']) && !empty($data['shop_finance']['principal'])) {
                $msg .= "Shop Finance: " . ucfirst(strtolower($data['shop_finance']['type'])) . " — ₹" . number_format($data['shop_finance']['principal'], 2) . "\n";
            }
            $msg .= "By: {$user->name}";

            $this->notifyOwner($msg);

            return response()->json($invoice->load('items.product.brand', 'giftItems.giftProduct', 'customer'), 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->errorResponse($e, 'Failed to create sale');
        }
    }

    public function show(Request $request, SaleInvoice $saleInvoice)
    {
        $user = $request->user();
        if (! $user->hasFullAccess() && $saleInvoice->shop_id !== $user->shop_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        return new SaleInvoiceResource($saleInvoice->load('customer', 'user', 'soldBy', 'items.product.category', 'items.product.brand', 'giftItems.giftProduct', 'shop', 'financer', 'financePlan.payments'));
    }

    public function addPayment(Request $request, SaleInvoice $saleInvoice)
    {
        $data = $request->validate([
            'amount' => 'required|numeric|min:0.01'
        ]);

        return DB::transaction(function () use ($data, $saleInvoice) {
            // Re-fetch lock to serialize simultaneous payment requests safely
            $invoice = SaleInvoice::lockForUpdate()->findOrFail($saleInvoice->id);

            $invoice->total_paid += $data['amount'];
            $invoice->updatePaymentStatus();

            // Record Transaction using Service
            $itemNames = $invoice->items()->with('product')->get()
                ->map(fn($it) => ($it->product->name ?? 'Unknown') . ($it->quantity > 1 ? " (x{$it->quantity})" : ''))
                ->implode(', ');
            $this->transactionService->recordForModel($invoice, [
                'type'             => 'IN',
                'category'         => 'SALE',
                'amount'           => $data['amount'],
                'description'      => "Partial payment for Invoice #{$invoice->invoice_no} ({$invoice->customer_name})" . ($itemNames ? " [{$itemNames}]" : ''),
            ]);

            return response()->json([
                'message' => 'Payment added successfully',
                'total_paid' => $invoice->total_paid,
                'payment_status' => $invoice->payment_status
            ]);
        });
    }

    public function update(Request $request, SaleInvoice $saleInvoice)
    {
        $user = $request->user();
        if (!$user->hasFullAccess() && $saleInvoice->shop_id !== $user->shop_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if ($saleInvoice->is_cancelled) {
            return response()->json(['message' => 'Cannot update cancelled sale'], 422);
        }

        $data = $request->validate([
            'customer_id'    => 'required|exists:customers,id',
            'sold_by_id'     => 'nullable|exists:users,id',
            'sale_date'      => 'required|date',
            'discount'       => 'nullable|numeric|min:0',
            'calculate_gst'  => 'nullable|boolean',
            'cash_discount'  => 'nullable|numeric|min:0',
            'is_cash_discount_on_bill' => 'nullable|boolean',
            'cgst_rate'      => 'nullable|numeric|min:0',
            'sgst_rate'      => 'nullable|numeric|min:0',
            'rounding_mode'  => 'nullable|in:auto,up,down,manual',
            'round_off'      => 'nullable|numeric',
            'cgst_amount'    => 'nullable|numeric',
            'sgst_amount'    => 'nullable|numeric',
            'is_gst_manual'  => 'nullable|boolean',
            'payment_method' => 'nullable|string',
            'notes'          => 'nullable|string',
            'items'          => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.quantity'   => 'required|integer|min:1',
            'items.*.unit_price' => 'required|numeric|min:0',
            // sale_items.imei is varchar(255) — cap validation to match so an
            // over-long value fails cleanly here instead of erroring at the DB.
            'items.*.imei'        => 'nullable|string|max:255',
            'items.*.ram'         => 'nullable|string',
            'items.*.storage'     => 'nullable|string',
            'items.*.color'       => 'nullable|string',
            'items.*.description' => 'nullable|string',
            'items.*.apply_gst'   => 'nullable|boolean',
            'total_paid'             => 'nullable|numeric|min:0',
            'exchange_paid'          => 'nullable|numeric|min:0',
            // Finance/EMI fields
            'financer_id'            => 'nullable|exists:entities,id',
            'down_payment'           => 'nullable|numeric|min:0',
            'finance_amount'         => 'nullable|numeric|min:0',
            'finance_payment_status' => 'nullable|in:PENDING,RECEIVED',
            // Shop Finance Plan (Personal EMI or Favor) — was previously only
            // accepted on create; editing a sale to add/update one silently did nothing.
            'shop_finance.type'           => 'nullable|in:PERSONAL,FAVOR',
            'shop_finance.principal'      => 'nullable|numeric|min:0.01',
            'shop_finance.down_payment'   => 'nullable|numeric|min:0',
            'shop_finance.interest_rate'  => 'nullable|numeric|min:0',
            'shop_finance.interest_type'  => 'nullable|in:FLAT,REDUCING',
            'shop_finance.total_payable'  => 'nullable|numeric|min:0',
            'shop_finance.tenure_months'  => 'nullable|integer|min:1|max:360',
            'shop_finance.emi_start_date' => 'nullable|date',
        ]);

        if ($priceError = $this->validateItemPriceBounds($data['items'], $user)) {
            return $priceError;
        }

        if ($imeiError = $this->validateNewMobileImeiRequired($data['items'], $user)) {
            return $imeiError;
        }

        // A finance plan that already has payments recorded against it can't be
        // silently re-terraformed (different principal/tenure would desync the
        // existing payment history) — reject before touching anything else.
        if (!empty($data['shop_finance']['type']) && !empty($data['shop_finance']['principal'])) {
            $existingPlan = \App\Models\SaleFinancePlan::where('sale_invoice_id', $saleInvoice->id)->first();
            if ($existingPlan && (float) $existingPlan->total_paid > 0) {
                return response()->json([
                    'message' => 'This sale already has a finance plan with payments recorded against it. Edit the plan directly from Finance > Finance Plans instead of changing it here.',
                ], 422);
            }
        }

        DB::beginTransaction();
        try {
            // Restore inventory for old items
            foreach ($saleInvoice->items as $item) {
                Inventory::addStock($saleInvoice->shop_id, $item->product_id, $item->quantity);
            }
            $saleInvoice->items()->delete();
            $saleInvoice->giftItems()->delete(); 

            // Recalculate invoice totals via shared InvoiceService (inclusive-pricing model)
            $gst = $this->invoiceService->calculateInclusiveTotals($data, $data['items']);
            extract($gst);

            $roundingMode = $data['rounding_mode'] ?? 'auto';
            $roundOff     = (float) ($data['round_off'] ?? 0);

            if ($request->has('round_off')) {
                $grandTotal = $rawGrandTotal + $roundOff;
            } else {
                if ($roundingMode === 'up') $grandTotal = ceil($rawGrandTotal);
                else if ($roundingMode === 'down') $grandTotal = floor($rawGrandTotal);
                else $grandTotal = round($rawGrandTotal);
                $roundOff = $grandTotal - $rawGrandTotal;
            }

            $oldFinancerId = $saleInvoice->financer_id;

            $saleInvoice->update([
                'customer_id'    => $data['customer_id'],
                'sold_by_id'     => $data['sold_by_id'] ?? $saleInvoice->sold_by_id,
                'sale_date'      => $data['sale_date'],
                'total_amount'   => $totalAmount,
                'cgst_rate'      => $cgstRate,
                'sgst_rate'      => $sgstRate,
                'cgst_amount'    => $cgstAmount,
                'sgst_amount'    => $sgstAmount,
                'calculate_gst'  => $calculateGst,
                'discount'       => $discount,
                'cash_discount'  => $cashDiscount,
                'is_cash_discount_on_bill' => $isCashDiscOnBill,
                'grand_total'    => $grandTotal,
                'rounding_mode'  => $roundingMode,
                'round_off'      => $roundOff,
                'total_paid'     => $data['total_paid'] ?? 0,
                'exchange_paid'  => $data['exchange_paid'] ?? 0,
                'payment_method' => $data['payment_method'] ?? $saleInvoice->payment_method,
                'notes'          => $data['notes'] ?? $saleInvoice->notes,
                // Save finance/EMI fields
                'financer_id'            => $data['financer_id'] ?? null,
                'down_payment'           => $data['down_payment'] ?? 0,
                'finance_amount'         => $data['finance_amount'] ?? 0,
                'finance_payment_status' => $data['finance_payment_status'] ?? 'RECEIVED',
            ]);

            foreach ($data['items'] as $item) {
                SaleItem::create([
                    'sale_invoice_id' => $saleInvoice->id,
                    'product_id'      => $item['product_id'],
                    'imei'            => $item['imei'] ?? null,
                    'ram'             => $item['ram'] ?? null,
                    'storage'         => $item['storage'] ?? null,
                    'color'           => $item['color'] ?? null,
                    'description'     => $item['description'] ?? null,
                    'quantity'        => $item['quantity'],
                    'unit_price'      => $item['unit_price'],
                    'total'           => $item['quantity'] * $item['unit_price'],
                    'apply_gst'       => !isset($item['apply_gst']) || filter_var($item['apply_gst'], FILTER_VALIDATE_BOOLEAN),
                ]);

                Inventory::removeStock($saleInvoice->shop_id, $item['product_id'], $item['quantity']);
            }

            // Delete old finance company transactions individually so Eloquent delete events fire
            $oldFinanceTransactions = \App\Models\Transaction::where('entity_type', get_class($saleInvoice))
                ->where('entity_id', $saleInvoice->id)
                ->where('category', 'FINANCE_INCOME')
                ->get();
            foreach ($oldFinanceTransactions as $tx) {
                $tx->delete();
            }

            // Delete old shop-finance down-payment transactions individually so
            // Eloquent delete events fire — re-posted below with current data.
            $oldDownPaymentTransactions = \App\Models\Transaction::where('entity_type', get_class($saleInvoice))
                ->where('entity_id', $saleInvoice->id)
                ->where('category', 'SHOP_FINANCE_DOWN_PAYMENT')
                ->get();
            foreach ($oldDownPaymentTransactions as $tx) {
                $tx->delete();
            }

            // Delete old cash income transactions individually so events fire
            $oldCashTransactions = \App\Models\Transaction::where('entity_type', get_class($saleInvoice))
                ->where('entity_id', $saleInvoice->id)
                ->where('category', 'SALE_INCOME')
                ->get();
            foreach ($oldCashTransactions as $tx) {
                $tx->delete();
            }

            // Record updated cash income transaction if total_paid > 0
            $cashPaid = (float) ($saleInvoice->total_paid);
            if ($cashPaid > 0) {
                $itemNames = $this->itemNamesSummary($data['items']);
                $this->transactionService->recordForModel($saleInvoice, [
                    'type'        => 'IN',
                    'category'    => 'SALE_INCOME',
                    'amount'      => $cashPaid,
                    'description' => "Sale income recorded for Invoice #{$saleInvoice->invoice_no} ({$saleInvoice->customer_name})" . ($itemNames ? " [{$itemNames}]" : ''),
                ]);
            }

            $financeAmt = (float) ($data['finance_amount'] ?? 0);
            $financerId = $data['financer_id'] ?? null;
            if ($financeAmt > 0 && $financerId) {
                $financer = \App\Models\Entity::find($financerId);
                $financePayStatus = $data['finance_payment_status'] ?? 'RECEIVED';
                if ($financer) {
                    if ($financePayStatus === 'RECEIVED') {
                        $this->transactionService->recordForModel($saleInvoice, [
                            'type'                 => 'IN',
                            'category'             => 'FINANCE_INCOME',
                            'amount'               => $financeAmt,
                            'payment_mode'         => 'FINANCE',
                            'accounting_entity_id' => $financer->id,
                            'entity_name'          => $financer->name,
                            'description'          => "Finance payment received from {$financer->name} for Invoice #{$saleInvoice->invoice_no}",
                        ]);
                    }
                    // For PENDING: the SaleInvoice model's getLedgerData() automatically posts
                    // the FINANCE_PENDING Debit (Dr) to the financer's ledger. No manual code needed!
                }
            }

            // Create or update the Shop Finance Plan (Personal EMI / Favor).
            // A plan with payments already recorded was already rejected above,
            // before any of this transaction's writes happened.
            if (!empty($data['shop_finance']['type']) && !empty($data['shop_finance']['principal'])) {
                $sf           = $data['shop_finance'];
                $interestType = $sf['interest_type'] ?? 'REDUCING';
                $months       = (int) ($sf['tenure_months'] ?? 0);
                $principal    = (float) $sf['principal'];

                if (empty($sf['interest_rate']) && !empty($sf['total_payable'])) {
                    [$monthlyEmi, $totalPayable, $impliedRate] = \App\Http\Controllers\Api\FinancePlanController::calcEmiFromTotalPayable(
                        $principal,
                        (float) $sf['total_payable'],
                        $months,
                        $interestType
                    );
                    $interestRate = $impliedRate;
                } else {
                    $interestRate = (float) ($sf['interest_rate'] ?? 0);
                    [$monthlyEmi, $totalPayable] = \App\Http\Controllers\Api\FinancePlanController::calcEmi(
                        $principal,
                        $interestRate,
                        $months,
                        $interestType
                    );
                }

                $planData = [
                    'customer_id'     => $saleInvoice->customer_id,
                    'type'            => $sf['type'],
                    'down_payment'    => $sf['down_payment'] ?? 0,
                    'principal'       => $principal,
                    'interest_rate'   => $interestRate ?: null,
                    'interest_type'   => $sf['type'] === 'PERSONAL' ? $interestType : 'REDUCING',
                    'tenure_months'   => $sf['tenure_months'] ?? null,
                    'monthly_emi'     => $sf['type'] === 'PERSONAL' ? $monthlyEmi : null,
                    'emi_start_date'  => $sf['type'] === 'PERSONAL'
                                            ? ($sf['emi_start_date'] ?? now()->addMonth()->startOfMonth()->toDateString())
                                            : null,
                    'total_payable'   => $sf['type'] === 'PERSONAL' ? $totalPayable : $principal,
                ];

                $existingPlan = \App\Models\SaleFinancePlan::where('sale_invoice_id', $saleInvoice->id)->first();
                if ($existingPlan) {
                    $existingPlan->update($planData);
                } else {
                    \App\Models\SaleFinancePlan::create(array_merge($planData, [
                        'sale_invoice_id' => $saleInvoice->id,
                        'total_paid'      => 0,
                        'status'          => 'ACTIVE',
                        'created_by'      => $user->id,
                    ]));
                }

                // Re-post the down payment with current data (old one was deleted above).
                $downPayment = (float) ($sf['down_payment'] ?? 0);
                if ($downPayment > 0) {
                    $this->transactionService->recordForModel($saleInvoice, [
                        'type'        => 'IN',
                        'category'    => 'SHOP_FINANCE_DOWN_PAYMENT',
                        'amount'      => $downPayment,
                        'description' => "Shop Finance down payment for Invoice #{$saleInvoice->invoice_no}",
                    ]);
                }

                // Re-post the interest portion too (AccountingService::post() updates
                // the existing SHOP_FINANCE_INTEREST row in place by voucher key, or
                // clears it out to 0/0 — which post() treats as "nothing to post" —
                // if this edit changed the plan to Favor/no-interest).
                if ($sf['type'] === 'PERSONAL') {
                    $interestPortion = max(0, $totalPayable - $principal);
                    $entity = $this->resolveCustomerEntity($saleInvoice);
                    if ($entity && $interestPortion > 0) {
                        app(\App\Services\AccountingService::class)->post(
                            $entity->id,
                            $saleInvoice->sale_date,
                            'SHOP_FINANCE_INTEREST',
                            $saleInvoice->id,
                            "Shop Finance interest for Invoice #{$saleInvoice->invoice_no}",
                            $interestPortion,
                            0,
                            $saleInvoice->shop_id,
                            $user->id
                        );
                    }
                }
            }

            $saleInvoice->updatePaymentStatus();
            DB::commit();

            // Audit log
            ActivityLog::log('SALE_UPDATED', $user, "Sale #{$saleInvoice->invoice_no} updated");

            // Sync financer balances
            if ($financerId) {
                $f = \App\Models\Entity::find($financerId);
                if ($f) app(\App\Services\EntityService::class)->syncBalance($f);
            }
            if ($oldFinancerId && $oldFinancerId != $financerId) {
                $oldF = \App\Models\Entity::find($oldFinancerId);
                if ($oldF) app(\App\Services\EntityService::class)->syncBalance($oldF);
            }

            return response()->json($saleInvoice->load('items.product.brand', 'customer'));
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->errorResponse($e, 'Failed to update sale');
        }
    }

    public function convertToPakka(Request $request, SaleInvoice $saleInvoice)
    {
        $user = $request->user();
        if (! $user->hasFullAccess() && $saleInvoice->shop_id !== $user->shop_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if ($saleInvoice->bill_type !== 'kaccha') {
            return response()->json(['message' => 'Only kaccha bills can be converted'], 422);
        }

        DB::beginTransaction();
        try {
            $newInvoiceNo = 'SAL-PKK-' . date('Ymd') . '-' . strtoupper(substr(uniqid(), -4));

            $pakka = $saleInvoice->replicate();
            $pakka->invoice_no    = $newInvoiceNo;
            $pakka->bill_type     = 'pakka';
            $pakka->parent_bill_id = $saleInvoice->id;
            $pakka->save();

            foreach ($saleInvoice->items as $item) {
                SaleItem::create([
                    'sale_invoice_id' => $pakka->id,
                    'product_id'      => $item->product_id,
                    'imei'            => $item->imei,
                    'ram'             => $item->ram,
                    'storage'         => $item->storage,
                    'color'           => $item->color,
                    'description'     => $item->description,
                    'quantity'        => $item->quantity,
                    'unit_price'      => $item->unit_price,
                    'total'           => $item->total,
                    'apply_gst'       => (bool)$item->apply_gst,
                ]);
            }

            DB::commit();

            // Audit log
            ActivityLog::log('SALE_CONVERTED_PAKKA', $user, "Kaccha bill #{$saleInvoice->invoice_no} converted to pakka #{$pakka->invoice_no}");

            return response()->json($pakka->load('items.product.brand'), 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->errorResponse($e, 'Failed to convert to pakka bill');
        }
    }

    public function cancel(Request $request, SaleInvoice $saleInvoice)
    {
        $user = $request->user();
        if (! $user->hasFullAccess() && $saleInvoice->shop_id !== $user->shop_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        DB::beginTransaction();
        try {
            if (!$saleInvoice->is_cancelled) {
                foreach ($saleInvoice->items as $item) {
                    Inventory::addStock($saleInvoice->shop_id, $item->product_id, $item->quantity);
                }
                $saleInvoice->update(['is_cancelled' => true]);

                // Delete associated transactions in a loop so Eloquent events fire
                $transactions = \App\Models\Transaction::where('entity_type', get_class($saleInvoice))
                    ->where('entity_id', $saleInvoice->id)
                    ->get();
                foreach ($transactions as $tx) {
                    $tx->delete();
                }
            }
            DB::commit();

            // Audit log
            ActivityLog::log('SALE_CANCELLED', $user, "Sale #{$saleInvoice->invoice_no} cancelled");

            return response()->json(['message' => 'Sale cancelled and stock restored']);
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->errorResponse($e, 'Failed to cancel sale');
        }
    }

    public function destroy(Request $request, SaleInvoice $saleInvoice)
    {
        $user = $request->user();
        if (!$user->hasFullAccess() && $saleInvoice->shop_id !== $user->shop_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // A Shop Finance (Personal EMI / Favor) plan with real payments already recorded
        // shouldn't just vanish along with the sale — that would silently destroy a paper
        // trail of money actually collected. Block the delete and point at Finance Plans
        // instead, same as the existing edit-time guard.
        $financePlan = $saleInvoice->financePlan;
        if ($financePlan && ((float) $financePlan->total_paid > 0 || $financePlan->payments()->exists())) {
            return response()->json([
                'message' => 'This sale has a Shop Finance plan with payments already recorded against it. Settle or remove the finance plan first from Finance > Finance Plans before deleting this sale.',
            ], 422);
        }

        DB::beginTransaction();
        try {
            if (!$saleInvoice->is_cancelled) {
                foreach ($saleInvoice->items as $item) {
                    Inventory::addStock($saleInvoice->shop_id, $item->product_id, $item->quantity);
                }
            }
            // Deleting the invoice is a real SQL DELETE for financePlan's sake, but
            // SaleInvoice itself uses SoftDeletes — a soft delete never fires the DB's
            // ON DELETE CASCADE, so an orphaned finance plan (and sale_items/gift_items,
            // which have no soft-delete of their own) would otherwise be left behind
            // forever — still referencing their product via a real foreign key, which
            // can later block that product from being deleted elsewhere (e.g. an old
            // mobile's auto-created product can never be hard-deleted while a stale
            // sale_item row still points at it).
            if ($financePlan) {
                $financePlan->payments()->delete();
                $financePlan->delete();
            }
            $saleInvoice->giftItems()->delete();
            $saleInvoice->items()->delete();
            $saleInvoice->delete();

            // Delete associated transactions in a loop so Eloquent events fire
            $transactions = \App\Models\Transaction::where('entity_type', get_class($saleInvoice))
                ->where('entity_id', $saleInvoice->id)
                ->get();
            foreach ($transactions as $tx) {
                $tx->delete();
            }

            DB::commit();
            // Audit log
            ActivityLog::log('SALE_DELETED', $user, "Sale #{$saleInvoice->invoice_no} deleted");

            $this->notifyOwner(
                "🗑️ *Sale Deleted*\nInvoice: #{$saleInvoice->invoice_no}\nCustomer: " . ($saleInvoice->customer_name ?? 'Walk-in') .
                "\nAmount: ₹" . number_format($saleInvoice->grand_total, 2) . "\nBy: {$user->name}"
            );

            return response()->json(['message' => 'Sale deleted and stock restored']);
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->errorResponse($e, 'Failed to delete sale');
        }
    }

    public function backup(Request $request)
    {
        $query = SaleInvoice::with('items', 'giftItems');
        
        if ($request->start_date) $query->where('sale_date', '>=', $request->start_date);
        if ($request->end_date)   $query->where('sale_date', '<=', $request->end_date);
        
        $invoices = $query->get();
        $data = [
            'type' => 'SALE_BACKUP',
            'timestamp' => now()->toDateTimeString(),
            'sale_invoices' => $invoices
        ];

        $filename = "sale_backup_" . ($request->start_date ? "{$request->start_date}_to_{$request->end_date}" : "full") . "_" . date('Ymd_His') . ".json";
        
        return response()->json($data)
            ->header('Content-Disposition', "attachment; filename=\"$filename\"");
    }

    public function restoreBackup(Request $request)
    {
        if (!$request->user()->hasFullAccess()) return response()->json(['message' => 'Unauthorized'], 403);
        
        $request->validate(['backup_file' => 'required|file|mimetypes:application/json,text/plain']);
        $data = json_decode(file_get_contents($request->file('backup_file')->getRealPath()), true);
        
        if (!isset($data['sale_invoices'])) return response()->json(['message' => 'Invalid backup format'], 422);

        DB::beginTransaction();
        try {
            foreach ($data['sale_invoices'] as $invData) {
                $items = $invData['items'] ?? [];
                $gifts = $invData['gift_items'] ?? [];
                unset($invData['items'], $invData['gift_items'], $invData['customer'], $invData['user'], $invData['shop']);
                
                $invoice = SaleInvoice::updateOrCreate(['id' => $invData['id']], $invData);
                
                foreach ($items as $itemData) {
                    unset($itemData['product']);
                    SaleItem::updateOrCreate(['id' => $itemData['id']], $itemData);
                }

                foreach ($gifts as $giftData) {
                    unset($giftData['gift_product']);
                    SaleGiftItem::updateOrCreate(['id' => $giftData['id']], $giftData);
                }
            }
            DB::commit();
            return response()->json(['message' => 'Sale backup restored successfully']);
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->errorResponse($e, 'Restore failed');
        }
    }

    public function receiveFinancePayment(Request $request, SaleInvoice $saleInvoice)
    {
        $user = $request->user();
        if (! $user->hasFullAccess() && $saleInvoice->shop_id !== $user->shop_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if ($saleInvoice->finance_payment_status === 'RECEIVED') {
            return response()->json(['message' => 'Finance payment already marked as received.'], 422);
        }

        DB::beginTransaction();
        try {
            $saleInvoice->finance_payment_status = 'RECEIVED';
            $saleInvoice->save(); // Save model so model events trigger posts to ledger

            // Record transaction for receipt from finance company linked to their entity
            // so it creates a Credit (Cr) entry in their ledger.
            if ($saleInvoice->finance_amount > 0 && $saleInvoice->financer_id) {
                $financer = \App\Models\Entity::find($saleInvoice->financer_id);
                if ($financer) {
                    $this->transactionService->recordForModel($saleInvoice, [
                        'type'                 => 'IN',
                        'category'             => 'FINANCE_INCOME',
                        'amount'               => $saleInvoice->finance_amount,
                        'payment_mode'         => 'FINANCE',
                        'accounting_entity_id' => $financer->id,
                        'entity_name'          => $financer->name,
                        'description'          => "Finance payment received from {$financer->name} for Invoice #{$saleInvoice->invoice_no}",
                    ]);
                }
            }

            $saleInvoice->updatePaymentStatus();
            DB::commit();

            // Sync financer balance
            if ($saleInvoice->financer_id) {
                $f = \App\Models\Entity::find($saleInvoice->financer_id);
                if ($f) app(\App\Services\EntityService::class)->syncBalance($f);
            }

            return response()->json([
                'message' => 'Finance payment marked as RECEIVED successfully.',
                'invoice' => new SaleInvoiceResource($saleInvoice->load('customer', 'user', 'soldBy', 'items.product.brand', 'shop'))
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->errorResponse($e, 'Failed to update finance payment status');
        }
    }

    public function convertToNewSale(Request $request, SaleInvoice $saleInvoice)
    {
        $user = $request->user();
        if (! $user->hasFullAccess() && $saleInvoice->shop_id !== $user->shop_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if ($saleInvoice->is_cancelled) {
            return response()->json(['message' => 'Cannot convert cancelled sale'], 422);
        }

        $oldMobileCatId = Category::mobileOldId();
        $newMobileCatId = Category::mobileNewId();

        if (!$newMobileCatId) {
            return response()->json(['message' => 'New mobile category not found'], 422);
        }

        DB::beginTransaction();
        try {
            $convertedCount = 0;
            foreach ($saleInvoice->items as $item) {
                $product = $item->product;
                if ($product && $oldMobileCatId && $product->category_id == $oldMobileCatId) {
                    // 1. Update product category to MOBILE-NEW and condition to new
                    $product->update([
                        'category_id' => $newMobileCatId,
                        'condition' => 'new'
                    ]);

                    // 1b. This unit's original purchase lives in OldMobilePurchase, not
                    // PurchaseItem — the table the New Mobile stock reports (Model Wise
                    // Stock, Daily Ledger) actually read. Without this, the Daily Ledger
                    // (which now counts this sale as a New Mobile sale, since it filters
                    // by the product's CURRENT category) has no matching New Mobile
                    // purchase to offset it, and shows impossible negative stock.
                    \App\Models\StockAdjustment::create([
                        'shop_id'         => $saleInvoice->shop_id,
                        'product_id'      => $product->id,
                        'user_id'         => $user->id,
                        'type'            => 'add',
                        'quantity'        => $item->quantity,
                        'reason'          => 'converted_from_old_mobile',
                        'adjustment_date' => $saleInvoice->sale_date,
                        // Traceable back to this exact sale item so convertToOldSale()
                        // (the reverse action) can find and remove precisely this
                        // adjustment, not just any adjustment that happens to match
                        // on product/date/quantity.
                        'notes'           => "sale_item:{$item->id}",
                    ]);

                    // 2. Check and record Employee Incentive
                    $hasIncentive = EmployeeIncentive::where('sale_item_id', $item->id)->exists();
                    if (!$hasIncentive) {
                        $incentiveAmount = $item->unit_price * 0.01;
                        EmployeeIncentive::create([
                            'user_id'          => $saleInvoice->sold_by_id ?? $saleInvoice->user_id,
                            'sale_item_id'     => $item->id,
                            'product_id'       => $item->product_id,
                            'incentive_amount' => $incentiveAmount,
                        ]);
                    }

                    $convertedCount++;
                }
            }

            DB::commit();

            return response()->json([
                'message' => "Successfully converted {$convertedCount} devices in the invoice to new mobile sales.",
                'invoice' => new SaleInvoiceResource($saleInvoice->load('customer', 'user', 'soldBy', 'items.product.category', 'items.product.brand', 'shop'))
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->errorResponse($e, 'Conversion failed');
        }
    }

    /**
     * Reverse of convertToNewSale() — lets staff undo an accidental (or simply
     * wrong) conversion back to a 2nd Hand sale. Mirrors it exactly: flips the
     * product category back, removes the incentive granted for the conversion,
     * and removes the compensating stock adjustment so New Mobile stock math
     * goes back to exactly how it was before the conversion.
     */
    public function convertToOldSale(Request $request, SaleInvoice $saleInvoice)
    {
        $user = $request->user();
        if (! $user->hasFullAccess() && $saleInvoice->shop_id !== $user->shop_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if ($saleInvoice->is_cancelled) {
            return response()->json(['message' => 'Cannot convert cancelled sale'], 422);
        }

        $oldMobileCatId = Category::mobileOldId();
        $newMobileCatId = Category::mobileNewId();

        if (!$oldMobileCatId) {
            return response()->json(['message' => 'Old mobile category not found'], 422);
        }

        DB::beginTransaction();
        try {
            $convertedCount = 0;
            foreach ($saleInvoice->items as $item) {
                $product = $item->product;
                if ($product && $newMobileCatId && $product->category_id == $newMobileCatId) {
                    $product->update([
                        'category_id' => $oldMobileCatId,
                        'condition' => 'used',
                    ]);

                    EmployeeIncentive::where('sale_item_id', $item->id)->delete();

                    \App\Models\StockAdjustment::where('product_id', $product->id)
                        ->where('reason', 'converted_from_old_mobile')
                        ->where('notes', 'like', "sale_item:{$item->id}%")
                        ->delete();

                    $convertedCount++;
                }
            }

            DB::commit();

            return response()->json([
                'message' => "Successfully converted {$convertedCount} devices in the invoice back to 2nd hand sale.",
                'invoice' => new SaleInvoiceResource($saleInvoice->load('customer', 'user', 'soldBy', 'items.product.category', 'items.product.brand', 'shop'))
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->errorResponse($e, 'Conversion failed');
        }
    }

    // GST calculation moved to App\Services\InvoiceService::calculateInclusiveTotals()
    // — see the two call sites above. Kept as one shared implementation instead
    // of a second copy that could drift from App\Services\InvoiceService::calculateTotals()
    // (the purchase-side, exclusive-pricing equivalent).

    /**
     * "VIVO Y11 (x2), SAMSUNG A14" style summary of what's actually in the
     * sale, for use in ledger/transaction narrations — otherwise a customer's
     * Entity Ledger shows a payment with no indication of what it was for.
     * Takes the raw items array from the request (product_id/quantity) rather
     * than a loaded SaleItem relation, since store() records the transaction
     * before the SaleItem rows exist.
     */
    /**
     * Resolves the customer entity for a sale invoice the same way
     * SaleInvoice::getLedgerData() does — accounting_entity_id first,
     * falling back to a name lookup — so manual Ledger posts (e.g. the
     * Shop Finance interest debit) land on the exact same entity row.
     */
    private function resolveCustomerEntity(\App\Models\SaleInvoice $invoice): ?\App\Models\Entity
    {
        if ($invoice->accounting_entity_id) {
            $entity = \App\Models\Entity::find($invoice->accounting_entity_id);
            if ($entity) return $entity;
        }
        $customer = $invoice->customer;
        if (!$customer) return null;
        return \App\Models\Entity::where('name', $customer->name)->first();
    }

    private function itemNamesSummary(array $items): string
    {
        $productIds = collect($items)->pluck('product_id')->filter()->unique();
        if ($productIds->isEmpty()) return '';

        $names = \App\Models\Product::whereIn('id', $productIds)->pluck('name', 'id');

        return collect($items)->map(function ($item) use ($names) {
            $name = $names[$item['product_id']] ?? 'Unknown';
            $qty  = (int) ($item['quantity'] ?? 1);
            return $qty > 1 ? "{$name} (x{$qty})" : $name;
        })->implode(', ');
    }

    /**
     * Reject a sale if any item's unit_price falls outside that product's
     * configured min/max selling price — otherwise a manipulated request
     * (e.g. a modified client-side price before submit) is trusted blindly,
     * letting the invoice under/overstate revenue and GST liability.
     *
     * Full-access (owner) users can override, since they're the ones who set
     * those bounds and may have a legitimate reason to sell outside them
     * (clearance, negotiated deal, etc.) — this guards against an untrusted
     * client bypassing the bounds, not against owner discretion.
     *
     * A bound of 0 means "not configured" for that product (the common case
     * in this data set) and is not enforced.
     *
     * Returns a 422 JsonResponse to return immediately, or null if all items pass.
     */
    private function validateItemPriceBounds(array $items, $user): ?\Illuminate\Http\JsonResponse
    {
        if ($user->hasFullAccess()) return null;

        $productIds = collect($items)->pluck('product_id')->filter()->unique();
        if ($productIds->isEmpty()) return null;

        $products = \App\Models\Product::whereIn('id', $productIds)
            ->get(['id', 'name', 'min_selling_price', 'max_selling_price'])
            ->keyBy('id');

        foreach ($items as $item) {
            $product = $products[$item['product_id']] ?? null;
            if (!$product) continue;

            $unitPrice = (float) ($item['unit_price'] ?? 0);
            $min = (float) $product->min_selling_price;
            $max = (float) $product->max_selling_price;

            if ($max > 0 && $unitPrice > $max) {
                return response()->json([
                    'message' => "Price for {$product->name} (₹{$unitPrice}) exceeds the maximum allowed selling price of ₹{$max}.",
                ], 422);
            }
            if ($min > 0 && $unitPrice < $min) {
                return response()->json([
                    'message' => "Price for {$product->name} (₹{$unitPrice}) is below the minimum allowed selling price of ₹{$min}.",
                ], 422);
            }
        }

        return null;
    }

    private function validateNewMobileImeiRequired(array $items, $user): ?\Illuminate\Http\JsonResponse
    {
        if ($user->hasFullAccess()) return null;

        $productIds = collect($items)->pluck('product_id')->filter()->unique();
        if ($productIds->isEmpty()) return null;

        $newMobileCatId = Category::mobileNewId();
        if (!$newMobileCatId) return null;

        $products = \App\Models\Product::whereIn('id', $productIds)
            ->get(['id', 'name', 'category_id'])
            ->keyBy('id');

        foreach ($items as $item) {
            $product = $products[$item['product_id']] ?? null;
            if (!$product || (string) $product->category_id !== (string) $newMobileCatId) continue;

            if (trim((string) ($item['imei'] ?? '')) === '') {
                return response()->json([
                    'message' => "IMEI is required for {$product->name}. Please scan or enter the IMEI of the unit being sold.",
                ], 422);
            }
        }

        return null;
    }
}

