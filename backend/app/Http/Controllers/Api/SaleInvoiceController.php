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

    public function __construct(\App\Services\TransactionService $transactionService)
    {
        $this->transactionService = $transactionService;
    }

    public function index(Request $request)
    {
        $user = $request->user();
        $query = SaleInvoice::with('customer', 'user', 'items.product', 'financer');

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

        if ($request->search) {
            $s = $request->search;
            $query->where(function($q) use ($s) {
                $q->where('invoice_no', 'like', "%$s%")
                  ->orWhereHas('customer', fn($cq) => $cq->where('name', 'like', "%$s%")->orWhere('phone', 'like', "%$s%"))
                  ->orWhereHas('items', fn($iq) => $iq->where('imei', 'like', "%$s%"));
            });
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
            'items.*.imei'        => 'nullable|string',
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
            'shop_finance.tenure_months'  => 'nullable|integer|min:1|max:360',
            'shop_finance.emi_start_date' => 'nullable|date',
        ]);

        if (!$data['customer_id'] && !$data['customer_phone']) {
            return response()->json(['message' => 'Customer selection or phone number is required.'], 422);
        }

        // Idempotency check — prevent duplicate submissions
        if (!empty($data['idempotency_key'])) {
            $existing = SaleInvoice::where('shop_id', $shopId)
                ->where('idempotency_key', $data['idempotency_key'])
                ->where('created_at', '>=', now()->subMinutes(5))
                ->first();
            if ($existing) {
                return response()->json($existing->load('items.product', 'giftItems.giftProduct', 'customer'), 200);
            }
        }

        $customerId = $data['customer_id'] ?? $this->syncCustomer($data, 'SALE');

        DB::beginTransaction();
        try {
            // GST calculation via shared method
            $gst = $this->calculateGst($data, $data['items']);
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
                $this->transactionService->recordForModel($invoice, [
                    'type'        => 'IN',
                    'category'    => 'SALE_INCOME',
                    'amount'      => $cashPaid,
                    'description' => "Sale income recorded for Invoice #{$invoice->invoice_no} ({$invoice->customer_name})",
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

            $mobileCatId = Cache::remember('category_mobile_new_id', 3600, function () {
                return Category::where('slug', 'mobile-new')->value('id');
            });

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
                $sf = $data['shop_finance'];
                [$monthlyEmi, $totalPayable] = \App\Http\Controllers\Api\FinancePlanController::calcEmi(
                    (float) $sf['principal'],
                    (float) ($sf['interest_rate'] ?? 0),
                    (int)   ($sf['tenure_months'] ?? 0)
                );
                \App\Models\SaleFinancePlan::create([
                    'sale_invoice_id' => $invoice->id,
                    'customer_id'     => $invoice->customer_id,
                    'type'            => $sf['type'],
                    'down_payment'    => $sf['down_payment'] ?? 0,
                    'principal'       => $sf['principal'],
                    'interest_rate'   => $sf['interest_rate'] ?? null,
                    'tenure_months'   => $sf['tenure_months'] ?? null,
                    'monthly_emi'     => $sf['type'] === 'PERSONAL' ? $monthlyEmi : null,
                    'emi_start_date'  => $sf['type'] === 'PERSONAL'
                                            ? ($sf['emi_start_date'] ?? now()->addMonth()->startOfMonth()->toDateString())
                                            : null,
                    'total_payable'   => $sf['type'] === 'PERSONAL' ? $totalPayable : (float) $sf['principal'],
                    'total_paid'      => 0,
                    'status'          => 'ACTIVE',
                    'created_by'      => $user->id,
                ]);
            }

            DB::commit();

            // Audit log
            ActivityLog::log('SALE_CREATED', $user, "Sale #{$invoice->invoice_no} created — Total: ₹{$grandTotal}");

            // Send WhatsApp Notification
            try {
                $customerName = $invoice->customer_name ?? 'Walk-in';
                $amount = number_format($grandTotal, 2);
                $msg = "🛍️ *New Sale!*\nInvoice: #{$invoiceNo}\nAmount: ₹{$amount}\nCustomer: {$customerName}";
                app(\App\Services\WhatsAppService::class)->sendToOwner($msg);
            } catch (\Exception $waEx) {
                \Illuminate\Support\Facades\Log::error('WhatsApp Notification Failed for Sale', ['error' => $waEx->getMessage()]);
            }

            return response()->json($invoice->load('items.product', 'giftItems.giftProduct', 'customer'), 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to create sale: ' . $e->getMessage()], 500);
        }
    }

    public function show(Request $request, SaleInvoice $saleInvoice)
    {
        $user = $request->user();
        if (! $user->hasFullAccess() && $saleInvoice->shop_id !== $user->shop_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        return new SaleInvoiceResource($saleInvoice->load('customer', 'user', 'soldBy', 'items.product.category', 'giftItems.giftProduct', 'shop', 'financer'));
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
            $this->transactionService->recordForModel($invoice, [
                'type'             => 'IN',
                'category'         => 'SALE',
                'amount'           => $data['amount'],
                'description'      => "Partial payment for Invoice #{$invoice->invoice_no} ({$invoice->customer_name})",
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
            'items.*.imei'        => 'nullable|string',
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
        ]);

        DB::beginTransaction();
        try {
            // Restore inventory for old items
            foreach ($saleInvoice->items as $item) {
                Inventory::addStock($saleInvoice->shop_id, $item->product_id, $item->quantity);
            }
            $saleInvoice->items()->delete();
            $saleInvoice->giftItems()->delete(); 

            // Recalculate invoice totals using helper
            $gst = $this->calculateGst($data, $data['items']);
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
                $this->transactionService->recordForModel($saleInvoice, [
                    'type'        => 'IN',
                    'category'    => 'SALE_INCOME',
                    'amount'      => $cashPaid,
                    'description' => "Sale income recorded for Invoice #{$saleInvoice->invoice_no} ({$saleInvoice->customer_name})",
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

            return response()->json($saleInvoice->load('items.product', 'customer'));
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => $e->getMessage()], 500);
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

            return response()->json($pakka->load('items.product'), 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => $e->getMessage()], 500);
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
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }

    public function destroy(Request $request, SaleInvoice $saleInvoice)
    {
        $user = $request->user();
        if (!$user->hasFullAccess() && $saleInvoice->shop_id !== $user->shop_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        DB::beginTransaction();
        try {
            if (!$saleInvoice->is_cancelled) {
                foreach ($saleInvoice->items as $item) {
                    Inventory::addStock($saleInvoice->shop_id, $item->product_id, $item->quantity);
                }
            }
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
            return response()->json(['message' => 'Sale deleted and stock restored']);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => $e->getMessage()], 500);
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
            return response()->json(['message' => 'Restore failed: ' . $e->getMessage()], 500);
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
                'invoice' => new SaleInvoiceResource($saleInvoice->load('customer', 'user', 'soldBy', 'items.product', 'shop'))
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to update: ' . $e->getMessage()], 500);
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

        $oldMobileCat = Category::whereIn('slug', ['MOBILE-OLD', 'mobile-old'])->first();
        $newMobileCat = Category::whereIn('slug', ['MOBILE-NEW', 'mobile-new'])->first();

        if (!$newMobileCat) {
            return response()->json(['message' => 'New mobile category not found'], 422);
        }

        DB::beginTransaction();
        try {
            $convertedCount = 0;
            foreach ($saleInvoice->items as $item) {
                $product = $item->product;
                if ($product && $oldMobileCat && $product->category_id == $oldMobileCat->id) {
                    // 1. Update product category to MOBILE-NEW and condition to new
                    $product->update([
                        'category_id' => $newMobileCat->id,
                        'condition' => 'new'
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
                'invoice' => new SaleInvoiceResource($saleInvoice->load('customer', 'user', 'soldBy', 'items.product.category', 'shop'))
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Conversion failed: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Shared GST calculation — used by both store() and update().
     */
    private function calculateGst(array $data, array $items): array
    {
        $discount         = (float) ($data['discount'] ?? 0);
        $cashDiscount     = (float) ($data['cash_discount'] ?? 0);
        $isCashDiscOnBill = (bool) ($data['is_cash_discount_on_bill'] ?? true);
        $calculateGst     = (bool) ($data['calculate_gst'] ?? true);
        $inclusiveTotal   = collect($items)->sum(fn($i) => ($i['quantity'] ?? 1) * ($i['unit_price'] ?? 0));

        if ($calculateGst) {
            $cgstRate = (float) ($data['cgst_rate'] ?? 9);
            $sgstRate = (float) ($data['sgst_rate'] ?? 9);

            if (isset($data['is_gst_manual']) && $data['is_gst_manual'] && isset($data['cgst_amount']) && isset($data['sgst_amount'])) {
                $cgstAmount  = (float) $data['cgst_amount'];
                $sgstAmount  = (float) $data['sgst_amount'];
                $totalAmount = $inclusiveTotal - $cgstAmount - $sgstAmount;
            } else {
                $taxableInclusiveTotal = collect($items)->sum(function($i) {
                    $applyGst = !isset($i['apply_gst']) || filter_var($i['apply_gst'], FILTER_VALIDATE_BOOLEAN);
                    return $applyGst ? (($i['quantity'] ?? 1) * ($i['unit_price'] ?? 0)) : 0;
                });

                $totalGstRate  = $cgstRate + $sgstRate;
                $exclusiveTaxableTotal = $taxableInclusiveTotal / (1 + ($totalGstRate / 100));
                $totalGstAmount = $taxableInclusiveTotal - $exclusiveTaxableTotal;

                $cgstAmount  = $totalGstRate > 0 ? round($totalGstAmount * ($cgstRate / $totalGstRate), 2) : 0;
                $sgstAmount  = $totalGstRate > 0 ? round($totalGstAmount * ($sgstRate / $totalGstRate), 2) : 0;
                $totalAmount = round($inclusiveTotal - $cgstAmount - $sgstAmount, 2);
            }
        } else {
            $cgstRate    = 0;
            $sgstRate    = 0;
            $cgstAmount  = 0;
            $sgstAmount  = 0;
            $totalAmount = $inclusiveTotal;
        }

        $rawGrandTotal = $totalAmount + $cgstAmount + $sgstAmount - $discount;
        if ($isCashDiscOnBill) {
            $rawGrandTotal -= $cashDiscount;
        }

        return [
            'cgst_rate'       => $cgstRate,
            'cgstRate'        => $cgstRate,
            'sgst_rate'       => $sgstRate,
            'sgstRate'        => $sgstRate,
            'cgst_amount'     => $cgstAmount,
            'cgstAmount'      => $cgstAmount,
            'sgst_amount'     => $sgstAmount,
            'sgstAmount'      => $sgstAmount,
            'total_amount'    => $totalAmount,
            'totalAmount'     => $totalAmount,
            'raw_grand_total' => $rawGrandTotal,
            'rawGrandTotal'   => $rawGrandTotal,
            'discount'        => $discount,
            'cash_discount'   => $cashDiscount,
            'cashDiscount'    => $cashDiscount,
            'is_cash_discount_on_bill' => $isCashDiscOnBill,
            'isCashDiscOnBill' => $isCashDiscOnBill,
            'calculate_gst'   => $calculateGst,
            'calculateGst'    => $calculateGst,
        ];
    }
}

