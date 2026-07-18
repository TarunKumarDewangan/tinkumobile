<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SaleInvoice;
use App\Models\SaleItem;
use App\Models\PurchaseInvoice;
use App\Models\Inventory;
use App\Models\EmployeeIncentive;
use App\Models\RepairRequest;
use App\Models\FollowUp;
use App\Models\LoanPayment;
use App\Models\GiftInventory;
use App\Models\SaleInvoice as SaleInvoiceAlias;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
    private function shopFilter(Request $request)
    {
        $user = $request->user();
        return $user->hasFullAccess() ? $request->shop_id : $user->shop_id;
    }

    /** 1. Sales Summary */
    public function sales(Request $request)
    {
        $shopId = $this->shopFilter($request);
        $query = SaleInvoice::with('customer', 'user')
            ->where('is_cancelled', false);
        if ($shopId) $query->where('shop_id', $shopId);
        if ($request->from) $query->where('sale_date', '>=', $request->from);
        if ($request->to) $query->where('sale_date', '<=', $request->to);
        if ($request->bill_type) $query->where('bill_type', $request->bill_type);
        if ($request->staff_id) $query->where('user_id', $request->staff_id);
        return response()->json($query->latest('sale_date')->get());
    }

    /** 2. Profit Report — Invoice Level (discounts accounted for) */
    public function profit(Request $request)
    {
        $shopId = $this->shopFilter($request);

        $query = SaleInvoice::with('customer', 'items.product')
            ->where('is_cancelled', false)
            ->whereNull('deleted_at');

        if ($shopId)         $query->where('shop_id', $shopId);
        if ($request->from)  $query->where('sale_date', '>=', $request->from);
        if ($request->to)    $query->where('sale_date', '<=', $request->to);

        $rows = $query->latest('sale_date')->get()->map(function ($inv) {
            $totalItemCost = $inv->items->sum(fn($item) =>
                ($item->quantity ?? 0) * (($item->product->purchase_price ?? 0))
            );

            $discountGiven = (float)($inv->discount ?? 0)
                + ($inv->is_cash_discount_on_bill ? (float)($inv->cash_discount ?? 0) : 0);

            $revenueExclTax = (float)$inv->total_amount;
            $profit      = $revenueExclTax - $discountGiven - $totalItemCost;
            $margin      = $revenueExclTax > 0 ? round(($profit / $revenueExclTax) * 100, 2) : 0;

            return [
                'invoice_no'      => $inv->invoice_no,
                'sale_date'       => $inv->sale_date,
                'customer_name'   => $inv->customer?->name ?? '—',
                'grand_total'     => (float) $inv->grand_total,
                'total_item_cost' => round($totalItemCost, 2),
                'discount_given'  => round($discountGiven, 2),
                'profit'          => round($profit, 2),
                'margin_pct'      => $margin,
            ];
        });

        return response()->json($rows);
    }

    /** 3. Stock Levels */
    public function stock(Request $request)
    {
        $shopId = $this->shopFilter($request);
        $query = Inventory::with('product.category', 'shop')
            ->whereHas('product', function ($q) {
                $q->whereNull('deleted_at');
            });
        if ($shopId) $query->where('shop_id', $shopId);
        if ($request->low_stock) $query->where('stock', '<=', intval($request->low_stock));
        return response()->json($query->get());
    }

    /** 4. Employee Incentives */
    public function incentives(Request $request)
    {
        $query = EmployeeIncentive::with('user', 'product', 'saleItem.invoice');
        if ($request->user_id) $query->where('user_id', $request->user_id);
        if ($request->paid_status !== null) $query->where('paid_status', (bool)$request->paid_status);
        if ($request->from) $query->whereDate('created_at', '>=', $request->from);
        if ($request->to) $query->whereDate('created_at', '<=', $request->to);
        return response()->json($query->latest()->get());
    }

    /** 5. Repair Delivery Report */
    public function repairs(Request $request)
    {
        $shopId = $this->shopFilter($request);
        $query = RepairRequest::query();
        if ($shopId) $query->where('shop_id', $shopId);
        if ($request->status) $query->where('status', $request->status);
        return response()->json($query->get()->map(function ($r) {
            $r->delay_days = null;
            if ($r->estimated_delivery_date && ! $r->actual_delivery_date) {
                $r->delay_days = max(0, now()->diffInDays($r->estimated_delivery_date, false) * -1);
            }
            return $r;
        }));
    }

    /** 6. Follow-up List */
    public function followups(Request $request)
    {
        $query = FollowUp::with('customer');
        if ($request->date) $query->where('follow_up_date', $request->date);
        if ($request->status) $query->where('status', $request->status);
        return response()->json($query->orderBy('follow_up_date')->get());
    }

    /** 7. Loan Outstanding */
    public function loans(Request $request)
    {
        $query = LoanPayment::with('loan.customer')
            ->where('status', 'pending');
        if ($request->customer_id) $query->whereHas('loan', fn($q) => $q->where('customer_id', $request->customer_id));
        return response()->json($query->orderBy('due_date')->get());
    }

    /** 8. Gift Stock Report */
    public function giftStock(Request $request)
    {
        $shopId = $this->shopFilter($request);
        $query = GiftInventory::with('giftProduct', 'shop');
        if ($shopId) $query->where('shop_id', $shopId);
        return response()->json($query->get());
    }

    /** 9. Kaccha vs Pakka */
    public function billConversion(Request $request)
    {
        $shopId = $this->shopFilter($request);
        $query = SaleInvoice::where('is_cancelled', false);
        if ($shopId) $query->where('shop_id', $shopId);
        if ($request->from) $query->where('sale_date', '>=', $request->from);
        if ($request->to) $query->where('sale_date', '<=', $request->to);

        $kaccha = (clone $query)->where('bill_type', 'kaccha')->count();
        $pakka  = (clone $query)->where('bill_type', 'pakka')->count();
        $total  = $kaccha + $pakka;

        return response()->json([
            'total_kaccha'      => $kaccha,
            'total_pakka'       => $pakka,
            'total'             => $total,
            'conversion_rate'   => $total > 0 ? round(($pakka / $total) * 100, 2) : 0,
        ]);
    }

    /** 10. Dashboard Summary (for owner/manager home page) */
    public function dashboard(Request $request)
    {
        $shopId = $this->shopFilter($request);
        $today  = now()->toDateString();

        $salesQ = SaleInvoice::where('sale_date', $today)->where('is_cancelled', false);
        if ($shopId) $salesQ->where('shop_id', $shopId);

        $inventoryQ = Inventory::query();
        if ($shopId) $inventoryQ->where('shop_id', $shopId);

        return response()->json([
            'today_sales'          => (clone $salesQ)->count(),
            'today_revenue'        => (clone $salesQ)->sum('grand_total'),
            'low_stock_items'      => $inventoryQ->where('stock', '<=', 5)->count(),
            'pending_repairs'      => RepairRequest::where('status', 'pending')->when($shopId, fn($q, $s) => $q->where('shop_id', $s))->count(),
            'pending_followups'    => FollowUp::where('follow_up_date', $today)->where('status', 'pending')->count(),
            'overdue_repairs'      => RepairRequest::whereNotNull('estimated_delivery_date')->whereNull('actual_delivery_date')->where('estimated_delivery_date', '<', $today)->when($shopId, fn($q, $s) => $q->where('shop_id', $s))->count(),
        ]);
    }

    /** 11. Combined Sales and Stocks Report */
    public function combinedSalesReport(Request $request)
    {
        $shopId = $this->shopFilter($request);

        $newCatId = \App\Models\Category::mobileNewId();
        $oldCatId = \App\Models\Category::mobileOldId();
        $catIds   = array_values(array_filter([$newCatId, $oldCatId]));

        /**
         * Build the list of "groups" to process:
         *   - type=brand   → real brand row (aggregates all products of that brand)
         *   - type=product → individual row for an unbranded product (uses product name as label)
         */
        $groups = [];

        if ($request->has('brand_id') && $request->brand_id !== '') {
            if ($request->brand_id === 'none' || $request->brand_id === 'null') {
                // Show unbranded products individually
                if (!empty($catIds)) {
                    foreach (\App\Models\Product::whereNull('brand_id')->whereIn('category_id', $catIds)->get() as $p) {
                        $groups[] = ['type' => 'product', 'product' => $p];
                    }
                }
            } else {
                $brand = \App\Models\Brand::find($request->brand_id);
                if ($brand) {
                    $groups[] = ['type' => 'brand', 'brand_id' => $brand->id, 'brand_name' => $brand->name];
                }
            }
        } else {
            // All real brands
            foreach (\App\Models\Brand::all() as $brand) {
                $groups[] = ['type' => 'brand', 'brand_id' => $brand->id, 'brand_name' => $brand->name];
            }
            // Each unbranded mobile product becomes its own row
            if (!empty($catIds)) {
                foreach (\App\Models\Product::whereNull('brand_id')->whereIn('category_id', $catIds)->get() as $p) {
                    $groups[] = ['type' => 'product', 'product' => $p];
                }
            }
        }

        // Pre-aggregate sold quantity and stock PER PRODUCT in two grouped queries
        // total, instead of the 2-4 queries per brand/product this used to run in
        // the loop below (previously ~300 queries for a typical brand/product count).
        $soldByProduct = SaleItem::query()
            ->join('sale_invoices', 'sale_invoices.id', '=', 'sale_items.sale_invoice_id')
            ->where('sale_invoices.is_cancelled', false)
            ->whereNull('sale_invoices.deleted_at') // SaleInvoice uses SoftDeletes; whereHas() applied this implicitly, a raw join does not
            ->when($shopId, fn($q) => $q->where('sale_invoices.shop_id', $shopId))
            ->when($request->from, fn($q) => $q->where('sale_invoices.sale_date', '>=', $request->from))
            ->when($request->to, fn($q) => $q->where('sale_invoices.sale_date', '<=', $request->to))
            ->groupBy('sale_items.product_id')
            ->select('sale_items.product_id', DB::raw('SUM(sale_items.quantity) as qty'))
            ->get()
            ->pluck('qty', 'product_id');

        $stockByProduct = Inventory::query()
            ->when($shopId, fn($q) => $q->where('shop_id', $shopId))
            ->groupBy('product_id')
            ->select('product_id', DB::raw('SUM(stock) as qty'))
            ->get()
            ->pluck('qty', 'product_id');

        $soldFor  = fn($productId) => (int) ($soldByProduct[$productId] ?? 0);
        $stockFor = fn($productId) => (int) ($stockByProduct[$productId] ?? 0);

        $reportData = [];

        foreach ($groups as $group) {

            /* ── Individual unbranded product row ── */
            if ($group['type'] === 'product') {
                $product = $group['product'];
                $isOld   = ($oldCatId && $product->category_id == $oldCatId);

                $sold  = $soldFor($product->id);
                $stock = $stockFor($product->id);

                if ($sold === 0 && $stock === 0) continue;

                $reportData[] = [
                    'brand_id'    => 'product_' . $product->id,
                    'brand_name'  => $product->name,          // full product name as label
                    'new_sold'    => $isOld ? 0 : $sold,
                    'old_sold'    => $isOld ? $sold : 0,
                    'total_sold'  => $sold,
                    'new_stock'   => $isOld ? 0 : $stock,
                    'old_stock'   => $isOld ? $stock : 0,
                    'total_stock' => $stock,
                    'products'    => [[
                        'product_id'   => $product->id,
                        'product_name' => $product->name,
                        'type'         => $isOld ? 'Second Hand' : 'New',
                        'sold'         => $sold,
                        'stock'        => $stock,
                    ]],
                ];
                continue;
            }

            /* ── Real brand row (aggregated) ── */
            $brandId   = $group['brand_id'];
            $brandName = $group['brand_name'];

            $newSold = $oldSold = $newStock = $oldStock = 0;
            $productsData = [];

            foreach (\App\Models\Product::where('brand_id', $brandId)->whereIn('category_id', $catIds)->get() as $product) {
                $sold  = $soldFor($product->id);
                $stock = $stockFor($product->id);
                $isOld = ($oldCatId && $product->category_id == $oldCatId);

                if ($isOld) { $oldSold += $sold; $oldStock += $stock; }
                else        { $newSold += $sold; $newStock += $stock; }

                if ($sold > 0) {
                    $productsData[] = [
                        'product_id'   => $product->id,
                        'product_name' => $product->name,
                        'type'         => $isOld ? 'Second Hand' : 'New',
                        'sold'         => $sold,
                        'stock'        => $stock,
                    ];
                }
            }

            if ($newSold === 0 && $oldSold === 0 && $newStock === 0 && $oldStock === 0) continue;

            usort($productsData, fn($a, $b) => $b['sold'] === $a['sold'] ? strcmp($a['product_name'], $b['product_name']) : $b['sold'] <=> $a['sold']);

            $reportData[] = [
                'brand_id'    => $brandId,
                'brand_name'  => $brandName,
                'new_sold'    => $newSold,
                'old_sold'    => $oldSold,
                'total_sold'  => $newSold + $oldSold,
                'new_stock'   => $newStock,
                'old_stock'   => $oldStock,
                'total_stock' => $newStock + $oldStock,
                'products'    => $productsData,
            ];
        }

        // Sort: most sold first, then alphabetical
        usort($reportData, fn($a, $b) => $b['total_sold'] === $a['total_sold']
            ? strcmp($a['brand_name'], $b['brand_name'])
            : $b['total_sold'] <=> $a['total_sold']);

        return response()->json($reportData);
    }

    /** 12. Set Sales Matrix Report (Daily Grid) */
    public function setSalesMatrix(Request $request)
    {
        $catIds = array_values(array_filter([\App\Models\Category::mobileNewId(), \App\Models\Category::mobileOldId()]));

        if (empty($catIds)) {
            return response()->json([
                'dates' => [],
                'products' => [],
                'grand_total' => 0
            ]);
        }

        if ($request->filled('month')) {
            $start = \Carbon\Carbon::parse($request->month)->startOfMonth();
            $end = \Carbon\Carbon::parse($request->month)->endOfMonth();
        } elseif ($request->filled('from') && $request->filled('to')) {
            $start = \Carbon\Carbon::parse($request->from);
            $end = \Carbon\Carbon::parse($request->to);
        } else {
            $start = \Carbon\Carbon::now()->startOfMonth();
            $end = \Carbon\Carbon::now()->endOfMonth();
        }

        if ($start->diffInDays($end) > 366) {
            $end = (clone $start)->addDays(366);
        }

        $dates = [];
        $temp = clone $start;
        while ($temp->lte($end)) {
            $dates[] = $temp->toDateString();
            $temp->addDay();
        }

        $shopId = $this->shopFilter($request);

        // MOP (the actual ₹ a set sold for) must come from the real sale line
        // (sale_items.total) — the product's own products.selling_price is a
        // single, mutable master-data field that's the same for every sale
        // regardless of what it actually sold for, so using it here flattened
        // every real, differently-priced/discounted sale to one static number.
        $salesQuery = SaleItem::select('sale_items.product_id', 'products.name as product_name', 'sale_invoices.sale_date',
                DB::raw('SUM(sale_items.quantity) as total_qty'),
                DB::raw('SUM(sale_items.total) as day_amount')
            )
            ->join('sale_invoices', 'sale_items.sale_invoice_id', '=', 'sale_invoices.id')
            ->join('products', 'sale_items.product_id', '=', 'products.id')
            ->whereIn('products.category_id', $catIds)
            ->where('sale_invoices.is_cancelled', false)
            ->whereNull('sale_invoices.deleted_at')
            ->whereNull('products.deleted_at')
            ->whereBetween('sale_invoices.sale_date', [$start->toDateString(), $end->toDateString()]);

        if ($shopId) {
            $salesQuery->where('sale_invoices.shop_id', $shopId);
        }

        if ($request->filled('search')) {
            $searchTerm = '%' . $request->search . '%';
            $salesQuery->where('products.name', 'like', $searchTerm);
        }

        $salesData = $salesQuery->groupBy('sale_items.product_id', 'products.name', 'sale_invoices.sale_date')
            ->get();

        $products = [];
        $grandTotal = 0;
        $grandMopTotal = 0;
        foreach ($salesData as $row) {
            $pid = $row->product_id;
            $amount = (float) ($row->day_amount ?? 0);
            if (!isset($products[$pid])) {
                $products[$pid] = [
                    'product_id' => $pid,
                    'product_name' => $row->product_name,
                    'sales' => [],
                    'mop_sales' => [],
                    'total_sold' => 0,
                    'total_mop' => 0
                ];
            }
            $qty = (int) $row->total_qty;
            $products[$pid]['sales'][$row->sale_date] = $qty;
            $products[$pid]['mop_sales'][$row->sale_date] = $amount;
            $products[$pid]['total_sold'] += $qty;
            $products[$pid]['total_mop'] += $amount;
            $grandTotal += $qty;
            $grandMopTotal += $amount;
        }

        usort($products, fn($a, $b) => strcasecmp($a['product_name'], $b['product_name']));

        return response()->json([
            'dates' => $dates,
            'products' => array_values($products),
            'grand_total' => $grandTotal,
            'grand_mop_total' => $grandMopTotal
        ]);
    }

    /** Financer Report — all financed sales with drill-down */
    public function financerReport(Request $request)
    {
        $shopId = $this->shopFilter($request);

        $query = SaleInvoice::with('customer', 'items.product.category', 'financer', 'shop', 'user')
            ->where('is_cancelled', false)
            ->where('finance_amount', '>', 0)
            ->whereNotNull('financer_id');

        if ($shopId)               $query->where('shop_id', $shopId);
        if ($request->from)        $query->where('sale_date', '>=', $request->from);
        if ($request->to)          $query->where('sale_date', '<=', $request->to);
        if ($request->financer_id) $query->where('financer_id', $request->financer_id);
        if ($request->bill_type)   $query->where('bill_type', $request->bill_type);
        if ($request->finance_status) $query->where('finance_payment_status', $request->finance_status);

        if ($request->sale_type) {
            $type = $request->sale_type;
            if ($type === 'new') {
                $query->whereHas('items.product.category', fn($q) => $q->whereIn('slug', ['MOBILE-NEW', 'mobile-new']));
            } elseif ($type === 'old') {
                $query->whereHas('items.product.category', fn($q) => $q->whereIn('slug', ['MOBILE-OLD', 'mobile-old']));
            } elseif ($type === 'other') {
                $query->whereHas('items.product.category', fn($q) =>
                    $q->whereNotIn('slug', ['MOBILE-NEW', 'mobile-new', 'MOBILE-OLD', 'mobile-old'])
                );
            }
        }

        $invoices = $query->latest('sale_date')->get();

        // Per-invoice: determine sale type label from items
        $rows = $invoices->map(function ($inv) {
            $saleType = 'Other';
            foreach ($inv->items as $item) {
                $slug = strtolower($item->product?->category?->slug ?? '');
                if (str_contains($slug, 'mobile-new')) { $saleType = 'New Mobile'; break; }
                if (str_contains($slug, 'mobile-old')) { $saleType = '2nd Hand'; break; }
            }
            $firstItem  = $inv->items->first();
            $productName = $firstItem?->product?->name ?? '—';
            $specs = implode(' / ', array_filter([$firstItem?->ram, $firstItem?->storage, $firstItem?->color]));
            $imei  = $firstItem?->imei ? explode(',', $firstItem->imei)[0] : null;
            return [
                'id'                     => $inv->id,
                'invoice_no'             => $inv->invoice_no,
                'sale_date'              => $inv->sale_date,
                'bill_type'              => $inv->bill_type,
                'sale_type'              => $saleType,
                'customer_name'          => $inv->customer?->name ?? '—',
                'customer_phone'         => $inv->customer?->phone ?? '',
                'product_name'           => $productName,
                'specs'                  => $specs,
                'imei'                   => $imei,
                'grand_total'            => $inv->grand_total,
                'down_payment'           => $inv->down_payment,
                'finance_amount'         => $inv->finance_amount,
                'finance_payment_status' => $inv->finance_payment_status,
                'financer_id'            => $inv->financer_id,
                'financer_name'          => $inv->financer?->name ?? 'Unknown',
                'shop_name'              => $inv->shop?->name ?? '—',
                'staff_name'             => $inv->user?->name ?? '—',
            ];
        });

        // Summary by financer
        $byFinancer = $rows->groupBy('financer_id')->map(function ($group, $fId) {
            return [
                'financer_id'     => $fId,
                'financer_name'   => $group->first()['financer_name'],
                'count'           => $group->count(),
                'total_financed'  => $group->sum('finance_amount'),
                'total_received'  => $group->where('finance_payment_status', 'RECEIVED')->sum('finance_amount'),
                'total_pending'   => $group->where('finance_payment_status', 'PENDING')->sum('finance_amount'),
            ];
        })->values();

        // All distinct financers (for filter dropdown — all financed invoices regardless of current filters)
        $allFinancers = SaleInvoice::with('financer')
            ->where('is_cancelled', false)
            ->where('finance_amount', '>', 0)
            ->whereNotNull('financer_id')
            ->when($shopId, fn($q) => $q->where('shop_id', $shopId))
            ->select('financer_id')
            ->distinct()
            ->get()
            ->map(fn($inv) => ['id' => $inv->financer_id, 'name' => $inv->financer?->name ?? 'Unknown'])
            ->unique('id')
            ->values();

        return response()->json([
            'invoices'     => $rows,
            'by_financer'  => $byFinancer,
            'financers'    => $allFinancers,
            'summary' => [
                'total_sales'    => $rows->count(),
                'total_financed' => $rows->sum('finance_amount'),
                'total_received' => $rows->where('finance_payment_status', 'RECEIVED')->sum('finance_amount'),
                'total_pending'  => $rows->where('finance_payment_status', 'PENDING')->sum('finance_amount'),
            ],
        ]);
    }

    /**
     * 14. Old Mobile Purchase / Exchange Report.
     *
     * Note on "credit used / pending": there is no direct database link
     * between a specific old-mobile trade-in and the specific later sale it
     * paid for — exchange credit is tracked only as an aggregate per-customer
     * ledger balance (old_mobile_purchases.purchase_price when is_exchange,
     * vs sale_invoices.exchange_paid on later sales). This report computes
     * that aggregate per customer and lists their exchange-funded sales
     * as a best-effort match, not a guaranteed one-to-one link.
     */
    public function oldMobileExchangeReport(Request $request)
    {
        $shopId = $this->shopFilter($request);

        $query = \App\Models\OldMobilePurchase::with('customer', 'user', 'shop');
        if ($shopId) $query->where('shop_id', $shopId);
        if ($request->from) $query->where('purchase_date', '>=', $request->from);
        if ($request->to)   $query->where('purchase_date', '<=', $request->to);
        if ($request->type === 'exchange') $query->where('is_exchange', true);
        elseif ($request->type === 'cash') $query->where('is_exchange', false);
        if ($request->search) {
            $s = $request->search;
            $query->where(function ($q) use ($s) {
                $q->where('model_name', 'like', "%$s%")
                  ->orWhere('imei', 'like', "%$s%")
                  ->orWhereHas('customer', fn($cq) => $cq->where('name', 'like', "%$s%")->orWhere('phone', 'like', "%$s%"));
            });
        }

        $purchases   = $query->latest('purchase_date')->get();
        $customerIds = $purchases->pluck('customer_id')->filter()->unique()->values();

        // All-time (not date-filtered) aggregates — credit is a running
        // balance, not scoped to whatever date range is currently displayed.
        $creditGivenByCustomer = \App\Models\OldMobilePurchase::whereIn('customer_id', $customerIds)
            ->where('is_exchange', true)
            ->when($shopId, fn($q) => $q->where('shop_id', $shopId))
            ->groupBy('customer_id')
            ->selectRaw('customer_id, SUM(purchase_price) as total')
            ->pluck('total', 'customer_id');

        $creditUsedByCustomer = SaleInvoice::whereIn('customer_id', $customerIds)
            ->where('is_cancelled', false)
            ->where('exchange_paid', '>', 0)
            ->when($shopId, fn($q) => $q->where('shop_id', $shopId))
            ->groupBy('customer_id')
            ->selectRaw('customer_id, SUM(exchange_paid) as total')
            ->pluck('total', 'customer_id');

        // The actual sale invoices where exchange credit was applied — the
        // best-effort "what did they buy with it" list per customer.
        $fundedSales = SaleInvoice::with('items.product')
            ->whereIn('customer_id', $customerIds)
            ->where('is_cancelled', false)
            ->where('exchange_paid', '>', 0)
            ->when($shopId, fn($q) => $q->where('shop_id', $shopId))
            ->orderBy('sale_date')
            ->get()
            ->groupBy('customer_id');

        $rows = $purchases->map(function ($p) use ($creditGivenByCustomer, $creditUsedByCustomer, $fundedSales) {
            $given   = (float) ($creditGivenByCustomer[$p->customer_id] ?? 0);
            $used    = (float) ($creditUsedByCustomer[$p->customer_id] ?? 0);
            $pending = max(0, $given - $used);

            $funded = $p->is_exchange
                ? ($fundedSales[$p->customer_id] ?? collect())->map(fn($inv) => [
                    'invoice_id'   => $inv->id,
                    'invoice_no'   => $inv->invoice_no,
                    'sale_date'    => $inv->sale_date,
                    'product_name' => $inv->items->first()?->product?->name ?? '—',
                    'grand_total'  => (float) $inv->grand_total,
                    'credit_used'  => (float) $inv->exchange_paid,
                ])->values()
                : collect();

            return [
                'id'               => $p->id,
                'purchase_date'    => $p->purchase_date,
                'customer_id'      => $p->customer_id,
                'customer_name'    => $p->customer?->name ?? '—',
                'customer_phone'   => $p->customer?->phone ?? '',
                'model_name'       => $p->model_name,
                'imei'             => $p->imei,
                'specs'            => implode(' / ', array_filter([$p->ram, $p->storage, $p->color])),
                'condition_note'   => $p->condition_note,
                'purchase_price'   => (float) $p->purchase_price,
                'selling_price'    => (float) $p->selling_price,
                'is_exchange'      => (bool) $p->is_exchange,
                'shop_name'        => $p->shop?->name ?? '—',
                'staff_name'       => $p->user?->name ?? '—',
                'credit_given'     => $p->is_exchange ? $given : null,
                'credit_used'      => $p->is_exchange ? $used : null,
                'credit_pending'   => $p->is_exchange ? $pending : null,
                'funded_purchases' => $funded,
            ];
        });

        if ($request->credit_status === 'pending') {
            $rows = $rows->filter(fn($r) => $r['is_exchange'] && $r['credit_pending'] > 0)->values();
        } elseif ($request->credit_status === 'used') {
            $rows = $rows->filter(fn($r) => $r['is_exchange'] && $r['credit_pending'] <= 0)->values();
        }

        $exchangeRows = $rows->where('is_exchange', true);
        $cashRows     = $rows->where('is_exchange', false);

        $totalCreditPending = 0;
        foreach ($creditGivenByCustomer as $custId => $given) {
            $totalCreditPending += max(0, (float) $given - (float) ($creditUsedByCustomer[$custId] ?? 0));
        }

        return response()->json([
            'rows' => $rows->values(),
            'summary' => [
                'total_count'          => $rows->count(),
                'exchange_count'       => $exchangeRows->count(),
                'cash_count'           => $cashRows->count(),
                'total_exchange_value' => $exchangeRows->sum('purchase_price'),
                'total_cash_value'     => $cashRows->sum('purchase_price'),
                'total_credit_pending' => $totalCreditPending,
            ],
        ]);
    }
}

