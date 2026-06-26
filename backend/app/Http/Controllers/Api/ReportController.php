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

            $grandTotal  = (float)$inv->grand_total;
            $profit      = $grandTotal - $totalItemCost;
            $margin      = $grandTotal > 0 ? round(($profit / $grandTotal) * 100, 2) : 0;

            return [
                'invoice_no'      => $inv->invoice_no,
                'sale_date'       => $inv->sale_date,
                'customer_name'   => $inv->customer?->name ?? '—',
                'grand_total'     => $grandTotal,
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

        $newCat = \App\Models\Category::whereIn('slug', ['MOBILE-NEW', 'mobile-new'])->first();
        $oldCat = \App\Models\Category::whereIn('slug', ['MOBILE-OLD', 'mobile-old'])->first();

        $newCatId = $newCat ? $newCat->id : null;
        $oldCatId = $oldCat ? $oldCat->id : null;
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

        // Helper closure: invoice filter
        $invoiceFilter = function ($q) use ($shopId, $request) {
            $q->where('is_cancelled', false);
            if ($shopId)        $q->where('shop_id', $shopId);
            if ($request->from) $q->where('sale_date', '>=', $request->from);
            if ($request->to)   $q->where('sale_date', '<=', $request->to);
        };

        $reportData = [];

        foreach ($groups as $group) {

            /* ── Individual unbranded product row ── */
            if ($group['type'] === 'product') {
                $product = $group['product'];
                $isOld   = ($oldCatId && $product->category_id == $oldCatId);

                $sold  = (int) SaleItem::where('product_id', $product->id)
                    ->whereHas('invoice', $invoiceFilter)
                    ->sum('quantity');

                $stock = (int) Inventory::where('product_id', $product->id)
                    ->when($shopId, fn($q) => $q->where('shop_id', $shopId))
                    ->sum('stock');

                if ($sold === 0) continue;

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

            $newSold = (int) SaleItem::whereHas('product', function ($q) use ($brandId, $newCatId) {
                $q->where('brand_id', $brandId);
                if ($newCatId) $q->where('category_id', $newCatId);
            })->whereHas('invoice', $invoiceFilter)->sum('quantity');

            $oldSold = (int) SaleItem::whereHas('product', function ($q) use ($brandId, $oldCatId) {
                $q->where('brand_id', $brandId);
                if ($oldCatId) $q->where('category_id', $oldCatId);
            })->whereHas('invoice', $invoiceFilter)->sum('quantity');

            $newStock = (int) Inventory::whereHas('product', function ($q) use ($brandId, $newCatId) {
                $q->where('brand_id', $brandId);
                if ($newCatId) $q->where('category_id', $newCatId);
            })->when($shopId, fn($q) => $q->where('shop_id', $shopId))->sum('stock');

            $oldStock = (int) Inventory::whereHas('product', function ($q) use ($brandId, $oldCatId) {
                $q->where('brand_id', $brandId);
                if ($oldCatId) $q->where('category_id', $oldCatId);
            })->when($shopId, fn($q) => $q->where('shop_id', $shopId))->sum('stock');

            if ($newSold === 0 && $oldSold === 0) continue;

            // Per-product breakdown for this brand
            $productsData = [];
            foreach (\App\Models\Product::where('brand_id', $brandId)->whereIn('category_id', $catIds)->get() as $product) {
                $sold  = (int) SaleItem::where('product_id', $product->id)->whereHas('invoice', $invoiceFilter)->sum('quantity');
                $stock = (int) Inventory::where('product_id', $product->id)->when($shopId, fn($q) => $q->where('shop_id', $shopId))->sum('stock');
                if ($sold > 0) {
                    $isOld = ($oldCatId && $product->category_id == $oldCatId);
                    $productsData[] = [
                        'product_id'   => $product->id,
                        'product_name' => $product->name,
                        'type'         => $isOld ? 'Second Hand' : 'New',
                        'sold'         => $sold,
                        'stock'        => $stock,
                    ];
                }
            }
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
        $newCat = \App\Models\Category::whereIn('slug', ['MOBILE-NEW', 'mobile-new'])->first();
        $oldCat = \App\Models\Category::whereIn('slug', ['MOBILE-OLD', 'mobile-old'])->first();
        $catIds = array_values(array_filter([$newCat?->id, $oldCat?->id]));

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

        $salesQuery = SaleItem::select('sale_items.product_id', 'products.name as product_name', 'products.selling_price as mop_price', 'sale_invoices.sale_date', DB::raw('SUM(sale_items.quantity) as total_qty'))
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

        $salesData = $salesQuery->groupBy('sale_items.product_id', 'products.name', 'products.selling_price', 'sale_invoices.sale_date')
            ->get();

        $products = [];
        $grandTotal = 0;
        $grandMopTotal = 0;
        foreach ($salesData as $row) {
            $pid = $row->product_id;
            $mopPrice = (float) ($row->mop_price ?? 0);
            if (!isset($products[$pid])) {
                $products[$pid] = [
                    'product_id' => $pid,
                    'product_name' => $row->product_name,
                    'mop_price' => $mopPrice,
                    'sales' => [],
                    'total_sold' => 0,
                    'total_mop' => 0
                ];
            }
            $qty = (int) $row->total_qty;
            $products[$pid]['sales'][$row->sale_date] = $qty;
            $products[$pid]['total_sold'] += $qty;
            $products[$pid]['total_mop'] += ($qty * $mopPrice);
            $grandTotal += $qty;
            $grandMopTotal += ($qty * $mopPrice);
        }

        usort($products, fn($a, $b) => strcasecmp($a['product_name'], $b['product_name']));

        return response()->json([
            'dates' => $dates,
            'products' => array_values($products),
            'grand_total' => $grandTotal,
            'grand_mop_total' => $grandMopTotal
        ]);
    }
}

