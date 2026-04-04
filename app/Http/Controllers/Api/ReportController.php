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

    /** 2. Profit Report */
    public function profit(Request $request)
    {
        $shopId = $this->shopFilter($request);
        $query = SaleItem::select(
                'sale_items.product_id',
                DB::raw('SUM(sale_items.quantity) as qty_sold'),
                DB::raw('SUM(sale_items.total) as revenue'),
                DB::raw('SUM(sale_items.quantity * products.purchase_price) as cost')
            )
            ->join('products', 'sale_items.product_id', '=', 'products.id')
            ->join('sale_invoices', 'sale_items.sale_invoice_id', '=', 'sale_invoices.id')
            ->where('sale_invoices.is_cancelled', false)
            ->with('product.category')
            ->groupBy('sale_items.product_id');

        if ($shopId) $query->where('sale_invoices.shop_id', $shopId);
        if ($request->from) $query->where('sale_invoices.sale_date', '>=', $request->from);
        if ($request->to) $query->where('sale_invoices.sale_date', '<=', $request->to);

        $rows = $query->get()->map(function ($r) {
            $r->profit = $r->revenue - $r->cost;
            $r->margin = $r->revenue > 0 ? round(($r->profit / $r->revenue) * 100, 2) : 0;
            return $r;
        });

        return response()->json($rows);
    }

    /** 3. Stock Levels */
    public function stock(Request $request)
    {
        $shopId = $this->shopFilter($request);
        $query = Inventory::with('product.category', 'shop');
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
}
