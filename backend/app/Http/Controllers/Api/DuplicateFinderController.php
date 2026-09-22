<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Transaction;
use Illuminate\Http\Request;

/**
 * Finds transactions that look like they were created by the same overlapping
 * "edit/save" request firing twice (two tabs, a retried request on a slow
 * connection) — same entity, same category, same amount, recorded within a
 * few minutes of each other. This is the exact fingerprint of the race
 * SaleInvoiceController::update() had before it was locked per-invoice; the
 * lock stops new occurrences, this finds and lets an admin clean up any that
 * already exist (in sale edits or anywhere else transactions get rewritten).
 */
class DuplicateFinderController extends Controller
{
    // Two same-entity/category/amount transactions within this many minutes
    // of each other are treated as a likely duplicate pair, not a
    // coincidence — a genuinely separate payment of the same round amount
    // days apart won't trip this.
    private const WINDOW_MINUTES = 30;

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

        $rows = Transaction::whereNotNull('entity_id')
            ->whereNotNull('entity_type')
            ->orderBy('created_at')
            ->get(['id', 'entity_type', 'entity_id', 'category', 'amount', 'entity_name', 'description', 'type', 'created_at']);

        $groups = $rows->groupBy(fn ($t) => $t->entity_type . '|' . $t->entity_id . '|' . $t->category . '|' . $t->amount);

        $issues = [];
        foreach ($groups as $key => $group) {
            if ($group->count() < 2) continue;

            $first = $group->first();
            $last = $group->last();
            $spanSeconds = $first->created_at->diffInSeconds($last->created_at);
            if ($spanSeconds > self::WINDOW_MINUTES * 60) continue;

            $issues[] = [
                'key'          => $key,
                'entity_type'  => class_basename($first->entity_type),
                'entity_id'    => $first->entity_id,
                'entity_name'  => $first->entity_name,
                'category'     => $first->category,
                'type'         => $first->type,
                'amount'       => (float) $first->amount,
                'description'  => $first->description,
                'count'        => $group->count(),
                'extra_amount' => (float) $first->amount * ($group->count() - 1),
                'span_seconds' => $spanSeconds,
                'transactions' => $group->map(fn ($t) => [
                    'id' => $t->id,
                    'created_at' => $t->created_at,
                ])->values(),
            ];
        }

        // Second pattern: a SALE_INCOME and a SHOP_FINANCE_DOWN_PAYMENT
        // transaction for the same invoice, same amount, close in time — the
        // exact shape of the "EMI down payment recorded twice" bug (the
        // frontend always mirrors total_paid to equal the Shop Finance down
        // payment, but the backend used to record both as separate income).
        // Fixed going forward in SaleInvoiceController; this finds any that
        // already exist. The fix keeps the SHOP_FINANCE_DOWN_PAYMENT entry
        // (that's what the corrected code produces) and removes the
        // duplicate SALE_INCOME one.
        $pairGroups = $rows
            ->where('entity_type', \App\Models\SaleInvoice::class)
            ->groupBy(fn ($t) => $t->entity_type . '|' . $t->entity_id . '|' . $t->amount);

        foreach ($pairGroups as $key => $group) {
            $saleIncome = $group->firstWhere('category', 'SALE_INCOME');
            $shopFinanceDp = $group->firstWhere('category', 'SHOP_FINANCE_DOWN_PAYMENT');
            if (!$saleIncome || !$shopFinanceDp) continue;

            $spanSeconds = abs($saleIncome->created_at->diffInSeconds($shopFinanceDp->created_at));
            if ($spanSeconds > self::WINDOW_MINUTES * 60) continue;

            $issues[] = [
                'key'          => $key . '|pair',
                'entity_type'  => class_basename($saleIncome->entity_type),
                'entity_id'    => $saleIncome->entity_id,
                'entity_name'  => $saleIncome->entity_name,
                'category'     => 'SALE_INCOME + SHOP_FINANCE_DOWN_PAYMENT',
                'type'         => $saleIncome->type,
                'amount'       => (float) $saleIncome->amount,
                'description'  => 'Down payment recorded twice — once as general sale income, once as the Shop Finance plan\'s own down payment',
                'count'        => 2,
                'extra_amount' => (float) $saleIncome->amount,
                'span_seconds' => $spanSeconds,
                // First = kept (the correct SHOP_FINANCE_DOWN_PAYMENT entry),
                // rest = deleted — matches how the Fix button reads this array.
                'transactions' => [
                    ['id' => $shopFinanceDp->id, 'created_at' => $shopFinanceDp->created_at],
                    ['id' => $saleIncome->id, 'created_at' => $saleIncome->created_at],
                ],
            ];
        }

        // Worst (most extra amount) first.
        usort($issues, fn ($a, $b) => $b['extra_amount'] <=> $a['extra_amount']);

        return response()->json(['issues' => $issues, 'count' => count($issues)]);
    }

    /**
     * Deletes every transaction id in $keep_id's group except $keep_id
     * itself — soft delete (same as the rest of the app), so this is
     * recoverable from Trash Manager if needed.
     */
    public function fix(Request $request)
    {
        $this->authorizeAdmin($request);
        $user = $request->user();

        $data = $request->validate([
            'keep_id'    => 'required|integer|exists:transactions,id',
            'delete_ids' => 'required|array|min:1',
            'delete_ids.*' => 'integer|exists:transactions,id',
        ]);

        if (in_array($data['keep_id'], $data['delete_ids'])) {
            return response()->json(['message' => 'keep_id cannot also be in delete_ids'], 422);
        }

        $deleted = Transaction::whereIn('id', $data['delete_ids'])->get();
        foreach ($deleted as $tx) {
            $tx->delete();
        }

        ActivityLog::log(
            'DUPLICATE_TRANSACTIONS_REMOVED',
            $user,
            "Removed " . $deleted->count() . " duplicate transaction(s) [" . $deleted->pluck('id')->implode(',') . "], kept #{$data['keep_id']}"
        );

        return response()->json(['message' => 'Duplicates removed', 'removed' => $deleted->count()]);
    }
}
