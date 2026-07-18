<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Inventory;
use App\Models\Product;
use App\Models\PurchaseItem;
use App\Models\SaleItem;
use App\Models\StockTransfer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StockTransferController extends Controller
{
    /**
     * Minimal shop list (id + name only) for the "transfer to" picker.
     * The full /shops endpoint is owner/admin-only, but any user needs to
     * see other shops' names to send stock to them.
     */
    public function shopsList()
    {
        return response()->json(\App\Models\Shop::select('id', 'name')->orderBy('name')->get());
    }

    /**
     * Real, currently-available stock at a shop for a product — grouped by
     * config (ram/storage/color), each with the exact IMEIs (for serialized
     * units) or FIFO batches (for bulk units) that a transfer can be built
     * from. This mirrors ProductController::index()'s "All Stocks" math
     * (purchased minus sold, per current_shop_id) so what's offered here is
     * always exactly what's actually on the shelf.
     */
    public function stockAt(Request $request)
    {
        $user = $request->user();
        $shopId = $request->input('shop_id');
        if (!$shopId || (!$user->hasFullAccess() && $shopId != $user->shop_id)) {
            $shopId = $user->shop_id;
        }
        if (!$shopId) {
            return response()->json([]);
        }

        $productId = $request->input('product_id');
        return response()->json($this->availableUnits((int) $shopId, $productId ? (int) $productId : null));
    }

    /**
     * List of distinct in-stock products at a shop (for the product picker,
     * before drilling into a specific product's available units/config).
     */
    public function productsAt(Request $request)
    {
        $user = $request->user();
        $shopId = $request->input('shop_id');
        if (!$shopId || (!$user->hasFullAccess() && $shopId != $user->shop_id)) {
            $shopId = $user->shop_id;
        }
        if (!$shopId) {
            return response()->json([]);
        }

        $productIds = PurchaseItem::where('current_shop_id', $shopId)
            ->whereHas('invoice', fn ($q) => $q->where('status', 'received'))
            ->distinct()
            ->pluck('product_id');

        $products = Product::with(['brand', 'category'])->whereIn('id', $productIds)->get()
            ->map(fn ($p) => ['id' => $p->id, 'name' => $p->name, 'brand' => $p->brand?->name, 'category' => $p->category?->name]);

        return response()->json($products->values());
    }

    private function groupKey($product, $ram, $storage, $color): string
    {
        $clean = fn ($s) => trim(preg_replace('/[\x{00A0}\x{200B}\s]+/u', ' ', $s ?? '-'));
        $name = trim((($product?->brand?->name ?? '') . ' ' . ($product?->name ?? '')));
        return strtoupper($clean($name) . '|' . $clean($ram) . '|' . $clean($storage) . '|' . $clean($color));
    }

    /**
     * Available units at $shopId (optionally scoped to one product), grouped
     * by config. Same "purchased minus sold" logic as the main stock screens.
     */
    private function availableUnits(int $shopId, ?int $productId = null): array
    {
        $itemsQuery = PurchaseItem::with(['product.brand', 'product.category', 'invoice'])
            ->where('current_shop_id', $shopId)
            ->whereHas('invoice', fn ($q) => $q->where('status', 'received'));
        if ($productId) {
            $itemsQuery->where('product_id', $productId);
        }
        $items = $itemsQuery->get()->sortBy(fn ($i) => ($i->invoice?->purchase_date ?? '') . '_' . str_pad($i->id, 10, '0', STR_PAD_LEFT))->values();

        $soldItemsQuery = SaleItem::whereHas('invoice', fn ($q) => $q->where('shop_id', $shopId)->where('is_cancelled', false));
        if ($productId) {
            $soldItemsQuery->where('product_id', $productId);
        }
        $soldItems = $soldItemsQuery->get();
        $soldImeis = $soldItems->pluck('imei')->filter()->map(fn ($v) => trim($v))->toArray();

        $soldCounts = [];
        foreach ($soldItems as $si) {
            if ($si->imei) {
                continue;
            }
            $key = $this->groupKey($si->product ?? Product::find($si->product_id), $si->ram, $si->storage, $si->color);
            $soldCounts[$key] = ($soldCounts[$key] ?? 0) + $si->quantity;
        }

        $groups = [];
        foreach ($items as $item) {
            $key = $this->groupKey($item->product, $item->ram, $item->storage, $item->color);
            if (!isset($groups[$key])) {
                $groups[$key] = [
                    'product_id'    => $item->product_id,
                    'product_name'  => $item->product?->name,
                    'brand'         => $item->product?->brand?->name,
                    'category'      => $item->product?->category?->name,
                    'ram'           => $item->ram,
                    'storage'       => $item->storage,
                    'color'         => $item->color,
                    'available_qty' => 0,
                    'imeis'         => [],
                    'batches'       => [],
                ];
            }

            $imeisRaw = $item->imei ? array_values(array_filter(array_map('trim', explode(',', $item->imei)))) : [];
            $availableImeiCount = 0;
            foreach ($imeisRaw as $imeiVal) {
                if (in_array($imeiVal, $soldImeis, true)) {
                    continue;
                }
                $availableImeiCount++;
                $groups[$key]['imeis'][] = [
                    'imei'              => $imeiVal,
                    'purchase_item_id'  => $item->id,
                    'purchase_invoice_id' => $item->purchase_invoice_id,
                    'unit_price'        => $item->unit_price,
                    'selling_price'     => $item->selling_price,
                    'wholeseller_price' => $item->wholeseller_price,
                    'min_selling_price' => $item->min_selling_price,
                    'max_selling_price' => $item->max_selling_price,
                    'incentive_amount'  => $item->incentive_amount,
                    'location'          => $item->location,
                ];
            }

            $nonImeiQty = $item->imei ? 0 : (int) $item->received_quantity;
            if ($nonImeiQty > 0 && !empty($soldCounts[$key])) {
                $diff = min($nonImeiQty, $soldCounts[$key]);
                $nonImeiQty -= $diff;
                $soldCounts[$key] -= $diff;
            }
            if ($nonImeiQty > 0) {
                $groups[$key]['batches'][] = [
                    'purchase_item_id'    => $item->id,
                    'purchase_invoice_id' => $item->purchase_invoice_id,
                    'qty'                 => $nonImeiQty,
                    'unit_price'          => $item->unit_price,
                    'selling_price'       => $item->selling_price,
                    'wholeseller_price'   => $item->wholeseller_price,
                    'min_selling_price'   => $item->min_selling_price,
                    'max_selling_price'   => $item->max_selling_price,
                    'incentive_amount'    => $item->incentive_amount,
                    'location'            => $item->location,
                ];
            }

            $groups[$key]['available_qty'] += $availableImeiCount + $nonImeiQty;
        }

        $groups = array_filter($groups, fn ($g) => $g['available_qty'] > 0);
        return array_values($groups);
    }

    /**
     * List stock transfers. Non-owners only see transfers touching their own
     * shop (either side) — mirrors the ownership guard used on individual
     * actions below.
     */
    public function index(Request $request)
    {
        $user = $request->user();

        $query = StockTransfer::with(['fromShop', 'toShop', 'product.brand', 'product.category', 'initiator', 'receiver'])
            ->orderByDesc('created_at');

        if (!$user->hasFullAccess()) {
            $query->where(function ($q) use ($user) {
                $q->where('from_shop_id', $user->shop_id)->orWhere('to_shop_id', $user->shop_id);
            });
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('shop_id')) {
            $shopId = $request->shop_id;
            $query->where(function ($q) use ($shopId) {
                $q->where('from_shop_id', $shopId)->orWhere('to_shop_id', $shopId);
            });
        }

        return response()->json($query->get());
    }

    /**
     * Initiate a transfer. Unlike the earlier version of this feature (which
     * only moved an aggregate Inventory counter), this actually locates the
     * real purchase_item row(s) backing the requested unit(s) and reduces
     * them right now — so the source shop's stock screens immediately stop
     * showing what's been dispatched. The unit sits "in transit" (not on
     * either shop's stock list) until receive() clones it onto the
     * destination shop, exactly like an unreceived purchase order doesn't
     * count as stock for either party.
     *
     * Pass either `imeis` (array of specific IMEIs to send) or `quantity`
     * plus `ram`/`storage`/`color` (to pull from a specific non-serialized
     * batch/config) — never both.
     */
    public function store(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'from_shop_id'  => 'required|exists:shops,id|different:to_shop_id',
            'to_shop_id'    => 'required|exists:shops,id',
            'product_id'    => 'required|exists:products,id',
            'imeis'         => 'nullable|array',
            'imeis.*'       => 'string',
            'quantity'      => 'nullable|integer|min:1',
            'ram'           => 'nullable|string',
            'storage'       => 'nullable|string',
            'color'         => 'nullable|string',
            'transfer_date' => 'required|date',
            'notes'         => 'nullable|string|max:500',
        ]);

        if (!$user->hasFullAccess() && $validated['from_shop_id'] != $user->shop_id) {
            return response()->json(['message' => 'You can only send stock from your own shop.'], 403);
        }

        $imeis = array_values(array_filter(array_map('trim', $validated['imeis'] ?? [])));
        $quantity = $validated['quantity'] ?? null;
        if (empty($imeis) && !$quantity) {
            return response()->json(['message' => 'Select at least one IMEI or enter a quantity to transfer.'], 422);
        }

        try {
            return DB::transaction(function () use ($validated, $user, $imeis, $quantity) {
                $fromShopId = $validated['from_shop_id'];
                $productId = $validated['product_id'];

                // Lock every candidate row up front so two simultaneous transfers
                // of the same stock can't both succeed.
                $candidates = PurchaseItem::where('current_shop_id', $fromShopId)
                    ->where('product_id', $productId)
                    ->whereHas('invoice', fn ($q) => $q->where('status', 'received'))
                    ->lockForUpdate()
                    ->get()
                    ->keyBy('id');

                $breakdown = [];
                $totalQty = 0;
                $imeiList = [];

                if (!empty($imeis)) {
                    foreach ($imeis as $wantedImei) {
                        $match = $candidates->first(function ($item) use ($wantedImei) {
                            $list = array_map('trim', explode(',', (string) $item->imei));
                            return in_array($wantedImei, $list, true);
                        });
                        if (!$match) {
                            throw new \RuntimeException("IMEI {$wantedImei} is not available at the source shop right now.");
                        }
                        $alreadySold = SaleItem::where('imei', $wantedImei)
                            ->whereHas('invoice', fn ($q) => $q->where('is_cancelled', false))
                            ->exists();
                        if ($alreadySold) {
                            throw new \RuntimeException("IMEI {$wantedImei} has already been sold.");
                        }

                        $remainingImeis = array_values(array_filter(
                            array_map('trim', explode(',', (string) $match->imei)),
                            fn ($v) => $v !== $wantedImei
                        ));
                        $match->imei = implode(',', $remainingImeis);
                        $match->quantity = max(0, $match->quantity - 1);
                        $match->received_quantity = max(0, $match->received_quantity - 1);
                        $match->save();
                        $candidates->put($match->id, $match);

                        $breakdown[] = [
                            'purchase_item_id'    => $match->id,
                            'purchase_invoice_id' => $match->purchase_invoice_id,
                            'imei'                => $wantedImei,
                            'qty'                 => 1,
                            'ram'                 => $match->ram,
                            'storage'             => $match->storage,
                            'color'               => $match->color,
                            'unit_price'          => $match->unit_price,
                            'selling_price'       => $match->selling_price,
                            'wholeseller_price'   => $match->wholeseller_price,
                            'min_selling_price'   => $match->min_selling_price,
                            'max_selling_price'   => $match->max_selling_price,
                            'incentive_amount'    => $match->incentive_amount,
                            'location'            => $match->location,
                        ];
                        $imeiList[] = $wantedImei;
                        $totalQty++;
                    }
                } else {
                    $ram = $validated['ram'] ?? null;
                    $storage = $validated['storage'] ?? null;
                    $color = $validated['color'] ?? null;

                    $nonImeiCandidates = $candidates
                        ->filter(fn ($i) => !$i->imei && $i->ram == $ram && $i->storage == $storage && $i->color == $color && $i->received_quantity > 0)
                        ->sortBy(fn ($i) => $i->id);

                    $soldQty = (int) SaleItem::whereNull('imei')
                        ->where('product_id', $productId)
                        ->where('ram', $ram)->where('storage', $storage)->where('color', $color)
                        ->whereHas('invoice', fn ($q) => $q->where('shop_id', $fromShopId)->where('is_cancelled', false))
                        ->sum('quantity');

                    $remaining = $quantity;
                    foreach ($nonImeiCandidates as $item) {
                        if ($remaining <= 0) {
                            break;
                        }
                        $availableHere = (int) $item->received_quantity;
                        if ($soldQty > 0) {
                            $consume = min($soldQty, $availableHere);
                            $availableHere -= $consume;
                            $soldQty -= $consume;
                        }
                        if ($availableHere <= 0) {
                            continue;
                        }
                        $take = min($availableHere, $remaining);

                        $item->received_quantity -= $take;
                        $item->quantity = max(0, $item->quantity - $take);
                        $item->save();

                        $breakdown[] = [
                            'purchase_item_id'    => $item->id,
                            'purchase_invoice_id' => $item->purchase_invoice_id,
                            'imei'                => null,
                            'qty'                 => $take,
                            'ram'                 => $item->ram,
                            'storage'             => $item->storage,
                            'color'               => $item->color,
                            'unit_price'          => $item->unit_price,
                            'selling_price'       => $item->selling_price,
                            'wholeseller_price'   => $item->wholeseller_price,
                            'min_selling_price'   => $item->min_selling_price,
                            'max_selling_price'   => $item->max_selling_price,
                            'incentive_amount'    => $item->incentive_amount,
                            'location'            => $item->location,
                        ];
                        $remaining -= $take;
                        $totalQty += $take;
                    }

                    if ($remaining > 0) {
                        throw new \RuntimeException('Insufficient stock available at the source shop for this quantity/configuration.');
                    }
                }

                // Keep the background Inventory counter in sync too — other
                // screens (stock-levels, product master list) still read it.
                Inventory::removeStock($fromShopId, $productId, $totalQty);

                $transfer = StockTransfer::create([
                    'from_shop_id'      => $fromShopId,
                    'to_shop_id'        => $validated['to_shop_id'],
                    'product_id'        => $productId,
                    'imei'              => implode(',', $imeiList),
                    'quantity'          => $totalQty,
                    'status'            => 'PENDING',
                    'initiated_by'      => $user->id,
                    'transfer_date'     => $validated['transfer_date'],
                    'notes'             => $validated['notes'] ?? null,
                    'source_breakdown'  => $breakdown,
                ]);

                $product = Product::find($productId);
                $transfer->load(['fromShop', 'toShop']);

                ActivityLog::log('STOCK_TRANSFER_INITIATED', $transfer,
                    "Transfer initiated: {$totalQty} x {$product?->name} from {$transfer->fromShop->name} to {$transfer->toShop->name}"
                );

                $this->notifyOwner(
                    "🚚 *Stock Transfer Sent*\nProduct: {$product?->name}" . ($transfer->imei ? "\nIMEI: {$transfer->imei}" : '') .
                    "\nQty: {$totalQty}" .
                    "\nFrom: {$transfer->fromShop->name} → To: {$transfer->toShop->name}" .
                    "\nBy: {$user->name}"
                );

                return response()->json($transfer, 201);
            });
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    /**
     * Confirm receipt at the destination shop: clones each source batch's
     * exact metadata (price/config/IMEI) into a brand-new purchase_item row
     * tagged to the destination shop, but keeps `purchase_invoice_id`
     * pointing at the ORIGINAL purchase invoice — so the purchase/GST/
     * supplier-ledger report at the buying shop is completely unaffected;
     * only the "currently at" location moves.
     */
    public function receive(Request $request, StockTransfer $stockTransfer)
    {
        $user = $request->user();

        if (!$user->hasFullAccess() && $stockTransfer->to_shop_id !== $user->shop_id) {
            return response()->json(['message' => 'You can only receive transfers sent to your own shop.'], 403);
        }
        if ($stockTransfer->status !== 'PENDING') {
            return response()->json(['message' => 'This transfer is not pending.'], 422);
        }

        return DB::transaction(function () use ($stockTransfer, $user) {
            foreach ($stockTransfer->source_breakdown ?? [] as $entry) {
                PurchaseItem::create([
                    'purchase_invoice_id' => $entry['purchase_invoice_id'],
                    'product_id'          => $stockTransfer->product_id,
                    'current_shop_id'     => $stockTransfer->to_shop_id,
                    'imei'                => $entry['imei'] ?? null,
                    'ram'                 => $entry['ram'] ?? null,
                    'storage'             => $entry['storage'] ?? null,
                    'color'               => $entry['color'] ?? null,
                    'quantity'            => $entry['qty'],
                    'received_quantity'   => $entry['qty'],
                    'damaged_quantity'    => 0,
                    'unit_price'          => $entry['unit_price'],
                    'selling_price'       => $entry['selling_price'],
                    'wholeseller_price'   => $entry['wholeseller_price'],
                    'min_selling_price'   => $entry['min_selling_price'],
                    'max_selling_price'   => $entry['max_selling_price'],
                    'incentive_amount'    => $entry['incentive_amount'],
                    'total'               => (float) $entry['unit_price'] * (int) $entry['qty'],
                    'location'            => $entry['location'] ?? null,
                ]);
            }

            Inventory::addStock($stockTransfer->to_shop_id, $stockTransfer->product_id, $stockTransfer->quantity);

            $stockTransfer->update([
                'status'      => 'RECEIVED',
                'received_by' => $user->id,
                'received_at' => now(),
            ]);

            $stockTransfer->load(['fromShop', 'toShop', 'product']);

            ActivityLog::log('STOCK_TRANSFER_RECEIVED', $stockTransfer,
                "Transfer received: {$stockTransfer->quantity} x {$stockTransfer->product?->name} at {$stockTransfer->toShop->name}"
            );

            $this->notifyOwner(
                "✅ *Stock Transfer Received*\nProduct: {$stockTransfer->product?->name}" .
                "\nQty: {$stockTransfer->quantity}" .
                "\nFrom: {$stockTransfer->fromShop->name} → To: {$stockTransfer->toShop->name}" .
                "\nBy: {$user->name}"
            );

            return response()->json($stockTransfer);
        });
    }

    /**
     * Cancel a still-PENDING transfer: restores each decremented source row
     * (adds the IMEI back / restores the quantity) exactly as it was.
     */
    public function cancel(Request $request, StockTransfer $stockTransfer)
    {
        $user = $request->user();

        if (!$user->hasFullAccess() && $stockTransfer->from_shop_id !== $user->shop_id) {
            return response()->json(['message' => 'You can only cancel transfers you sent from your own shop.'], 403);
        }
        if ($stockTransfer->status !== 'PENDING') {
            return response()->json(['message' => 'This transfer is not pending.'], 422);
        }

        return DB::transaction(function () use ($stockTransfer, $user) {
            foreach ($stockTransfer->source_breakdown ?? [] as $entry) {
                $item = PurchaseItem::find($entry['purchase_item_id']);
                if (!$item) {
                    continue;
                }
                if (!empty($entry['imei'])) {
                    $list = array_values(array_filter(array_map('trim', explode(',', (string) $item->imei))));
                    $list[] = $entry['imei'];
                    $item->imei = implode(',', $list);
                    $item->quantity += 1;
                    $item->received_quantity += 1;
                } else {
                    $item->quantity += $entry['qty'];
                    $item->received_quantity += $entry['qty'];
                }
                $item->save();
            }

            Inventory::addStock($stockTransfer->from_shop_id, $stockTransfer->product_id, $stockTransfer->quantity);

            $stockTransfer->update(['status' => 'CANCELLED']);
            $stockTransfer->load(['fromShop', 'toShop', 'product']);

            ActivityLog::log('STOCK_TRANSFER_CANCELLED', $stockTransfer,
                "Transfer cancelled: {$stockTransfer->quantity} x {$stockTransfer->product?->name} from {$stockTransfer->fromShop->name} to {$stockTransfer->toShop->name}"
            );

            return response()->json($stockTransfer);
        });
    }
}
