<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Product;
use App\Models\Inventory;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;

use App\Http\Resources\ProductResource;

class ProductController extends Controller
{
    /**
     * Simple paginated, searchable, filterable product list for the Stickers
     * feature. Deliberately separate from index() above, which is entangled
     * with stock-grouping logic for the main Products/Stock pages.
     */
    public function stickerList(Request $request)
    {
        $user = $request->user();
        if (!$user->can('view_products') && !$user->isOwner()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $query = Product::with('category:id,name')
            ->select('id', 'category_id', 'name', 'sku', 'imei', 'selling_price', 'attributes')
            ->orderBy('name');

        if ($request->search) {
            $s = $request->search;
            $query->where(function ($q) use ($s) {
                $q->where('name', 'like', "%{$s}%")
                  ->orWhere('sku', 'like', "%{$s}%")
                  ->orWhere('imei', 'like', "%{$s}%")
                  ->orWhere('attributes->brand', 'like', "%{$s}%");
            });
        }

        if ($request->category_id) {
            $query->where('category_id', $request->category_id);
        }

        return response()->json($query->paginate($request->per_page ?? 20));
    }

    public function index(Request $request)
    {
        $user = $request->user();
        $shopId = $user->hasFullAccess() ? $request->shop_id : $user->shop_id;

        // If user wants ungrouped "every single product" view
        if ($request->group_by_config === 'false' || $request->group_by_config === 'true') {
            $grouped = [];

            if ($request->category_group !== 'new_mobile') {
                $oldMobileStock = $this->getOldMobileStock($shopId, $request);
                foreach ($oldMobileStock as $item) {
                    $key = $this->generateGroupKey($item['product'], $item['ram'], $item['storage'], $item['color']);
                    if (!isset($grouped[$key])) {
                        $grouped[$key] = [
                            'id'          => 'group_' . md5($key),
                            'product_id'  => $item['product_id'],
                            'name'        => $item['product']->name,
                            'imei'        => $item['imei'],   // root-level IMEI for individual devices
                            'attributes'  => [
                                'color'       => $item['color'],
                                'ram'         => $item['ram'],
                                'storage'     => $item['storage'],
                                'imei'        => $item['imei'],   // for display in Available Stock table
                                'imeis'       => $item['imei'] ? [$item['imei']] : [],
                                'description' => $item['product']->attributes['description'] ?? '',
                            ],
                            'current_stock'    => 0,
                            'selling_price'    => $item['selling_price'],
                            'wholeseller_price' => $item['product']->wholeseller_price ?? 0,
                            'purchase_price'   => $item['product']->purchase_price ?? 0,
                            'incentive_amount' => $item['product']->incentive_amount ?? 0,
                            'min_selling_price' => $item['product']->min_selling_price ?? 0,
                            'max_selling_price' => $item['product']->max_selling_price ?? 0,
                            'location'    => $item['product']->location,
                            'category'    => $item['product']->category,
                            'brand'       => $item['product']->brand,
                            'is_grouped'  => true,
                            'is_old_mobile' => true,
                        ];
                    }
                    $grouped[$key]['current_stock'] += $item['quantity'];
                }
            }

            if ($request->category_group !== 'old_mobile') {
                $query = \App\Models\PurchaseItem::with(['product.category', 'product.brand', 'invoice.supplier'])
                    // "Currently at" shop — not the invoice's (buying) shop, since Stock
                    // Transfer can move a unit to a different shop than the one that paid
                    // for it. The purchase invoice itself (price, supplier, GST, date
                    // filters below) always stays tied to whichever shop actually bought it.
                    ->when($shopId, fn($q) => $q->where('current_shop_id', $shopId))
                    ->whereHas('invoice', function($q) use ($request) {
                        $q->where('status', 'received');
                        if ($request->supplier_id) $q->where('supplier_id', $request->supplier_id);
                        if ($request->from) $q->where('purchase_date', '>=', $request->from);
                        if ($request->to) $q->where('purchase_date', '<=', $request->to);
                    })
                    ->whereHas('product', function($q) use ($request) {
                        if ($request->category_id) $q->where('category_id', $request->category_id);
                        if ($request->category_group) {
                            $group = $request->category_group;
                            if ($group === 'new_mobile') {
                                $q->whereHas('category', fn($cq) => $cq->whereIn('slug', ['MOBILE-NEW', 'mobile-new']));
                            } elseif ($group === 'other') {
                                $q->whereHas('category', fn($cq) => $cq->whereNotIn('slug', ['MOBILE-NEW', 'mobile-new', 'MOBILE-OLD', 'mobile-old']));
                            }
                        }
                        if ($request->model) $q->where('name', 'like', "%{$request->model}%");
                    });

                if ($request->search) {
                    $s = $request->search;
                    $query->where(function($q) use ($s) {
                        $q->whereHas('product', function($pq) use ($s) {
                            $pq->where('name', 'like', "%{$s}%")
                              ->orWhere('attributes->model', 'like', "%{$s}%");
                        })
                        ->orWhere('imei', 'like', "%{$s}%");
                    });
                }

                if ($request->color)   $query->where('color', 'like', "%{$request->color}%");
                if ($request->imei)    $query->where('imei', 'like', "%{$request->imei}%");
                if ($request->ram)     $query->where('ram', 'like', "%{$request->ram}%");
                if ($request->storage) $query->where('storage', 'like', "%{$request->storage}%");
                
                $items = $query->get();

                $saleItemsQuery = \App\Models\SaleItem::whereHas('invoice', function($q) use ($shopId) {
                    $q->where('is_cancelled', false);
                    if ($shopId) $q->where('shop_id', $shopId);
                });
                if ($request->category_id) {
                    $saleItemsQuery->whereHas('product', fn($pq) => $pq->where('category_id', $request->category_id));
                }
                
                $saleItems = $saleItemsQuery->get();
                $soldImeis = $saleItems->pluck('imei')->filter()->toArray();
                $soldCounts = []; 
                foreach ($saleItems as $si) {
                    if ($si->imei) continue; 
                    $key = $this->generateGroupKey($si->product, $si->ram, $si->storage, $si->color);
                    $soldCounts[$key] = ($soldCounts[$key] ?? 0) + $si->quantity;
                }

                // group_by_config === 'true' merges every batch of a given product+config into
                // one summary row (id "group_<hash>") for the Model Wise Stock view — those rows
                // aren't individually editable/deletable since they can span many purchase
                // invoices. group_by_config === 'false' (the "All Stocks" list, where Edit/Del
                // are shown) must instead emit one row per real, actionable unit so those buttons
                // have a concrete PurchaseItem to act on.
                $isGrouped = $request->group_by_config !== 'false';

                foreach ($items as $item) {
                    $key = $this->generateGroupKey($item->product, $item->ram, $item->storage, $item->color);
                    $imeisRaw = $item->imei ? array_map('trim', explode(',', $item->imei)) : [];
                    $unsoldImeis = [];
                    foreach ($imeisRaw as $idx => $imeiVal) {
                        if ($imeiVal === '' || in_array($imeiVal, $soldImeis)) continue;
                        // The query above matches this whole PurchaseItem batch if ANY of its
                        // comma-joined IMEIs contains the search term — without this check every
                        // sibling device in the batch would be returned too, so picking data[0]
                        // (e.g. the New Sale IMEI pre-fill) could silently grab the wrong device.
                        if ($request->imei && stripos($imeiVal, $request->imei) === false) continue;
                        $unsoldImeis[] = ['imei' => $imeiVal, 'idx' => $idx];
                    }
                    $availableImeiCount = count($unsoldImeis);
                    // This whole query is already scoped to status === 'received' invoices
                    // (see the whereHas above), so received_quantity was always deliberately
                    // set by then — either at creation, or explicitly via markReceived(),
                    // which can legitimately be 0 for an item that was fully rejected/damaged.
                    // Falling back to the original ordered quantity here would silently treat
                    // that as fully received, showing ordered-but-not-actually-received stock.
                    $totalQty = $item->received_quantity;
                    $nonImeiQty = ($item->imei) ? 0 : $totalQty;

                    if ($nonImeiQty > 0 && isset($soldCounts[$key])) {
                        $diff = min($nonImeiQty, $soldCounts[$key]);
                        $nonImeiQty -= $diff;
                        $soldCounts[$key] -= $diff;
                    }

                    $currentStock = $availableImeiCount + $nonImeiQty;
                    if ($currentStock <= 0) continue;

                    $baseFields = [
                        'product_id' => $item->product_id,
                        'name' => $item->product->name,
                        'selling_price' => $item->selling_price, 'wholeseller_price' => $item->wholeseller_price,
                        'purchase_price' => $item->unit_price,
                        'incentive_amount' => $item->incentive_amount ?? $item->product->incentive_amount,
                        'min_selling_price' => $item->min_selling_price ?? $item->product->min_selling_price,
                        'max_selling_price' => $item->max_selling_price ?? $item->product->max_selling_price,
                        'location' => $item->location ?? $item->product->location,
                        'category' => $item->product->category, 'brand' => $item->product->brand,
                    ];
                    $baseAttrs = ['color' => $item->color, 'ram' => $item->ram, 'storage' => $item->storage, 'description' => $item->product->attributes['description'] ?? ''];

                    if ($isGrouped) {
                        if (!isset($grouped[$key])) {
                            $grouped[$key] = array_merge($baseFields, [
                                'id' => 'group_' . md5($key),
                                'attributes' => array_merge($baseAttrs, ['imeis' => []]),
                                'current_stock' => 0,
                                'is_grouped' => true,
                            ]);
                        }
                        $grouped[$key]['current_stock'] += $currentStock;
                        $grouped[$key]['attributes']['imeis'] = array_merge($grouped[$key]['attributes']['imeis'], array_column($unsoldImeis, 'imei'));
                    } else {
                        foreach ($unsoldImeis as $u) {
                            $rowKey = "item_{$item->id}_{$u['idx']}";
                            $grouped[$rowKey] = array_merge($baseFields, [
                                'id' => $rowKey,
                                'attributes' => array_merge($baseAttrs, ['imei' => $u['imei'], 'imeis' => [$u['imei']]]),
                                'current_stock' => 1,
                                'is_grouped' => false,
                            ]);
                        }
                        if ($nonImeiQty > 0) {
                            $rowKey = "item_ni_{$item->id}";
                            $grouped[$rowKey] = array_merge($baseFields, [
                                'id' => $rowKey,
                                'attributes' => array_merge($baseAttrs, ['imeis' => []]),
                                'current_stock' => $nonImeiQty,
                                'is_grouped' => false,
                            ]);
                        }
                    }
                }

                // Reconcile leftover no-IMEI sales that never matched a no-IMEI purchase
                // batch (i.e. the product's stock was purchased with IMEIs tracked, but the
                // sale was recorded without one). Those units are gone but the loop above has
                // no way to remove a *specific* IMEI for them, so subtract from the group total
                // and drop that many IMEIs from the picker list to keep both in sync. Only
                // applies to the merged (grouped) view — the ungrouped view already reflects
                // real per-batch data as-is.
                //
                // $soldCounts is built from ALL sales system-wide (not scoped to the current
                // model/color/ram/storage/imei/search filters), so it's only a valid correction
                // against the FULL, unfiltered stock total for a group. Applying it while a
                // narrow filter is active would deduct unrelated sales from a tiny filtered
                // result and could zero out a unit that's genuinely still in stock — so skip
                // it entirely whenever the request is searching for something specific.
                $hasNarrowFilter = $request->color || $request->ram || $request->storage || $request->imei || $request->model || $request->search;
                if ($isGrouped && !$hasNarrowFilter) {
                    foreach ($soldCounts as $key => $leftover) {
                        if ($leftover <= 0 || !isset($grouped[$key])) continue;
                        $deduct = min($leftover, $grouped[$key]['current_stock']);
                        $grouped[$key]['current_stock'] -= $deduct;
                        if ($deduct > 0 && !empty($grouped[$key]['attributes']['imeis'])) {
                            $grouped[$key]['attributes']['imeis'] = array_slice($grouped[$key]['attributes']['imeis'], 0, max(0, count($grouped[$key]['attributes']['imeis']) - $deduct));
                        }
                    }
                    $grouped = array_filter($grouped, fn($g) => $g['current_stock'] > 0 || !empty($g['attributes']['imeis']));
                }
            }
            return response()->json($this->sortStockItems(array_values($grouped)));
        }

        $query = Product::with(['category', 'brand', 'inventory' => function($q) use ($shopId) {
            if ($shopId) {
                $q->where('shop_id', $shopId);
            }
        }])->withTrashed()->where('deleted_at', null);
        if ($request->category_id) $query->where('category_id', $request->category_id);
        if ($request->category_group) {
            $group = $request->category_group;
            if ($group === 'new_mobile') {
                $query->whereHas('category', function($q) {
                    $q->whereIn('slug', ['MOBILE-NEW', 'mobile-new']);
                });
            } elseif ($group === 'old_mobile') {
                $query->whereHas('category', function($q) {
                    $q->whereIn('slug', ['MOBILE-OLD', 'mobile-old']);
                });
            } elseif ($group === 'other') {
                $query->whereHas('category', function($q) {
                    $q->whereNotIn('slug', ['MOBILE-NEW', 'mobile-new', 'MOBILE-OLD', 'mobile-old']);
                });
            }
        }
        if ($request->search) {
            $query->where(function($q) use ($request) {
                $q->where('name', 'like', "%{$request->search}%")
                  ->orWhere('attributes->model', 'like', "%{$request->search}%");
            });
        }
        if ($request->description) {
            $query->where('attributes->description', 'like', "%{$request->description}%");
        }
        
        return ProductResource::collection($query->latest()->get());
    }

    public function store(Request $request)
    {
        $user = $request->user();
        if (!$user->can('view_products') && !$user->isOwner()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $data = $request->validate([
            'category_id'       => 'required|exists:categories,id',
            'brand_id'          => 'nullable|exists:brands,id',
            'name'              => 'required|string|max:200',
            'sku'               => 'required|string|max:100|unique:products,sku',
            'imei'              => 'nullable|string|max:20|unique:products,imei',
            'purchase_price'    => 'required|numeric|min:0',
            'selling_price'     => 'required|numeric|min:0',
            'wholeseller_price' => 'nullable|numeric|min:0',
            'min_selling_price' => 'nullable|numeric|min:0',
            'max_selling_price' => 'nullable|numeric|min:0',
            'condition'         => 'in:new,used',
            'attributes'        => 'nullable|array',
            'location'          => 'nullable|string|max:200',
            'subcategory'       => 'nullable|string|max:100',
        ]);

        if (!empty($data['subcategory'])) {
            $sub = trim($data['subcategory']);
            \App\Models\Subcategory::firstOrCreate([
                'name' => strtoupper($sub),
            ]);
            $data['subcategory'] = strtoupper($sub);
        }

        $product = Product::create($data);
        ActivityLog::log('PRODUCT_CREATED', $product, "Product added: {$product->name} (SKU: {$product->sku}) ₹{$product->selling_price}");
        return response()->json($product, 201);
    }

    public function show(Request $request, Product $product)
    {
        $user = $request->user();
        $shopId = $user->hasFullAccess() ? null : $user->shop_id;

        return response()->json($product->load(['category', 'inventory' => function($q) use ($shopId) {
            if ($shopId) {
                $q->where('shop_id', $shopId);
            }
        }, 'inventory.shop']));
    }

    public function update(Request $request, Product $product)
    {
        $user = $request->user();
        if (!$user->can('view_products') && !$user->isOwner()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $data = $request->validate([
            'category_id'       => 'sometimes|exists:categories,id',
            'brand_id'          => 'nullable|exists:brands,id',
            'name'              => 'sometimes|string|max:200',
            'sku'               => 'sometimes|string|max:100|unique:products,sku,' . $product->id,
            'imei'              => 'nullable|string|max:20|unique:products,imei,' . $product->id,
            'purchase_price'    => 'sometimes|numeric|min:0',
            'selling_price'     => 'sometimes|numeric|min:0',
            'wholeseller_price' => 'nullable|numeric|min:0',
            'min_selling_price' => 'nullable|numeric|min:0',
            'max_selling_price' => 'nullable|numeric|min:0',
            'condition'         => 'in:new,used',
            'attributes'        => 'nullable|array',
            'location'          => 'nullable|string|max:200',
            'subcategory'       => 'nullable|string|max:100',
        ]);

        if (array_key_exists('subcategory', $data) && !empty($data['subcategory'])) {
            $sub = trim($data['subcategory']);
            \App\Models\Subcategory::firstOrCreate([
                'name' => strtoupper($sub),
            ]);
            $data['subcategory'] = strtoupper($sub);
        }

        $product->update($data);
        ActivityLog::log('PRODUCT_UPDATED', $product, "Product updated: {$product->name} (SKU: {$product->sku})");
        return response()->json($product);
    }

    public function destroy(Request $request, Product $product)
    {
        if (!$request->user()->hasFullAccess()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        ActivityLog::log('PRODUCT_DELETED', $product, "Product deleted: {$product->name} (SKU: {$product->sku}) ₹{$product->selling_price}");

        // A soft delete leaves products.sku/imei permanently blocked from reuse (MySQL's
        // UNIQUE index doesn't exempt soft-deleted rows). If this product genuinely has
        // no purchase/sale history at all, hard-delete it outright so its SKU/IMEI can be
        // reused later — otherwise fall back to the normal, safe soft delete that
        // preserves history for products with real invoices behind them. purchase_items
        // and sale_items have no cascade/null-on-delete on product_id, so a product still
        // referenced there will simply fail to hard-delete and we fall through safely.
        $hasHistory = \App\Models\PurchaseItem::where('product_id', $product->id)->exists()
            || \App\Models\SaleItem::where('product_id', $product->id)->exists();

        if (!$hasHistory) {
            try {
                $product->forceDelete();
                return response()->json(['message' => 'Product deleted']);
            } catch (\Illuminate\Database\QueryException $e) {
                // fall through to the normal soft delete below
            }
        }

        $product->delete();
        return response()->json(['message' => 'Product deleted']);
    }

    public function deleteStock(Request $request, $id)
    {
        $user = $request->user();
        if (!$user->hasFullAccess()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if (str_starts_with($id, 'item_ni_')) {
            $parts = explode('_', $id); // ['item', 'ni', '123', '0']
            $itemId = $parts[2];
            $imeiIndex = null;
        } else if (str_starts_with($id, 'item_')) {
            $parts = explode('_', $id); // ['item', '123', '0']
            $itemId = $parts[1];
            $imeiIndex = isset($parts[2]) ? $parts[2] : null;
        } else {
            $itemId = $id;
            $imeiIndex = null;
        }

        return DB::transaction(function () use ($itemId, $imeiIndex) {
            $item = \App\Models\PurchaseItem::with('invoice')->findOrFail($itemId);
            $invoice = $item->invoice;

            // 1. Dec स्टॉक
            Inventory::removeStock($invoice->shop_id, $item->product_id, 1);

            // 2. Adjust or Delete PurchaseItem
            if ($item->quantity > 1) {
                if ($imeiIndex !== null && $item->imei) {
                    $imeis = array_map('trim', explode(',', $item->imei));
                    if (isset($imeis[$imeiIndex])) {
                        unset($imeis[$imeiIndex]);
                        $item->imei = implode(', ', $imeis);
                    }
                }
                $item->decrement('quantity');
                $item->decrement('received_quantity');
                $item->total = $item->quantity * $item->unit_price;
                $item->save();
            } else {
                $item->delete();
            }

            // 3. Recalculate Invoice Totals
            $invoice->refresh();
            $items = $invoice->items;
            $totalAmount = $items->sum(fn($i) => $i->quantity * $i->unit_price);
            
            $cgstAmount = ($totalAmount * ($invoice->cgst_rate ?? 9)) / 100;
            $sgstAmount = ($totalAmount * ($invoice->sgst_rate ?? 9)) / 100;
            $rawGrandTotal = $totalAmount + $cgstAmount + $sgstAmount - ($invoice->discount ?? 0);
            
            if ($invoice->rounding_mode === 'up') $grandTotal = ceil($rawGrandTotal);
            else if ($invoice->rounding_mode === 'down') $grandTotal = floor($rawGrandTotal);
            else $grandTotal = round($rawGrandTotal);

            $invoice->update([
                'total_amount' => $totalAmount,
                'cgst_amount'  => $cgstAmount,
                'sgst_amount'  => $sgstAmount,
                'grand_total'  => $grandTotal,
            ]);
            $invoice->updatePaymentStatus();

            return response()->json(['message' => 'Stock item deleted and invoice updated successfully.']);
        });
    }

    public function updateStock(Request $request, $id)
    {
        $user = $request->user();
        if (!$user->hasFullAccess()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if (str_starts_with($id, 'item_ni_')) {
            $parts = explode('_', $id);
            $itemId = $parts[2];
            $imeiIndex = null;
        } else if (str_starts_with($id, 'item_')) {
            $parts = explode('_', $id);
            $itemId = $parts[1];
            $imeiIndex = isset($parts[2]) ? $parts[2] : null;
        } else {
            $itemId = $id;
            $imeiIndex = null;
        }

        return DB::transaction(function () use ($request, $itemId, $imeiIndex) {
            $item = \App\Models\PurchaseItem::with('invoice')->findOrFail($itemId);

            // Update IMEI
            if ($request->has('imeis') && is_array($request->imeis) && $imeiIndex === null) {
                // item_ni_<id>: this row IS the entire remaining no-IMEI batch (no sibling
                // units live outside it), so a full multi-box replace is safe. Used to
                // backfill IMEIs on old bulk stock that was purchased without them.
                $item->imei = implode(', ', array_filter(array_map('trim', $request->imeis), fn($v) => $v !== ''));
            } else {
                // item_<id>_<idx>: this row is ONE unit inside a possibly multi-unit batch
                // that may have sibling IMEIs recorded on the same PurchaseItem — only the
                // single value at $imeiIndex may be touched, never the whole field.
                $singleImei = ($request->has('imeis') && is_array($request->imeis)) ? ($request->imeis[0] ?? null) : $request->imei;

                if ($singleImei !== null && $imeiIndex !== null && $item->imei) {
                    $imeis = array_map('trim', explode(',', $item->imei));
                    if (isset($imeis[$imeiIndex])) {
                        $imeis[$imeiIndex] = $singleImei;
                        $item->imei = implode(', ', $imeis);
                    }
                } else if ($singleImei !== null && (!$item->imei || $item->quantity == 1)) {
                    $item->imei = $singleImei;
                }
            }

            // Update other fields
            if ($request->has('color')) $item->color = $request->color;
            if ($request->has('ram')) $item->ram = $request->ram;
            if ($request->has('storage')) $item->storage = $request->storage;
            if ($request->has('selling_price')) $item->selling_price = $request->selling_price;
            if ($request->has('wholeseller_price')) $item->wholeseller_price = $request->wholeseller_price;
            if ($request->has('min_selling_price')) $item->min_selling_price = $request->min_selling_price;
            if ($request->has('incentive_amount')) $item->incentive_amount = $request->incentive_amount;

            $recalcInvoice = false;
            if ($request->has('unit_price') && $request->unit_price !== null && $request->unit_price !== '') {
                if ($item->unit_price != $request->unit_price) {
                    $item->unit_price = $request->unit_price;
                    $item->total = $item->quantity * $item->unit_price;
                    $recalcInvoice = true;
                }
            }

            $item->save();

            if ($recalcInvoice && $item->invoice) {
                $invoice = $item->invoice;
                $invoice->refresh();
                $items = $invoice->items;
                $totalAmount = $items->sum(fn($i) => $i->quantity * $i->unit_price);
                
                $cgstAmount = ($totalAmount * ($invoice->cgst_rate ?? 9)) / 100;
                $sgstAmount = ($totalAmount * ($invoice->sgst_rate ?? 9)) / 100;
                $rawGrandTotal = $totalAmount + $cgstAmount + $sgstAmount - ($invoice->discount ?? 0);
                
                if ($invoice->rounding_mode === 'up') $grandTotal = ceil($rawGrandTotal);
                else if ($invoice->rounding_mode === 'down') $grandTotal = floor($rawGrandTotal);
                else $grandTotal = round($rawGrandTotal);

                $invoice->update([
                    'total_amount' => $totalAmount,
                    'cgst_amount'  => $cgstAmount,
                    'sgst_amount'  => $sgstAmount,
                    'grand_total'  => $grandTotal,
                ]);
                $invoice->updatePaymentStatus();
            }

            return response()->json(['message' => 'Stock item updated successfully.']);
        });
    }

    private function generateGroupKey($product, $ram, $storage, $color)
    {
        $brandName = ($product && $product->brand) ? $product->brand->name : '';
        $productName = $product ? $product->name : '';
        
        $fullName = $brandName . ' ' . $productName;
        
        // Normalize whitespace (replace non-breaking spaces, zero-width spaces, and collapse duplicate spaces)
        $cleanName = preg_replace('/[\x{00A0}\x{200B}\s]+/u', ' ', $fullName);
        $cleanRam = preg_replace('/[\x{00A0}\x{200B}\s]+/u', ' ', $ram ?? '-');
        $cleanStorage = preg_replace('/[\x{00A0}\x{200B}\s]+/u', ' ', $storage ?? '-');
        $cleanColor = preg_replace('/[\x{00A0}\x{200B}\s]+/u', ' ', $color ?? '-');
        
        return sprintf(
            '%s_%s_%s_%s',
            strtoupper(trim($cleanName)),
            strtoupper(trim($cleanRam)),
            strtoupper(trim($cleanStorage)),
            strtoupper(trim($cleanColor))
        );
    }

    private function sortStockItems(array $items)
    {
        usort($items, function($a, $b) {
            // 1. Sort by Product Name (brand + name) ascending
            $brandA = '';
            if (isset($a['brand'])) {
                $brandA = is_object($a['brand']) ? ($a['brand']->name ?? '') : ($a['brand']['name'] ?? '');
            }
            $brandB = '';
            if (isset($b['brand'])) {
                $brandB = is_object($b['brand']) ? ($b['brand']->name ?? '') : ($b['brand']['name'] ?? '');
            }
            
            $nameA = strtoupper(trim($brandA . ' ' . $a['name']));
            $nameB = strtoupper(trim($brandB . ' ' . $b['name']));
            
            $cmp = strcmp($nameA, $nameB);
            if ($cmp !== 0) {
                return $cmp;
            }
            
            // 2. Sort by RAM descending (highest RAM first)
            $ramA = isset($a['attributes']['ram']) ? $a['attributes']['ram'] : '';
            $ramB = isset($b['attributes']['ram']) ? $b['attributes']['ram'] : '';
            
            $parseRam = function($val) {
                if (!$val) return 0;
                return (int)preg_replace('/[^0-9]/', '', $val);
            };
            
            $numRamA = $parseRam($ramA);
            $numRamB = $parseRam($ramB);
            
            if ($numRamA !== $numRamB) {
                return $numRamB <=> $numRamA;
            }
            
            // 3. Sort by Storage descending (highest Storage first)
            $storA = isset($a['attributes']['storage']) ? $a['attributes']['storage'] : '';
            $storB = isset($b['attributes']['storage']) ? $b['attributes']['storage'] : '';
            
            $parseStor = function($val) {
                if (!$val) return 0;
                $num = (int)preg_replace('/[^0-9]/', '', $val);
                if (stripos($val, 'TB') !== false) {
                    $num *= 1024;
                }
                return $num;
            };
            
            $numStorA = $parseStor($storA);
            $numStorB = $parseStor($storB);
            
            if ($numStorA !== $numStorB) {
                return $numStorB <=> $numStorA;
            }
            
            // 4. Sort by Color ascending (alphabetical)
            $colorA = isset($a['attributes']['color']) ? strtoupper(trim($a['attributes']['color'])) : '';
            $colorB = isset($b['attributes']['color']) ? strtoupper(trim($b['attributes']['color'])) : '';
            return strcmp($colorA, $colorB);
        });
        
        return $items;
    }

    /**
     * Fetch old-mobile products from Product+Inventory tables.
     * Old mobiles purchased via trade-in/exchange use OldMobilePurchase which directly
     * inserts into Product + Inventory — NOT into PurchaseItem. So we must read from
     * the product/inventory tables for the old_mobile Available Stock view.
     */
    private function getOldMobileStock($shopId, $request): array
    {
        $oldMobileCatId = \App\Models\Category::mobileOldId();
        if (!$oldMobileCatId) return [];

        // Fetch products in MOBILE-OLD category that have inventory stock > 0
        $productQuery = Product::with(['category', 'brand'])
            ->where('category_id', $oldMobileCatId)
            ->where('deleted_at', null)
            ->whereHas('inventory', function($q) use ($shopId) {
                $q->where('stock', '>', 0);
                if ($shopId) $q->where('shop_id', $shopId);
            })
            ->with(['inventory' => function($q) use ($shopId) {
                if ($shopId) $q->where('shop_id', $shopId);
            }]);

        // Apply search / model filter
        if ($request->search) {
            $s = $request->search;
            $productQuery->where(function($q) use ($s) {
                $q->where('name', 'like', "%{$s}%")->orWhere('imei', 'like', "%{$s}%");
            });
        }
        if ($request->model) {
            $productQuery->where('name', 'like', "%{$request->model}%");
        }
        if ($request->imei) {
            $productQuery->where('imei', 'like', "%{$request->imei}%");
        }
        if ($request->color) {
            $productQuery->where(function($q) use ($request) {
                $q->where('attributes->color', 'like', "%{$request->color}%");
            });
        }
        if ($request->ram) {
            $productQuery->where('attributes->ram', 'like', "%{$request->ram}%");
        }
        if ($request->storage) {
            $productQuery->where('attributes->storage', 'like', "%{$request->storage}%");
        }

        $products = $productQuery->get();

        // Exclude already-sold products (sold via SaleItem)
        $soldProductIds = \App\Models\SaleItem::whereHas('invoice', function($q) use ($shopId) {
            $q->where('is_cancelled', false);
            if ($shopId) $q->where('shop_id', $shopId);
        })
        ->whereHas('product', function($q) use ($oldMobileCatId) {
            $q->where('category_id', $oldMobileCatId);
        })
        ->pluck('product_id')
        ->toArray();

        $result = [];
        foreach ($products as $product) {
            // Calculate actual available stock from inventory minus sold
            $inventoryStock = $product->inventory->sum('stock');
            // Count how many times this product was sold
            $soldCount = \App\Models\SaleItem::whereHas('invoice', function($q) use ($shopId) {
                $q->where('is_cancelled', false);
                if ($shopId) $q->where('shop_id', $shopId);
            })->where('product_id', $product->id)->sum('quantity');

            $available = max(0, $inventoryStock - (int)$soldCount);
            if ($available <= 0) continue;

            $ram     = $product->attributes['ram'] ?? null;
            $storage = $product->attributes['storage'] ?? null;
            $color   = $product->attributes['color'] ?? null;

            $result[] = [
                'product_id'    => $product->id,
                'product'       => $product,
                'ram'           => $ram,
                'storage'       => $storage,
                'color'         => $color,
                'selling_price' => $product->selling_price ?? 0,
                'quantity'      => $available,
                'imei'          => $product->imei,
            ];
        }

        return $result;
    }
}
