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
use App\Traits\RecordsTransactions;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SaleInvoiceController extends Controller
{
    use \App\Traits\RecordsTransactions, \App\Traits\SyncsWithCustomer;
    public function index(Request $request)
    {
        $user = $request->user();
        $query = SaleInvoice::with('customer', 'user', 'items.product');

        if (! $user->hasFullAccess()) {
            $query->where('shop_id', $user->shop_id);
        } elseif ($request->shop_id) {
            $query->where('shop_id', $request->shop_id);
        }

        if ($request->bill_type) $query->where('bill_type', $request->bill_type);
        if ($request->from) $query->where('sale_date', '>=', $request->from);
        if ($request->to) $query->where('sale_date', '<=', $request->to);

        if ($request->search) {
            $s = $request->search;
            $query->where(function($q) use ($s) {
                $q->where('invoice_no', 'like', "%$s%")
                  ->orWhereHas('customer', fn($cq) => $cq->where('name', 'like', "%$s%")->orWhere('phone', 'like', "%$s%"));
            });
        }

        return response()->json($query->latest()->get());
    }

    public function store(Request $request)
    {
        $user = $request->user();
        $shopId = $user->hasFullAccess() ? $request->shop_id : $user->shop_id;

        $data = $request->validate([
            'shop_id'          => $user->hasFullAccess() ? 'required|exists:shops,id' : 'nullable',
            'customer_id'      => 'nullable|exists:customers,id',
            'customer_name'    => 'nullable|string|max:150',
            'customer_phone'   => 'nullable|string|max:20',
            'customer_email'   => 'nullable|email|max:100',
            'customer_address' => 'nullable|string',
            'sale_date'        => 'required|date',
            'bill_type'        => 'in:kaccha,pakka',
            'payment_method'   => 'in:cash,card,mobile',
            'discount'         => 'nullable|numeric|min:0',
            'total_paid'       => 'nullable|numeric|min:0',
            'cgst_rate'        => 'nullable|numeric|min:0',
            'sgst_rate'        => 'nullable|numeric|min:0',
            'calculate_gst'    => 'nullable|boolean',
            'cash_discount'    => 'nullable|numeric|min:0',
            'is_cash_discount_on_bill' => 'nullable|boolean',
            'rounding_mode'    => 'nullable|in:auto,up,down,manual',
            'round_off'        => 'nullable|numeric',
            'notes'            => 'nullable|string',
            'items'            => 'required|array|min:1',
            'items.*.product_id'  => 'required|exists:products,id',
            'items.*.quantity'    => 'required|integer|min:1',
            'items.*.unit_price'  => 'required|numeric|min:0',
            'items.*.imei'        => 'nullable|string',
            'items.*.ram'         => 'nullable|string',
            'items.*.storage'     => 'nullable|string',
            'items.*.color'       => 'nullable|string',
            'gift_items'          => 'nullable|array',
            'gift_items.*.gift_product_id' => 'exists:gift_products,id',
            'gift_items.*.quantity'        => 'integer|min:1',
        ]);

        if (!$data['customer_id'] && !$data['customer_phone']) {
            return response()->json(['message' => 'Customer selection or phone number is required.'], 422);
        }

        $customerId = $data['customer_id'] ?? $this->syncCustomer($data, 'SALE');

        DB::beginTransaction();
        try {
            $totalAmount = collect($data['items'])->sum(fn($i) => $i['quantity'] * $i['unit_price']);
            $discount    = (float) ($data['discount'] ?? 0);
            $cashDiscount = (float) ($data['cash_discount'] ?? 0);
            $isCashDiscOnBill = (bool) ($data['is_cash_discount_on_bill'] ?? true);
            $calculateGst = (bool) ($data['calculate_gst'] ?? true);
            
            if ($calculateGst) {
                $cgstRate = (float) ($data['cgst_rate'] ?? 9);
                $sgstRate = (float) ($data['sgst_rate'] ?? 9);
                $cgstAmount = ($totalAmount * $cgstRate) / 100;
                $sgstAmount = ($totalAmount * $sgstRate) / 100;
            } else {
                $cgstRate = 0;
                $sgstRate = 0;
                $cgstAmount = 0;
                $sgstAmount = 0;
            }

            $rawGrandTotal = $totalAmount + $cgstAmount + $sgstAmount - $discount;
            if ($isCashDiscOnBill) {
                $rawGrandTotal -= $cashDiscount;
            }
            $roundingMode = $data['rounding_mode'] ?? 'auto';
            $roundOff     = (float) ($data['round_off'] ?? 0);

            if ($roundingMode === 'up') $grandTotal = ceil($rawGrandTotal);
            else if ($roundingMode === 'down') $grandTotal = floor($rawGrandTotal);
            else if ($roundingMode === 'auto') $grandTotal = round($rawGrandTotal);
            else $grandTotal = $rawGrandTotal + $roundOff; // Manual rounding if not auto/up/down (or just always add roundOff if provided)
            
            // Re-evaluating: If the user provides round_off manually, we should use that.
            if ($request->has('round_off')) {
                $grandTotal = $rawGrandTotal + $roundOff;
            }

            $invoiceNo   = ($data['bill_type'] === 'pakka' ? 'SAL-PKK-' : 'SAL-KCH-') . date('Ymd') . '-' . strtoupper(substr(uniqid(), -4));

            $invoice = SaleInvoice::create([
                'invoice_no'     => $invoiceNo,
                'shop_id'        => $shopId,
                'customer_id'    => $customerId,
                'user_id'        => $user->id,
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
                'payment_method' => $data['payment_method'] ?? 'cash',
                'bill_type'      => $data['bill_type'] ?? 'kaccha',
                'notes'          => $data['notes'] ?? null,
            ]);

            $invoice->updatePaymentStatus();

            // Record Income Transaction in Cashbook
            if ($invoice->total_paid > 0) {
                $invoice->recordTransaction([
                    'type'             => 'IN',
                    'category'         => 'SALE_INCOME',
                    'amount'           => $invoice->total_paid,
                    'payment_mode'     => strtoupper($invoice->payment_method),
                    'description'      => "Sale income recorded for Invoice #{$invoice->invoice_no} ({$invoice->customer_name})",
                    'entity_type'      => get_class($invoice),
                    'entity_id'        => $invoice->id,
                    'entity_name'      => $invoice->customer_name,
                    'shop_id'          => $invoice->shop_id,
                    'transaction_date' => $invoice->sale_date,
                ]);
            }

            $mobileCatId = Category::where('slug', 'mobile-new')->value('id');

            foreach ($data['items'] as $item) {
                $total = $item['quantity'] * $item['unit_price'];
                $saleItem = SaleItem::create([
                    'sale_invoice_id' => $invoice->id,
                    'product_id'      => $item['product_id'],
                    'imei'            => $item['imei'] ?? null,
                    'ram'             => $item['ram'] ?? null,
                    'storage'         => $item['storage'] ?? null,
                    'color'           => $item['color'] ?? null,
                    'quantity'        => $item['quantity'],
                    'unit_price'      => $item['unit_price'],
                    'total'           => $total,
                ]);

                Inventory::removeStock($shopId, $item['product_id'], $item['quantity']);

                if ($mobileCatId) {
                    $product = \App\Models\Product::find($item['product_id']);
                    if ($product && $product->category_id == $mobileCatId) {
                        $incentive = $item['unit_price'] * 0.01;
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

            DB::commit();
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
        return response()->json($saleInvoice->load('customer', 'user', 'items.product', 'giftItems.giftProduct', 'shop'));
    }

    public function addPayment(Request $request, SaleInvoice $saleInvoice)
    {
        $data = $request->validate([
            'amount' => 'required|numeric|min:0.01'
        ]);

        $saleInvoice->total_paid += $data['amount'];
        $saleInvoice->updatePaymentStatus();

        // Record Transaction
        $saleInvoice->recordTransaction([
            'type'             => 'IN',
            'category'         => 'SALE',
            'amount'           => $data['amount'],
            'payment_mode'     => 'CASH', // Default for addPayment for now
            'description'      => "Partial payment for Invoice #{$saleInvoice->invoice_no} ({$saleInvoice->customer_name})",
            'entity_type'      => get_class($saleInvoice),
            'entity_id'        => $saleInvoice->id,
            'entity_name'      => $saleInvoice->customer_name,
            'ref_id'           => $saleInvoice->id,
            'transaction_date' => now()->toDateString(),
        ]);

        return response()->json([
            'message' => 'Payment added successfully',
            'total_paid' => $saleInvoice->total_paid,
            'payment_status' => $saleInvoice->payment_status
        ]);
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
            'sale_date'      => 'required|date',
            'discount'       => 'nullable|numeric|min:0',
            'calculate_gst'  => 'nullable|boolean',
            'cash_discount'  => 'nullable|numeric|min:0',
            'is_cash_discount_on_bill' => 'nullable|boolean',
            'cgst_rate'      => 'nullable|numeric|min:0',
            'sgst_rate'      => 'nullable|numeric|min:0',
            'rounding_mode'  => 'nullable|in:auto,up,down,manual',
            'round_off'      => 'nullable|numeric',
            'payment_method' => 'in:cash,card,mobile',
            'notes'          => 'nullable|string',
            'items'          => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.quantity'   => 'required|integer|min:1',
            'items.*.unit_price' => 'required|numeric|min:0',
            'items.*.imei'        => 'nullable|string',
            'items.*.ram'         => 'nullable|string',
            'items.*.storage'     => 'nullable|string',
            'items.*.color'       => 'nullable|string',
        ]);

        DB::beginTransaction();
        try {
            // Restore inventory for old items
            foreach ($saleInvoice->items as $item) {
                Inventory::addStock($saleInvoice->shop_id, $item->product_id, $item->quantity);
            }
            $saleInvoice->items()->delete();
            $saleInvoice->giftItems()->delete(); 

            $totalAmount = collect($data['items'])->sum(fn($i) => $i['quantity'] * $i['unit_price']);
            $discount    = (float) ($data['discount'] ?? 0);
            $cashDiscount = (float) ($data['cash_discount'] ?? 0);
            $isCashDiscOnBill = (bool) ($data['is_cash_discount_on_bill'] ?? true);
            $calculateGst = (bool) ($data['calculate_gst'] ?? true);

            if ($calculateGst) {
                $cgstRate = (float) ($data['cgst_rate'] ?? 9);
                $sgstRate = (float) ($data['sgst_rate'] ?? 9);
                $cgstAmount = ($totalAmount * $cgstRate) / 100;
                $sgstAmount = ($totalAmount * $sgstRate) / 100;
            } else {
                $cgstRate = 0;
                $sgstRate = 0;
                $cgstAmount = 0;
                $sgstAmount = 0;
            }

            $rawGrandTotal = $totalAmount + $cgstAmount + $sgstAmount - $discount;
            if ($isCashDiscOnBill) {
                $rawGrandTotal -= $cashDiscount;
            }
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

            $saleInvoice->update([
                'customer_id'    => $data['customer_id'],
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
                'payment_method' => $data['payment_method'] ?? $saleInvoice->payment_method,
                'notes'          => $data['notes'] ?? $saleInvoice->notes,
            ]);

            foreach ($data['items'] as $item) {
                SaleItem::create([
                    'sale_invoice_id' => $saleInvoice->id,
                    'product_id'      => $item['product_id'],
                    'imei'            => $item['imei'] ?? null,
                    'ram'             => $item['ram'] ?? null,
                    'storage'         => $item['storage'] ?? null,
                    'color'           => $item['color'] ?? null,
                    'quantity'        => $item['quantity'],
                    'unit_price'      => $item['unit_price'],
                    'total'           => $item['quantity'] * $item['unit_price'],
                ]);
                Inventory::removeStock($saleInvoice->shop_id, $item['product_id'], $item['quantity']);
            }

            $saleInvoice->updatePaymentStatus();
            DB::commit();
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
                    'quantity'        => $item->quantity,
                    'unit_price'      => $item->unit_price,
                    'total'           => $item->total,
                ]);
            }

            DB::commit();
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
            }
            DB::commit();
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
            DB::commit();
            return response()->json(['message' => 'Sale deleted and stock restored']);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }
}
