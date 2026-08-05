<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Supplier;
use App\Models\Retailer;
use App\Models\Entity;
use App\Models\Product;
use App\Models\SaleInvoice;
use App\Models\PurchaseInvoice;
use App\Models\OldMobilePurchase;
use App\Models\RepairRequest;
use App\Models\User;
use App\Models\Transaction;
use App\Models\ActivityLog;
use Illuminate\Http\Request;

class SearchController extends Controller
{
    /** Per-category result cap — this is a quick-lookup box, not a full report. */
    private const LIMIT = 5;

    public function index(Request $request)
    {
        $q = trim((string) $request->get('q', ''));
        if (mb_strlen($q) < 2) {
            return response()->json(['results' => []]);
        }

        $user = $request->user();
        $fullAccess = $user->hasFullAccess();
        $shopId = $fullAccess ? null : $user->shop_id;
        $like = "%{$q}%";
        $results = [];

        // Customers
        Customer::where(fn($qr) => $qr->where('name', 'like', $like)->orWhere('phone', 'like', $like))
            ->limit(self::LIMIT)->get()->each(function ($c) use (&$results) {
                $results[] = ['type' => 'Customer', 'icon' => '👤', 'title' => $c->name, 'subtitle' => $c->phone, 'link' => '/customers'];
            });

        // Suppliers
        Supplier::where(fn($qr) => $qr->where('name', 'like', $like)->orWhere('phone', 'like', $like))
            ->limit(self::LIMIT)->get()->each(function ($s) use (&$results) {
                $results[] = ['type' => 'Supplier', 'icon' => '🚚', 'title' => $s->name, 'subtitle' => $s->phone, 'link' => '/suppliers'];
            });

        // Retailers (Airtel)
        Retailer::where(fn($qr) => $qr->where('name', 'like', $like)->orWhere('msisdn', 'like', $like))
            ->limit(self::LIMIT)->get()->each(function ($r) use (&$results) {
                $results[] = ['type' => 'Retailer', 'icon' => '📡', 'title' => $r->name, 'subtitle' => $r->msisdn, 'link' => "/airtel/retailers/{$r->id}"];
            });

        // Entities (accounting)
        Entity::where(fn($qr) => $qr->where('name', 'like', $like)->orWhere('phone', 'like', $like))
            ->limit(self::LIMIT)->get()->each(function ($e) use (&$results) {
                $results[] = ['type' => 'Entity', 'icon' => '🏦', 'title' => $e->name, 'subtitle' => $e->type, 'link' => '/accounts/entity-ledger?id=' . $e->id . '&name=' . urlencode($e->name)];
            });

        // Products
        Product::where(fn($qr) => $qr->where('name', 'like', $like)->orWhere('sku', 'like', $like)->orWhere('imei', 'like', $like))
            ->limit(self::LIMIT)->get()->each(function ($p) use (&$results) {
                $results[] = ['type' => 'Product', 'icon' => '📱', 'title' => $p->name, 'subtitle' => "SKU: {$p->sku}" . ($p->imei ? " · IMEI: {$p->imei}" : ''), 'link' => '/products'];
            });

        // Sale Invoices
        SaleInvoice::with('customer')
            ->when($shopId, fn($qr) => $qr->where('shop_id', $shopId))
            ->where(function ($qr) use ($like) {
                $qr->where('invoice_no', 'like', $like)
                   ->orWhereHas('customer', fn($cq) => $cq->where('name', 'like', $like)->orWhere('phone', 'like', $like));
            })
            ->limit(self::LIMIT)->get()->each(function ($s) use (&$results) {
                $results[] = ['type' => 'Sale Invoice', 'icon' => '🛍️', 'title' => $s->invoice_no, 'subtitle' => ($s->customer_name ?? 'Walk-in') . ' · ₹' . number_format($s->grand_total, 2), 'link' => "/sales/{$s->id}"];
            });

        // Purchase Invoices
        PurchaseInvoice::with('supplier')
            ->when($shopId, fn($qr) => $qr->where('shop_id', $shopId))
            ->where(function ($qr) use ($like) {
                $qr->where('invoice_no', 'like', $like)
                   ->orWhereHas('supplier', fn($sq) => $sq->where('name', 'like', $like));
            })
            ->limit(self::LIMIT)->get()->each(function ($p) use (&$results) {
                $results[] = ['type' => 'Purchase Invoice', 'icon' => '📦', 'title' => $p->invoice_no, 'subtitle' => ($p->supplier->name ?? 'Unknown') . ' · ₹' . number_format($p->grand_total, 2), 'link' => "/purchases/{$p->id}"];
            });

        // Old Mobile Purchases
        OldMobilePurchase::when($shopId, fn($qr) => $qr->where('shop_id', $shopId))
            ->where(function ($qr) use ($like) {
                $qr->where('model_name', 'like', $like)->orWhere('imei', 'like', $like);
            })
            ->limit(self::LIMIT)->get()->each(function ($o) use (&$results) {
                $results[] = ['type' => '2nd Hand Purchase', 'icon' => '🔄', 'title' => $o->model_name, 'subtitle' => ($o->imei ?: 'No IMEI') . ' · ₹' . number_format($o->purchase_price, 2), 'link' => '/old-mobiles'];
            });

        // Repairs
        RepairRequest::when($shopId, fn($qr) => $qr->where('shop_id', $shopId))
            ->where(function ($qr) use ($like) {
                $qr->where('customer_name', 'like', $like)->orWhere('customer_phone', 'like', $like)->orWhere('device_model', 'like', $like);
            })
            ->limit(self::LIMIT)->get()->each(function ($r) use (&$results) {
                $results[] = ['type' => 'Repair', 'icon' => '🔧', 'title' => $r->device_model, 'subtitle' => "{$r->customer_name} · " . strtoupper($r->status), 'link' => '/repairs'];
            });

        // The following categories surface staff/system-level data — restricted to
        // owner/admin, matching the access check already enforced on their own
        // dedicated endpoints (UserController, ActivityLogController, TransactionController).
        if ($fullAccess) {
            User::where(fn($qr) => $qr->where('name', 'like', $like)->orWhere('email', 'like', $like))
                ->limit(self::LIMIT)->get()->each(function ($u) use (&$results) {
                    $results[] = ['type' => 'Staff', 'icon' => '👷', 'title' => $u->name, 'subtitle' => $u->email, 'link' => '/admin/users'];
                });

            Transaction::where(fn($qr) => $qr->where('description', 'like', $like)->orWhere('entity_name', 'like', $like))
                ->limit(self::LIMIT)->get()->each(function ($t) use (&$results) {
                    $results[] = ['type' => 'Transaction', 'icon' => '💰', 'title' => $t->description ?: $t->category, 'subtitle' => strtoupper($t->type) . ' · ₹' . number_format($t->amount, 2), 'link' => '/accounts/daybook'];
                });

            ActivityLog::where('description', 'like', $like)
                ->limit(self::LIMIT)->get()->each(function ($a) use (&$results) {
                    $results[] = ['type' => 'Activity Log', 'icon' => '📋', 'title' => $a->action, 'subtitle' => $a->description, 'link' => '/admin/activity-logs'];
                });
        }

        return response()->json(['results' => $results]);
    }
}
