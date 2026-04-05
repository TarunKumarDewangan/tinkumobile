<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PurchaseInvoice;
use App\Models\PurchaseItem;
use App\Models\Inventory;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PurchaseInvoiceController extends Controller
{
    public function index(Request $request)
    {
        $user  = $request->user();
        $query = PurchaseInvoice::with('supplier', 'user', 'items.product');

        if (! $user->hasFullAccess()) {
            $query->where('shop_id', $user->shop_id);
        } elseif ($request->shop_id) {
            $query->where('shop_id', $request->shop_id);
        }

        if ($request->from)   $query->where('purchase_date', '>=', $request->from);
        if ($request->to)     $query->where('purchase_date', '<=', $request->to);
        if ($request->status) $query->where('status', $request->status);
        if ($request->supplier_id) $query->where('supplier_id', $request->supplier_id);

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

        return response()->json($query->latest()->get());
    }

    public function store(Request $request)
    {
        $user   = $request->user();
        $shopId = $user->hasFullAccess() ? $request->shop_id : $user->shop_id;

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
            'rounding_mode'      => 'nullable|in:auto,up,down',
            'notes'              => 'nullable|string',
            'items'              => 'required|array|min:1',
            'items.*.product_id' => 'nullable|exists:products,id',
            'items.*.new_product_name' => 'nullable|string|max:255',
            'items.*.category_id'      => 'nullable|exists:categories,id',
            'items.*.quantity'   => 'required|integer|min:1',
            'items.*.unit_price' => 'required|numeric|min:0',
            'items.*.selling_price' => 'nullable|numeric|min:0',
            'items.*.imei'       => 'nullable|string|max:255',
            'items.*.ram'        => 'nullable|string|max:50',
            'items.*.storage'    => 'nullable|string|max:50',
            'items.*.color'      => 'nullable|string|max:50',
            'items.*.min_selling_price' => 'nullable|numeric|min:0',
            'items.*.max_selling_price' => 'nullable|numeric|min:0',
        ]);

        return DB::transaction(function () use ($data, $shopId, $user) {
            $totalAmount = collect($data['items'])->sum(fn($i) => $i['quantity'] * $i['unit_price']);
            $discount    = $data['discount'] ?? 0;
            $cgstRate    = $data['cgst_rate'] ?? 9;
            $sgstRate    = $data['sgst_rate'] ?? 9;
            $cgstAmount  = ($totalAmount * $cgstRate) / 100;
            $sgstAmount  = ($totalAmount * $sgstRate) / 100;
            $roundingMode = $data['rounding_mode'] ?? 'auto';
            $rawGrandTotal = $totalAmount + $cgstAmount + $sgstAmount - $discount;
            if ($roundingMode === 'up') $grandTotal = ceil($rawGrandTotal);
            else if ($roundingMode === 'down') $grandTotal = floor($rawGrandTotal);
            else $grandTotal = round($rawGrandTotal);
            $invoiceNo   = 'PUR-' . date('Ymd') . '-' . strtoupper(substr(uniqid(), -4));

            $invoice = PurchaseInvoice::create([
                'invoice_no'    => $invoiceNo,
                'bill_type'     => $data['bill_type'] ?? 'kaccha',
                'shop_id'       => $shopId,
                'supplier_id'   => $data['supplier_id'],
                'user_id'       => $user->id,
                'purchase_date' => $data['purchase_date'],
                'expected_delivery_date' => $data['expected_delivery_date'] ?? null,
                'status'        => $data['status'],
                'received_at'   => $data['status'] === 'received' ? ($data['received_at'] ?? now()) : null,
                'total_amount'  => $totalAmount,
                'cgst_rate'     => $cgstRate,
                'sgst_rate'     => $sgstRate,
                'cgst_amount'   => $cgstAmount,
                'sgst_amount'   => $sgstAmount,
                'discount'      => $discount,
                'grand_total'   => $grandTotal,
                'total_paid'    => $data['total_paid'] ?? 0,
                'rounding_mode' => $roundingMode,
                'notes'         => $data['notes'] ?? null,
            ]);
            $invoice->updatePaymentStatus();
            
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
                            'sku'            => 'AUTO-' . strtoupper(substr(uniqid(), -6)),
                            'purchase_price' => $item['unit_price'],
                            'selling_price'  => $item['selling_price'] ?? ($item['unit_price'] * 1.2),
                            'attributes'     => [
                                'ram'     => $item['ram'] ?? null,
                                'storage' => $item['storage'] ?? null,
                                'color'   => $item['color'] ?? null,
                            ],
                            'min_selling_price' => $item['min_selling_price'] ?? null,
                            'max_selling_price' => $item['max_selling_price'] ?? null,
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
                    'min_selling_price'   => $item['min_selling_price'] ?? null,
                    'max_selling_price'   => $item['max_selling_price'] ?? null,
                    'total'               => $item['quantity'] * $item['unit_price'],
                ]);

                // ── Update inventory ONLY if received ──
                if ($data['status'] === 'received') {
                    Inventory::addStock($shopId, $productId, $item['quantity']);
                }
            }

            return response()->json($invoice->load('items.product'), 201);
        });
    }

    public function update(Request $request, PurchaseInvoice $purchaseInvoice)
    {
        $user   = $request->user();
        if (!$user->hasFullAccess() && $purchaseInvoice->shop_id !== $user->shop_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

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
            'rounding_mode'      => 'nullable|in:auto,up,down',
            'notes'              => 'nullable|string',
            'items'              => 'required|array|min:1',
            'items.*.product_id' => 'nullable|exists:products,id',
            'items.*.new_product_name' => 'nullable|string|max:255',
            'items.*.category_id'      => 'nullable|exists:categories,id',
            'items.*.quantity'   => 'required|integer|min:1',
            'items.*.unit_price' => 'required|numeric|min:0',
            'items.*.selling_price' => 'nullable|numeric|min:0',
            'items.*.imei'       => 'nullable|string|max:255',
            'items.*.ram'        => 'nullable|string|max:50',
            'items.*.storage'    => 'nullable|string|max:50',
            'items.*.color'      => 'nullable|string|max:50',
            'items.*.min_selling_price' => 'nullable|numeric|min:0',
            'items.*.max_selling_price' => 'nullable|numeric|min:0',
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

            // 3. Update Invoice Header
            $totalAmount = collect($data['items'])->sum(fn($i) => $i['quantity'] * $i['unit_price']);
            $discount    = $data['discount'] ?? 0;
            $cgstRate    = $data['cgst_rate'] ?? 9;
            $sgstRate    = $data['sgst_rate'] ?? 9;
            $cgstAmount  = ($totalAmount * $cgstRate) / 100;
            $sgstAmount  = ($totalAmount * $sgstRate) / 100;
            $roundingMode = $data['rounding_mode'] ?? 'auto';
            $rawGrandTotal = $totalAmount + $cgstAmount + $sgstAmount - $discount;
            if ($roundingMode === 'up') $grandTotal = ceil($rawGrandTotal);
            else if ($roundingMode === 'down') $grandTotal = floor($rawGrandTotal);
            else $grandTotal = round($rawGrandTotal);

            $purchaseInvoice->update([
                'supplier_id'   => $data['supplier_id'],
                'bill_type'     => $data['bill_type'] ?? $purchaseInvoice->bill_type,
                'purchase_date' => $data['purchase_date'],
                'expected_delivery_date' => $data['expected_delivery_date'] ?? null,
                'status'        => $data['status'],
                'received_at'   => $data['status'] === 'received' ? ($data['received_at'] ?? $purchaseInvoice->received_at ?? now()) : null,
                'total_amount'  => $totalAmount,
                'cgst_rate'     => $cgstRate,
                'sgst_rate'     => $sgstRate,
                'cgst_amount'   => $cgstAmount,
                'sgst_amount'   => $sgstAmount,
                'discount'      => $discount,
                'grand_total'   => $grandTotal,
                'total_paid'    => $data['total_paid'] ?? $purchaseInvoice->total_paid,
                'rounding_mode' => $roundingMode,
                'notes'         => $data['notes'] ?? null,
            ]);
            $purchaseInvoice->updatePaymentStatus();

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
                            'sku'            => 'AUTO-' . strtoupper(substr(uniqid(), -6)),
                            'purchase_price' => $item['unit_price'],
                            'selling_price'  => $item['selling_price'] ?? ($item['unit_price'] * 1.2),
                            'attributes'     => [
                                'ram'     => $item['ram'] ?? null,
                                'storage' => $item['storage'] ?? null,
                                'color'   => $item['color'] ?? null,
                            ],
                            'min_selling_price' => $item['min_selling_price'] ?? null,
                            'max_selling_price' => $item['max_selling_price'] ?? null,
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
                    'min_selling_price'   => $item['min_selling_price'] ?? null,
                    'max_selling_price'   => $item['max_selling_price'] ?? null,
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
        return response()->json($purchaseInvoice->load('supplier', 'user', 'items.product'));
    }

    public function destroy(Request $request, PurchaseInvoice $purchaseInvoice)
    {
        $user = $request->user();
        if (! $user->hasFullAccess() && $purchaseInvoice->shop_id !== $user->shop_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        return DB::transaction(function () use ($purchaseInvoice) {
            // Only reverse stock if it was already received
            if ($purchaseInvoice->status === 'received') {
                foreach ($purchaseInvoice->items as $item) {
                    Inventory::removeStock($purchaseInvoice->shop_id, $item->product_id, $item->quantity);
                }
            }
            $purchaseInvoice->delete();
            return response()->json(['message' => 'Purchase order deleted.']);
        });
    }

    public function pendingStocks(Request $request)
    {
        $user = $request->user();
        $shopId = $user->hasFullAccess() ? $request->shop_id : $user->shop_id;
        if ($user->hasFullAccess() && !$shopId) $shopId = 1;

        $query = PurchaseItem::with(['product.category', 'invoice.supplier'])
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
                $q->where('category_id', 1); // Mobile
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
}
