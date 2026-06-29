<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PurchaseInvoice;
use App\Models\PurchaseItem;
use App\Models\Inventory;
use App\Models\Product;
use App\Models\ActivityLog;
use App\Traits\RecordsTransactions;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

use App\Http\Resources\PurchaseInvoiceResource;

class PurchaseInvoiceController extends Controller
{
    protected $transactionService;

    public function __construct(\App\Services\TransactionService $transactionService)
    {
        $this->transactionService = $transactionService;
    }

    public function index(Request $request)
    {
        $user  = $request->user();
        $query = PurchaseInvoice::with('supplier', 'user', 'items.product.brand');

        if (! $user->hasFullAccess()) {
            $query->where('shop_id', $user->shop_id);
        } elseif ($request->shop_id) {
            $query->where('shop_id', $request->shop_id);
        }

        if ($request->from)   $query->where('purchase_date', '>=', $request->from);
        if ($request->to)     $query->where('purchase_date', '<=', $request->to);
        if ($request->status) $query->where('status', $request->status);
        if ($request->supplier_id) $query->where('supplier_id', $request->supplier_id);

        if ($request->category_id) {
            $query->whereHas('items.product', fn($q) => $q->where('category_id', $request->category_id));
        }
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
        }

        // Attribute Filters
        if ($request->ram) {
            $query->whereHas('items', fn($q) => $q->where('ram', 'like', "%{$request->ram}%"));
        }
        if ($request->storage) {
            $query->whereHas('items', fn($q) => $q->where('storage', 'like', "%{$request->storage}%"));
        }
        if ($request->color) {
            $query->whereHas('items', fn($q) => $q->where('color', 'like', "%{$request->color}%"));
        }
        if ($request->model) {
            $query->whereHas('items', fn($q) => $q->whereHas('product', fn($pq) => $pq->where('name', 'like', "%{$request->model}%")));
        }
        if ($request->imei) {
            $query->whereHas('items', fn($q) => $q->where('imei', 'like', "%{$request->imei}%"));
        }

        if ($request->search) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('invoice_no', 'like', "%{$search}%")
                  ->orWhereHas('supplier', function($sq) use ($search) {
                      $sq->where('name', 'like', "%{$search}%");
                  });
            });
        }

        return PurchaseInvoiceResource::collection($query->latest()->paginate($request->per_page ?? 50));
    }

    public function store(Request $request)
    {
        $user   = $request->user();
        $shopId = $user->hasFullAccess() ? $request->shop_id : $user->shop_id;

        $this->resolveSupplierId($request);

        $data = $request->validate([
            'shop_id'            => $user->hasFullAccess() ? 'required|exists:shops,id' : 'nullable',
            'supplier_id'        => 'required|exists:suppliers,id',
            'purchase_date'      => 'required|date',
            'expected_delivery_date' => 'nullable|date',
            'received_at'        => 'nullable|date',
            'status'             => 'required|in:ordered,received',
            'bill_type'          => 'required|in:kaccha,pakka',
            'discount'           => 'nullable|numeric|min:0',
            'total_paid'         => 'nullable|numeric|min:0',
            'cgst_rate'          => 'nullable|numeric|min:0|max:100',
            'sgst_rate'          => 'nullable|numeric|min:0|max:100',
            'calculate_gst'      => 'nullable|boolean',
            'cash_discount'      => 'nullable|numeric|min:0',
            'is_cash_discount_on_bill' => 'nullable|boolean',
            'rounding_mode'      => 'nullable|in:auto,up,down,manual',
            'round_off'          => 'nullable|numeric',
            'cgst_amount'        => 'nullable|numeric',
            'sgst_amount'        => 'nullable|numeric',
            'is_gst_manual'      => 'nullable|boolean',
            'notes'              => 'nullable|string',
            'items'              => 'required|array|min:1',
            'items.*.product_id' => 'nullable|exists:products,id',
            'items.*.apply_gst'  => 'nullable|boolean',
            'items.*.new_product_name' => 'nullable|string|max:255',
            'items.*.category_id'      => 'nullable|exists:categories,id',
            'items.*.brand_id'         => 'nullable|exists:brands,id',
            'items.*.quantity'   => 'required|integer|min:1',
            'items.*.unit_price' => 'required|numeric|min:0',
            'items.*.selling_price' => 'nullable|numeric|min:0',
            'items.*.wholeseller_price' => 'nullable|numeric|min:0',
            'items.*.imei'       => 'nullable|string|max:255',
            'items.*.ram'        => 'nullable|string|max:50',
            'items.*.storage'    => 'nullable|string|max:50',
            'items.*.color'      => 'nullable|string|max:50',
            'items.*.min_selling_price' => 'nullable|numeric|min:0',
            'items.*.max_selling_price' => 'nullable|numeric|min:0',
            'items.*.incentive_amount' => 'nullable|numeric|min:0',
            'items.*.subcategory'      => 'nullable|string|max:255',
            'items.*.location'         => 'nullable|string|max:255',
            'items.*.gst_rate'         => 'nullable|string|max:50',
            'items.*.warranty'         => 'nullable|string|max:255',
            'items.*.description'      => 'nullable|string',
            'items.*.brand_name'       => 'nullable|string|max:255',
        ]);

        return DB::transaction(function () use ($data, $shopId, $user) {
            $calc = app(\App\Services\InvoiceService::class)->calculateTotals($data['items'], $data);
            $invoiceNo = 'PUR-' . date('Ymd') . '-' . strtoupper(substr(uniqid(), -4));

            $invoice = PurchaseInvoice::create(array_merge($calc, [
                'invoice_no'    => $invoiceNo,
                'supplier_id'   => $data['supplier_id'],
                'bill_type'     => $data['bill_type'] ?? 'kaccha',
                'shop_id'       => $shopId,
                'user_id'       => $user->id,
                'purchase_date' => $data['purchase_date'],
                'expected_delivery_date' => $data['expected_delivery_date'] ?? null,
                'status'        => $data['status'],
                'received_at'   => $data['status'] === 'received' ? ($data['received_at'] ?? now()) : null,
                'total_paid'    => $data['total_paid'] ?? 0,
                'notes'         => $data['notes'] ?? null,
            ]));

            $invoice->updatePaymentStatus();

            // Record Transaction using Service
            if ($invoice->total_paid > 0) {
                $this->transactionService->recordForModel($invoice, [
                    'type'             => 'OUT',
                    'category'         => 'PURCHASE',
                    'description'      => "Initial payment for Purchase Invoice #{$invoice->invoice_no}",
                    'entity_name'      => $invoice->supplier?->name,
                ]);
            }

            // Record separate Transaction for Cash Discount if not on bill
            if (isset($data['cash_discount']) && $data['cash_discount'] > 0 && !($data['is_cash_discount_on_bill'] ?? true)) {
                $this->transactionService->recordForModel($invoice, [
                    'type'             => 'IN', // Discount received is an incoming gain
                    'category'         => 'CASH_DISCOUNT',
                    'amount'           => $data['cash_discount'],
                    'description'      => "Cash discount (not on bill) for Purchase Invoice #{$invoice->invoice_no}",
                ]);
            }
            
            $createdProducts = []; // Track products created in this request
            foreach ($data['items'] as $item) {
                $productId = $item['product_id'];

                // ── Quick-Add Product Logic ──
                if (!$productId && !empty($item['new_product_name'])) {
                    // Check if we already created this product in this request
                    $existingInRequest = $createdProducts[$item['new_product_name']] ?? null;
                    
                    if ($existingInRequest) {
                        $productId = $existingInRequest;
                    } else {
                        $product = Product::create([
                            'name'           => $item['new_product_name'],
                            'category_id'    => $item['category_id'],
                            'brand_id'       => $item['brand_id'] ?? null,
                            'sku'            => 'AUTO-' . strtoupper(substr(uniqid(), -6)),
                            'purchase_price' => $item['unit_price'],
                            'selling_price'  => $item['selling_price'] ?? ($item['unit_price'] * 1.2),
                            'subcategory'    => $item['subcategory'] ?? null,
                            'location'       => $item['location'] ?? null,
                            'attributes'     => [
                                'ram'         => $item['ram'] ?? null,
                                'storage'     => $item['storage'] ?? null,
                                'color'       => $item['color'] ?? null,
                                'brand'       => $item['brand_name'] ?? null,
                                'gst_rate'    => $item['gst_rate'] ?? null,
                                'warranty'    => $item['warranty'] ?? null,
                                'description' => $item['description'] ?? null,
                            ],
                            'min_selling_price' => $item['min_selling_price'] ?? null,
                            'max_selling_price' => $item['max_selling_price'] ?? null,
                            'wholeseller_price' => $item['wholeseller_price'] ?? null,
                            'incentive_amount' => $item['incentive_amount'] ?? null,
                        ]);
                        $productId = $product->id;
                        $createdProducts[$item['new_product_name']] = $productId;
                    }
                } else if ($productId) {
                    // Update existing product prices
                    $p = Product::find($productId);
                    if ($p) {
                        $p->purchase_price = $item['unit_price'];
                        if (!empty($item['selling_price'])) {
                            $p->selling_price = $item['selling_price'];
                        }
                        if (isset($item['min_selling_price'])) $p->min_selling_price = $item['min_selling_price'];
                        if (isset($item['max_selling_price'])) $p->max_selling_price = $item['max_selling_price'];
                        if (isset($item['wholeseller_price'])) $p->wholeseller_price = $item['wholeseller_price'];
                        if (isset($item['incentive_amount']))  $p->incentive_amount  = $item['incentive_amount'];
                        if (isset($item['subcategory']))       $p->subcategory       = $item['subcategory'];
                        if (isset($item['location']))          $p->location          = $item['location'];
                        
                        $attrs = $p->attributes ?? [];
                        if (isset($item['ram']))         $attrs['ram']         = $item['ram'];
                        if (isset($item['storage']))     $attrs['storage']     = $item['storage'];
                        if (isset($item['color']))       $attrs['color']       = $item['color'];
                        if (isset($item['brand_name']))  $attrs['brand']       = $item['brand_name'];
                        if (isset($item['gst_rate']))    $attrs['gst_rate']    = $item['gst_rate'];
                        if (isset($item['warranty']))    $attrs['warranty']    = $item['warranty'];
                        if (isset($item['description'])) $attrs['description'] = $item['description'];
                        $p->attributes = $attrs;
                        
                        $p->save();
                    }
                }

                PurchaseItem::create([
                    'purchase_invoice_id' => $invoice->id,
                    'product_id'          => $productId,
                    'imei'                => $item['imei'] ?? null,
                    'ram'                 => $item['ram'] ?? null,
                    'storage'             => $item['storage'] ?? null,
                    'color'               => $item['color'] ?? null,
                    'quantity'            => $item['quantity'],
                    'received_quantity'   => $data['status'] === 'received' ? $item['quantity'] : 0,
                    'damaged_quantity'    => 0,
                    'unit_price'          => $item['unit_price'],
                    'selling_price'       => $item['selling_price'] ?? null,
                    'wholeseller_price'   => $item['wholeseller_price'] ?? null,
                    'min_selling_price'   => $item['min_selling_price'] ?? null,
                    'max_selling_price'   => $item['max_selling_price'] ?? null,
                    'incentive_amount'    => $item['incentive_amount'] ?? null,
                    'total'               => $item['quantity'] * $item['unit_price'],
                ]);

                // ── Update inventory ONLY if received ──
                if ($data['status'] === 'received') {
                    Inventory::addStock($shopId, $productId, $item['quantity']);
                }
            }
            // Send WhatsApp Notification
            try {
                $amount = number_format($invoice->grand_total, 2);
                $supplierName = $invoice->supplier->name ?? 'Unknown Supplier';
                $msg = "📦 *New Purchase*\nInvoice: #{$invoice->invoice_no}\nAmount: ₹{$amount}\nSupplier: {$supplierName}";
                app(\App\Services\WhatsAppService::class)->sendToOwner($msg);
            } catch (\Exception $waEx) {
                \Illuminate\Support\Facades\Log::error('WhatsApp Notification Failed for Purchase', ['error' => $waEx->getMessage()]);
            }

            // Audit log
            ActivityLog::log('PURCHASE_CREATED', $user, "Purchase #{$invoice->invoice_no} created");

            return response()->json($invoice->load('items.product', 'supplier'), 201);
        });
    }

    public function update(Request $request, PurchaseInvoice $purchaseInvoice)
    {
        $user   = $request->user();
        if (!$user->hasFullAccess() && $purchaseInvoice->shop_id !== $user->shop_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $this->resolveSupplierId($request);

        $data = $request->validate([
            'supplier_id'        => 'required|exists:suppliers,id',
            'purchase_date'      => 'required|date',
            'expected_delivery_date' => 'nullable|date',
            'received_at'        => 'nullable|date',
            'status'             => 'required|in:ordered,received',
            'bill_type'          => 'nullable|in:kaccha,pakka',
            'discount'           => 'nullable|numeric|min:0',
            'total_paid'         => 'nullable|numeric|min:0',
            'cgst_rate'          => 'nullable|numeric|min:0|max:100',
            'sgst_rate'          => 'nullable|numeric|min:0|max:100',
            'calculate_gst'      => 'nullable|boolean',
            'cash_discount'      => 'nullable|numeric|min:0',
            'is_cash_discount_on_bill' => 'nullable|boolean',
            'rounding_mode'      => 'nullable|in:auto,up,down,manual',
            'round_off'          => 'nullable|numeric',
            'cgst_amount'        => 'nullable|numeric',
            'sgst_amount'        => 'nullable|numeric',
            'is_gst_manual'      => 'nullable|boolean',
            'notes'              => 'nullable|string',
            'items'              => 'required|array|min:1',
            'items.*.product_id' => 'nullable|exists:products,id',
            'items.*.apply_gst'  => 'nullable|boolean',
            'items.*.new_product_name' => 'nullable|string|max:255',
            'items.*.category_id'      => 'nullable|exists:categories,id',
            'items.*.brand_id'         => 'nullable|exists:brands,id',
            'items.*.quantity'   => 'required|integer|min:1',
            'items.*.unit_price' => 'required|numeric|min:0',
            'items.*.selling_price' => 'nullable|numeric|min:0',
            'items.*.wholeseller_price' => 'nullable|numeric|min:0',
            'items.*.imei'       => 'nullable|string|max:255',
            'items.*.ram'        => 'nullable|string|max:50',
            'items.*.storage'    => 'nullable|string|max:50',
            'items.*.color'      => 'nullable|string|max:50',
            'items.*.min_selling_price' => 'nullable|numeric|min:0',
            'items.*.max_selling_price' => 'nullable|numeric|min:0',
            'items.*.incentive_amount' => 'nullable|numeric|min:0',
            'items.*.subcategory'      => 'nullable|string|max:255',
            'items.*.location'         => 'nullable|string|max:255',
            'items.*.gst_rate'         => 'nullable|string|max:50',
            'items.*.warranty'         => 'nullable|string|max:255',
            'items.*.description'      => 'nullable|string',
            'items.*.brand_name'       => 'nullable|string|max:255',
        ]);

        return DB::transaction(function () use ($data, $purchaseInvoice) {
            $shopId = $purchaseInvoice->shop_id;

            // 1. If old status was 'received', revert stock
            if ($purchaseInvoice->status === 'received') {
                foreach ($purchaseInvoice->items as $item) {
                    Inventory::removeStock($shopId, $item->product_id, $item->quantity);
                }
            }

            // 2. Clear old items
            $purchaseInvoice->items()->delete();

            $calc = app(\App\Services\InvoiceService::class)->calculateTotals($data['items'], $data);

            $purchaseInvoice->update(array_merge($calc, [
                'supplier_id'   => $data['supplier_id'],
                'bill_type'     => $data['bill_type'] ?? $purchaseInvoice->bill_type,
                'purchase_date' => $data['purchase_date'],
                'expected_delivery_date' => $data['expected_delivery_date'] ?? null,
                'status'        => $data['status'],
                'received_at'   => $data['status'] === 'received' ? ($data['received_at'] ?? $purchaseInvoice->received_at ?? now()) : null,
                'total_paid'    => $data['total_paid'] ?? $purchaseInvoice->total_paid,
                'notes'         => $data['notes'] ?? null,
            ]));
             $purchaseInvoice->updatePaymentStatus();

            // Delete old transactions individually so Eloquent delete events fire
            $oldTransactions = \App\Models\Transaction::where('entity_type', get_class($purchaseInvoice))
                ->where('entity_id', $purchaseInvoice->id)
                ->whereIn('category', ['PURCHASE', 'CASH_DISCOUNT'])
                ->get();
            foreach ($oldTransactions as $tx) {
                $tx->delete();
            }

            // Record updated Transaction using Service if total_paid > 0
            if ($purchaseInvoice->total_paid > 0) {
                $this->transactionService->recordForModel($purchaseInvoice, [
                    'type'             => 'OUT',
                    'category'         => 'PURCHASE',
                    'amount'           => $purchaseInvoice->total_paid,
                    'description'      => "Initial payment for Purchase Invoice #{$purchaseInvoice->invoice_no}",
                    'entity_name'      => $purchaseInvoice->supplier?->name,
                ]);
            }

            // Record separate Transaction for Cash Discount if not on bill
            if (isset($data['cash_discount']) && $data['cash_discount'] > 0 && !($data['is_cash_discount_on_bill'] ?? true)) {
                $this->transactionService->recordForModel($purchaseInvoice, [
                    'type'             => 'IN',
                    'category'         => 'CASH_DISCOUNT',
                    'amount'           => $data['cash_discount'],
                    'description'      => "Cash discount (not on bill) for Purchase Invoice #{$purchaseInvoice->invoice_no}",
                ]);
            }

            $createdProducts = []; 
            // 4. Create new items and apply stock if received
            foreach ($data['items'] as $item) {
                $productId = $item['product_id'];

                if (!$productId && !empty($item['new_product_name'])) {
                    $existingInRequest = $createdProducts[$item['new_product_name']] ?? null;

                    if ($existingInRequest) {
                        $productId = $existingInRequest;
                    } else {
                        $product = Product::create([
                            'name'           => $item['new_product_name'],
                            'category_id'    => $item['category_id'],
                            'brand_id'       => $item['brand_id'] ?? null,
                            'sku'            => 'AUTO-' . strtoupper(substr(uniqid(), -6)),
                            'purchase_price' => $item['unit_price'],
                            'selling_price'  => $item['selling_price'] ?? ($item['unit_price'] * 1.2),
                            'subcategory'    => $item['subcategory'] ?? null,
                            'location'       => $item['location'] ?? null,
                            'attributes'     => [
                                'ram'         => $item['ram'] ?? null,
                                'storage'     => $item['storage'] ?? null,
                                'color'       => $item['color'] ?? null,
                                'brand'       => $item['brand_name'] ?? null,
                                'gst_rate'    => $item['gst_rate'] ?? null,
                                'warranty'    => $item['warranty'] ?? null,
                                'description' => $item['description'] ?? null,
                            ],
                            'min_selling_price' => $item['min_selling_price'] ?? null,
                            'max_selling_price' => $item['max_selling_price'] ?? null,
                            'wholeseller_price' => $item['wholeseller_price'] ?? null,
                            'incentive_amount' => $item['incentive_amount'] ?? null,
                        ]);
                        $productId = $product->id;
                        $createdProducts[$item['new_product_name']] = $productId;
                    }
                } else if ($productId) {
                    $p = Product::find($productId);
                    if ($p) {
                        $p->purchase_price = $item['unit_price'];
                        if (!empty($item['selling_price'])) {
                            $p->selling_price = $item['selling_price'];
                        }
                        if (isset($item['min_selling_price'])) $p->min_selling_price = $item['min_selling_price'];
                        if (isset($item['max_selling_price'])) $p->max_selling_price = $item['max_selling_price'];
                        if (isset($item['wholeseller_price'])) $p->wholeseller_price = $item['wholeseller_price'];
                        if (isset($item['incentive_amount']))  $p->incentive_amount  = $item['incentive_amount'];
                        if (isset($item['subcategory']))       $p->subcategory       = $item['subcategory'];
                        if (isset($item['location']))          $p->location          = $item['location'];
                        
                        $attrs = $p->attributes ?? [];
                        if (isset($item['ram']))         $attrs['ram']         = $item['ram'];
                        if (isset($item['storage']))     $attrs['storage']     = $item['storage'];
                        if (isset($item['color']))       $attrs['color']       = $item['color'];
                        if (isset($item['brand_name']))  $attrs['brand']       = $item['brand_name'];
                        if (isset($item['gst_rate']))    $attrs['gst_rate']    = $item['gst_rate'];
                        if (isset($item['warranty']))    $attrs['warranty']    = $item['warranty'];
                        if (isset($item['description'])) $attrs['description'] = $item['description'];
                        $p->attributes = $attrs;
                        
                        $p->save();
                    }
                }

                PurchaseItem::create([
                    'purchase_invoice_id' => $purchaseInvoice->id,
                    'product_id'          => $productId,
                    'imei'                => $item['imei'] ?? null,
                    'ram'                 => $item['ram'] ?? null,
                    'storage'             => $item['storage'] ?? null,
                    'color'               => $item['color'] ?? null,
                    'quantity'            => $item['quantity'],
                    'received_quantity'   => $data['status'] === 'received' ? $item['quantity'] : 0,
                    'damaged_quantity'    => 0,
                    'unit_price'          => $item['unit_price'],
                    'selling_price'       => $item['selling_price'] ?? null,
                    'wholeseller_price'   => $item['wholeseller_price'] ?? null,
                    'min_selling_price'   => $item['min_selling_price'] ?? null,
                    'max_selling_price'   => $item['max_selling_price'] ?? null,
                    'incentive_amount'    => $item['incentive_amount'] ?? null,
                    'total'               => $item['quantity'] * $item['unit_price'],
                ]);

                if ($data['status'] === 'received') {
                    Inventory::addStock($shopId, $productId, $item['quantity']);
                }
            }

            return response()->json($purchaseInvoice->load('items.product'));
        });
    }

    /**
     * Mark a purchase order as Received → add items to inventory
     */
    public function markReceived(Request $request, PurchaseInvoice $purchaseInvoice)
    {
        $user = $request->user();
        if (! $user->hasFullAccess() && $purchaseInvoice->shop_id !== $user->shop_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        if ($purchaseInvoice->status === 'received') {
            return response()->json(['message' => 'Order is already marked as received.'], 422);
        }

        $data = $request->validate([
            'received_at' => 'nullable|date',
            'items' => 'required|array',
            'items.*.id' => 'required|exists:purchase_items,id',
            'items.*.received_quantity' => 'required|integer|min:0',
            'items.*.damaged_quantity' => 'required|integer|min:0',
        ]);

        return DB::transaction(function () use ($purchaseInvoice, $data) {
            $purchaseInvoice->update([
                'status'      => 'received', 
                'received_at' => $data['received_at'] ?? now()
            ]);

            foreach ($data['items'] as $itemData) {
                $item = PurchaseItem::find($itemData['id']);
                if ($item && $item->purchase_invoice_id === $purchaseInvoice->id) {
                    $item->update([
                        'received_quantity' => $itemData['received_quantity'],
                        'damaged_quantity'  => $itemData['damaged_quantity'],
                    ]);

                    $netQuantity = $itemData['received_quantity'] - $itemData['damaged_quantity'];
                    if ($netQuantity > 0) {
                        Inventory::addStock($purchaseInvoice->shop_id, $item->product_id, $netQuantity);
                    }
                }
            }

            return response()->json([
                'message' => 'Order marked as received. Stock has been added to inventory (excluding damaged items).',
                'invoice' => $purchaseInvoice->load('items.product'),
            ]);
        });
    }

    public function addPayment(Request $request, PurchaseInvoice $purchaseInvoice)
    {
        $data = $request->validate([
            'amount' => 'required|numeric|min:0.01',
            'notes'  => 'nullable|string'
        ]);

        $purchaseInvoice->total_paid += $data['amount'];
        $purchaseInvoice->updatePaymentStatus();

        // Record Transaction using Service
        $this->transactionService->recordForModel($purchaseInvoice, [
            'type'             => 'OUT',
            'category'         => 'PURCHASE',
            'amount'           => $data['amount'],
            'description'      => "Partial payment for Purchase Invoice #{$purchaseInvoice->invoice_no}",
            'entity_name'      => $purchaseInvoice->supplier?->name,
        ]);

        return response()->json([
            'message' => 'Payment recorded successfully',
            'invoice' => $purchaseInvoice->load('supplier', 'user', 'items.product')
        ]);
    }

    public function show(Request $request, PurchaseInvoice $purchaseInvoice)
    {
        $user = $request->user();
        if (! $user->hasFullAccess() && $purchaseInvoice->shop_id !== $user->shop_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        return new PurchaseInvoiceResource($purchaseInvoice->load('supplier', 'user', 'items.product'));
    }

    public function destroy(Request $request, PurchaseInvoice $purchaseInvoice)
    {
        $user = $request->user();
        if (! $user->hasFullAccess() && $purchaseInvoice->shop_id !== $user->shop_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        return DB::transaction(function () use ($purchaseInvoice, $user) {
            // Only reverse stock if it was already received
            if ($purchaseInvoice->status === 'received') {
                foreach ($purchaseInvoice->items as $item) {
                    Inventory::removeStock($purchaseInvoice->shop_id, $item->product_id, $item->quantity);
                }
            }
            // Delete associated transactions in a loop so Eloquent events fire
            $transactions = \App\Models\Transaction::where('entity_type', get_class($purchaseInvoice))
                ->where('entity_id', $purchaseInvoice->id)
                ->get();
            foreach ($transactions as $tx) {
                $tx->delete();
            }

            $purchaseInvoice->delete();
            // Audit log
            ActivityLog::log('PURCHASE_DELETED', $user, "Purchase #{$purchaseInvoice->invoice_no} deleted");
            return response()->json(['message' => 'Purchase order deleted.']);
        });
    }

    public function pendingStocks(Request $request)
    {
        $user = $request->user();
        $shopId = $user->hasFullAccess() ? $request->shop_id : $user->shop_id;
        if ($user->hasFullAccess() && !$shopId) $shopId = 1;

        $query = PurchaseItem::with(['product.category', 'product.brand', 'invoice.supplier'])
            ->whereHas('invoice', function ($q) use ($shopId, $request) {
                $q->where('status', 'ordered');
                if ($shopId) $q->where('shop_id', $shopId);
                
                // Add filters if present
                if ($request->search) {
                    $q->where('invoice_no', 'like', "%{$request->search}%");
                }
                if ($request->imei) {
                    $q->where('imei', 'like', "%{$request->imei}%");
                }
            })
            ->whereHas('product', function ($q) use ($request) {
                if ($request->category_id) {
                    $q->where('category_id', $request->category_id);
                } elseif ($request->category_group === 'other') {
                    $q->whereNotIn('category_id', [1, 2]);
                } elseif ($request->category_group === 'old_mobile') {
                    $q->where('category_id', 2);
                } else {
                    $q->where('category_id', 1);
                }
                if ($request->search) {
                    $q->where('name', 'like', "%{$request->search}%");
                }
                if ($request->model) $q->where('name', 'like', "%{$request->model}%");
            });

        // Add attribute filters
        if ($request->color) $query->where('color', 'like', "%{$request->color}%");
        if ($request->ram) $query->where('ram', 'like', "%{$request->ram}%");
        if ($request->storage) $query->where('storage', 'like', "%{$request->storage}%");

        $items = $query->get();

        // If grouping is requested (default should probably be true for consistency)
        if ($request->group_by_config !== 'false') {
            $items = $items->groupBy(function($item) {
                return $item->product_id . '-' . $item->ram . '-' . $item->storage . '-' . $item->color;
            })->map(function($group) {
                $first = $group->first();
                return [
                    'id' => 'group_' . $first->id,
                    'product_id' => $first->product_id,
                    'product' => $first->product,
                    'ram' => $first->ram,
                    'storage' => $first->storage,
                    'color' => $first->color,
                    'quantity' => $group->sum('quantity'),
                    'invoice' => $first->invoice,
                    'is_grouped' => true
                ];
            })->values();
        } else {
            // Expand individual items if they have multiple IMEIs
            $expanded = [];
            foreach ($items as $item) {
                $imeis = $item->imei ? array_map('trim', explode(',', $item->imei)) : [null];
                foreach ($imeis as $index => $imei) {
                    $expanded[] = [
                        'id' => 'pending_' . $item->id . '_' . $index,
                        'product_id' => $item->product_id,
                        'product' => $item->product,
                        'ram' => $item->ram,
                        'storage' => $item->storage,
                        'color' => $item->color,
                        'quantity' => 1,
                        'imei' => $imei,
                        'invoice' => $item->invoice,
                        'is_grouped' => false
                    ];
                }
            }
            $items = $expanded;
        }

        return response()->json($items);
    }

    public function getUniqueImeis(Request $request)
    {
        $user = $request->user();
        $shopId = $user->hasFullAccess() ? $request->shop_id : $user->shop_id;
        
        $query = PurchaseItem::whereNotNull('imei')->where('imei', '!=', '');
        
        if ($shopId) {
            $query->whereHas('invoice', fn($q) => $q->where('shop_id', $shopId));
        }

        $imeis = $query->pluck('imei')->flatMap(function($item) {
            return array_map('trim', explode(',', $item));
        })->unique()->sort()->values();

        return response()->json($imeis);
    }

    public function backup(Request $request)
    {
        $query = PurchaseInvoice::with('items');
        
        if ($request->start_date) $query->where('purchase_date', '>=', $request->start_date);
        if ($request->end_date)   $query->where('purchase_date', '<=', $request->end_date);
        
        $invoices = $query->get();
        $data = [
            'type' => 'PURCHASE_BACKUP',
            'timestamp' => now()->toDateTimeString(),
            'purchase_invoices' => $invoices
        ];

        $filename = "purchase_backup_" . ($request->start_date ? "{$request->start_date}_to_{$request->end_date}" : "full") . "_" . date('Ymd_His') . ".json";
        
        return response()->json($data)
            ->header('Content-Disposition', "attachment; filename=\"$filename\"");
    }

    public function restoreBackup(Request $request)
    {
        if (!$request->user()->hasFullAccess()) return response()->json(['message' => 'Unauthorized'], 403);
        
        $request->validate(['backup_file' => 'required|file|mimetypes:application/json,text/plain']);
        $data = json_decode(file_get_contents($request->file('backup_file')->getRealPath()), true);
        
        if (!isset($data['purchase_invoices'])) return response()->json(['message' => 'Invalid backup format'], 422);

        DB::beginTransaction();
        try {
            foreach ($data['purchase_invoices'] as $invData) {
                $items = $invData['items'] ?? [];
                unset($invData['items'], $invData['supplier'], $invData['user']);
                
                // Ensure ID preservation or mapping if needed
                // For simplicity, we'll use updateOrInsert by invoice_no or ID
                $invoice = PurchaseInvoice::updateOrCreate(['id' => $invData['id']], $invData);
                
                foreach ($items as $itemData) {
                    unset($itemData['product']);
                    PurchaseItem::updateOrCreate(['id' => $itemData['id']], $itemData);
                }
            }
            DB::commit();
            return response()->json(['message' => 'Purchase backup restored successfully']);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Restore failed: ' . $e->getMessage()], 500);
        }
    }

    protected function resolveSupplierId(Request $request)
    {
        $supplierId = $request->input('supplier_id');
        if (is_string($supplierId) && str_starts_with($supplierId, 'entity-')) {
            $entityId = (int) substr($supplierId, 7);
            $entity = \App\Models\Entity::find($entityId);
            if ($entity) {
                if ($entity->relation_type === \App\Models\Supplier::class && $entity->relation_id) {
                    $request->merge(['supplier_id' => $entity->relation_id]);
                } else {
                    // Check if a supplier with the same name already exists to prevent duplicates
                    $supplier = \App\Models\Supplier::where('name', $entity->name)->first();
                    if (!$supplier) {
                        $supplier = \App\Models\Supplier::create([
                            'name'    => $entity->name,
                            'phone'   => $entity->phone ?? '',
                            'address' => $entity->description ?? '',
                            'gst_no'  => $entity->gst_number,
                        ]);
                    }
                    $request->merge(['supplier_id' => $supplier->id]);
                }
            }
        }
    }
}
