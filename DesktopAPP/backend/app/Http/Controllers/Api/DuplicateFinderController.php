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
