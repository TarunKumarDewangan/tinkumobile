<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\PurchaseItem;
use App\Models\SaleItem;
use Illuminate\Http\Request;

/**
 * Manual diagnostic tool for the "duplicate Product per physical IMEI" bug
 * class: two separate Product rows end up representing the same physical
 * phone (usually from quick-adding a new product instead of picking the
 * existing one), and a sale linked to one of them never updates the other's
 * stock. validateNoDuplicatePurchaseImei() in PurchaseInvoiceController now
 * blocks NEW occurrences of this; this controller finds and lets an admin
 * correct any that already exist in the data.
 */
class ImeiAuditController extends Controller
{
    private function authorizeAdmin(Request $request)
    {
        $user = $request->user();
        if (!$user->hasFullAccess() && !$user->hasRole('Admin')) {
            abort(403, 'Unauthorized');
        }
    }

    public function index(Request $request)
    {
        $this->authorizeAdmin($request);

        $purchaseItems = PurchaseItem::whereNotNull('imei')->where('imei', '!=', '')
            ->with(['product:id,name', 'invoice:id,invoice_no,purchase_date,created_at'])
            ->get(['id', 'purchase_invoice_id', 'product_id', 'imei']);

        $imeiMap = []; // imei => [ ['purchase_item_id','product_id','product_name','invoice_no','purchase_date','recorded_at'], ... ]
        foreach ($purchaseItems as $pi) {
            if (!$pi->invoice) continue; // orphaned item (parent invoice deleted) — nothing to compare against
            $tokens = array_filter(array_map('trim', explode(',', $pi->imei)));
            foreach ($tokens as $imei) {
                if ($imei === '') continue;
                $imeiMap[$imei][] = [
                    'purchase_item_id' => $pi->id,
                    'product_id'       => $pi->product_id,
                    'product_name'     => $pi->product->name ?? '—',
                    'invoice_no'       => $pi->invoice->invoice_no ?? '—',
                    'purchase_date'    => $pi->invoice->purchase_date ?? null,
                    // created_at (when the record was actually entered) is the reliable
                    // chronology signal — purchase_date/sale_date are user-editable and
                    // can be backdated, which would make a real buyback look "phantom".
                    'recorded_at'      => $pi->invoice->created_at,
                ];
            }
        }

        $saleItems = SaleItem::whereNotNull('imei')->where('imei', '!=', '')
            ->with(['product:id,name', 'invoice:id,invoice_no,sale_date,is_cancelled,created_at'])
            ->get(['id', 'sale_invoice_id', 'product_id', 'imei']);

        $saleMap = []; // imei => [ ['product_id','product_name','invoice_no','sale_date','is_cancelled','recorded_at'], ... ]
        foreach ($saleItems as $si) {
            if (!$si->invoice) continue; // orphaned item (parent invoice deleted)
            $saleMap[$si->imei][] = [
                'product_id'    => $si->product_id,
                'product_name'  => $si->product->name ?? '—',
                'invoice_no'    => $si->invoice->invoice_no ?? '—',
                'sale_date'     => $si->invoice->sale_date ?? null,
                'is_cancelled'  => (bool) ($si->invoice->is_cancelled ?? false),
                'recorded_at'   => $si->invoice->created_at,
            ];
        }

        $issues = [];

        // Type 1: phantom stock — IMEI purchased under product A (still counted
        // as available there) but actually sold under a DIFFERENT product B —
        // where that sale was recorded AFTER this purchase. If the sale instead
        // predates the purchase, this is a legitimate buyback/repurchase (the
        // unit came back into stock under a new product after being sold) and
        // must not be flagged.
        foreach ($imeiMap as $imei => $purchases) {
            $activeSales = array_values(array_filter($saleMap[$imei] ?? [], fn ($s) => !$s['is_cancelled']));
            if (empty($activeSales)) continue;

            foreach ($purchases as $purchase) {
                $soldUnderSameProduct = collect($activeSales)->contains(fn ($s) => $s['product_id'] == $purchase['product_id']);
                if ($soldUnderSameProduct) continue; // normal — already correctly hidden from stock

                $saleAfterThisPurchase = collect($activeSales)->first(
                    fn ($s) => $s['product_id'] != $purchase['product_id'] && $s['recorded_at'] > $purchase['recorded_at']
                );
                if (!$saleAfterThisPurchase) continue; // sale predates this purchase — legit buyback, not phantom

                $issues[] = [
                    'type'                    => 'phantom_stock',
                    'imei'                    => $imei,
                    'purchase_item_id'        => $purchase['purchase_item_id'],
                    'purchased_product_id'    => $purchase['product_id'],
                    'purchased_product_name'  => $purchase['product_name'],
                    'purchase_invoice_no'     => $purchase['invoice_no'],
                    'purchase_date'           => $purchase['purchase_date'],
                    'sold_product_id'         => $saleAfterThisPurchase['product_id'],
                    'sold_product_name'       => $saleAfterThisPurchase['product_name'],
                    'sale_invoice_no'         => $saleAfterThisPurchase['invoice_no'],
                    'sale_date'               => $saleAfterThisPurchase['sale_date'],
                    'fixable'                 => true,
                ];
            }
        }

        // Type 2: same IMEI purchased under 2+ different products, none of them
        // sold — the same physical unit is double-counted as available stock.
        // Ambiguous which row is "correct", so this is surfaced for manual
        // review rather than an automated fix.
        foreach ($imeiMap as $imei => $purchases) {
            $distinctProducts = collect($purchases)->pluck('product_id')->unique();
            if ($distinctProducts->count() < 2) continue;

            $activeSales = array_values(array_filter($saleMap[$imei] ?? [], fn ($s) => !$s['is_cancelled']));
            if (!empty($activeSales)) continue; // covered by type 1 above

            $issues[] = [
                'type'    => 'duplicate_unsold_stock',
                'imei'    => $imei,
                'entries' => $purchases,
                'fixable' => false,
            ];
        }

        return response()->json(['issues' => array_values($issues), 'count' => count($issues)]);
    }

    public function fix(Request $request)
    {
        $this->authorizeAdmin($request);
        $user = $request->user();

        $data = $request->validate([
            'purchase_item_id' => 'required|exists:purchase_items,id',
            // IMEIs are long digit strings — some clients/proxies serialize them as
            // a bare JSON number rather than a quoted string, so accept either
            // and normalize below instead of rejecting on type.
            'imei'              => 'required',
        ]);

        $pi = PurchaseItem::findOrFail($data['purchase_item_id']);
        $imei = trim((string) $data['imei']);
        $tokens = array_filter(array_map('trim', explode(',', (string) $pi->imei)));
        $filtered = array_values(array_filter($tokens, fn ($t) => $t !== $imei));

        if (count($filtered) === count($tokens)) {
            return response()->json(['message' => 'That IMEI was not found on this purchase item — it may already be fixed.'], 422);
        }

        $pi->imei = $filtered ? implode(',', $filtered) : null;
        $pi->save();

        ActivityLog::log(
            'IMEI_AUDIT_FIX',
            $user,
            "Removed phantom-stock IMEI {$imei} from purchase item #{$pi->id} (product #{$pi->product_id}) — it was already sold under a different product."
        );

        return response()->json(['message' => 'Fixed — this unit will no longer show as available stock.']);
    }
}
