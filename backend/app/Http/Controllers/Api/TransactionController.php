<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Transaction;
use App\Models\ExpenseCategory;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TransactionController extends Controller
{
    protected $transactionService;

    public function __construct(\App\Services\TransactionService $transactionService)
    {
        $this->transactionService = $transactionService;
    }

    public function index(Request $request)
    {
        $user = $request->user();
        $query = Transaction::with(['user', 'entity']);

        if (!$user->hasFullAccess()) {
            $query->where('shop_id', $user->shop_id);
        } elseif ($request->shop_id) {
            $query->where('shop_id', $request->shop_id);
        }

        // Airtel Recovery is a completely isolated system — exclude from main transactions
        // unless a specific airtel category is explicitly requested
        $airtelCategories = ['AIRTEL_RECOVERY', 'AIRTEL_DROP'];
        if (!$request->category || !in_array(strtoupper($request->category), $airtelCategories)) {
            $query->whereNotIn('category', $airtelCategories);
        }

        // Bank-mirror rows are internal bookkeeping (the same money already
        // appears once against the party) — they're visible on that bank
        // entity's own Entity Ledger page, not in this general list.
        $query->where('is_internal_transfer', false);

        if ($request->type) $query->where('type', $request->type);
        if ($request->category) {
            // Callers (e.g. Overheads/Cashbook) pass a comma-separated list
            // like "EXPENSE,OTHER_INCOME" — an exact-match where() never
            // matched any real row, silently returning zero results.
            $categories = array_filter(array_map('trim', explode(',', $request->category)));
            if (count($categories) > 1) {
                $query->whereIn('category', $categories);
            } else {
                $query->where('category', $categories[0] ?? $request->category);
            }
        }
        if ($request->payment_mode) $query->where('payment_mode', $request->payment_mode);
        if ($request->from) $query->where('transaction_date', '>=', $request->from);
        if ($request->to) $query->where('transaction_date', '<=', $request->to);

        if ($request->entity_type && $request->entity_id) {
            $query->where('entity_type', 'like', "%{$request->entity_type}")
                  ->where('entity_id', $request->entity_id);
        }


        $transactions = $query->latest('transaction_date')
                             ->latest('id')
                             ->paginate(50);

        // Summary Statistics
        $statsQuery = clone $query;
        $stats = [
            'total_in'  => (float) (clone $statsQuery)->where('type', 'IN')->sum('amount'),
            'total_out' => (float) (clone $statsQuery)->where('type', 'OUT')->sum('amount'),
        ];
        $stats['balance'] = $stats['total_in'] - $stats['total_out'];

        return response()->json([
            'transactions' => $transactions,
            'summary'      => $stats
        ]);
    }

    public function show(Request $request, Transaction $transaction)
    {
        $user = $request->user();
        if (!$user->hasFullAccess() && $transaction->shop_id !== $user->shop_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        return response()->json($transaction->load('user', 'entity'));
    }

    /**
     * Store a manual expense or income.
     */
    public function store(Request $request)
    {
        $user = $request->user();
        $data = $request->validate([
            'type'             => 'required|in:IN,OUT',
            'category'         => 'required|string|max:50', // Usually 'EXPENSE' or 'OTHER_INCOME'
            'amount'           => 'required|numeric|min:0.01',
            'payment_mode'     => 'required|string',
            'payment_lines'    => 'nullable|array|min:2',
            'payment_lines.*.payment_mode' => 'required_with:payment_lines|string',
            'payment_lines.*.amount'       => 'required_with:payment_lines|numeric|min:0.01',
            'entity_type'      => 'nullable|string', // e.g. 'ExpenseCategory'
            'entity_id'        => 'nullable|integer',
            'description'      => 'nullable|string',
            'transaction_date' => 'required|date',
            'shop_id'          => $user->hasFullAccess() ? 'nullable|exists:shops,id' : 'nullable'
        ]);

        if (!\App\Services\TransactionService::paymentLinesSumMatches($data['payment_lines'] ?? null, (float) $data['amount'])) {
            return response()->json(['message' => 'Split payment lines must add up to the amount'], 422);
        }

        $data['shop_id'] = $user->hasFullAccess() ? ($data['shop_id'] ?? $user->shop_id) : $user->shop_id;
        $data['user_id'] = $user->id;

        // Map short entity type names to full class names if provided
        if ($data['entity_type'] === 'ExpenseCategory') {
            $data['entity_type'] = \App\Models\ExpenseCategory::class;
        }

        $paymentLines = $data['payment_lines'] ?? null;
        unset($data['payment_lines']);

        // Previously a plain Transaction::create() — this bypassed dual-posting,
        // so a manual expense/income paid via a Bank/UPI/Cash-Counter entity's
        // name never actually moved that account's balance.
        $transaction = DB::transaction(function () use ($data, $paymentLines) {
            if (is_array($paymentLines) && count($paymentLines) > 1) {
                $created = [];
                foreach ($paymentLines as $line) {
                    $created[] = $this->transactionService->postSingle(array_merge($data, [
                        'amount' => $line['amount'],
                        'payment_mode' => strtoupper($line['payment_mode']),
                    ]));
                }
                return $created;
            }
            return $this->transactionService->postSingle($data);
        });

        return response()->json($transaction, 201);
    }

    public function destroy(Request $request, $id)
    {
        $user = $request->user();
        if (!$user->hasFullAccess()) {
            return response()->json(['message' => 'Only Admin/Owner can delete transactions'], 403);
        }

        // Use withTrashed() so already-soft-deleted transactions (orphaned ledger entries) can still be cleaned up
        $transaction = Transaction::withTrashed()->find($id);
        if (!$transaction) {
            return response()->json(['message' => 'Transaction not found'], 404);
        }

        // Clean up ledger table entries linked to this transaction
        \App\Models\Ledger::whereIn('voucher_type', ['RECEIPT', 'PAYMENT'])
            ->where('voucher_id', $transaction->id)
            ->delete();

        // Delete any dual-posted mirror(s) so the bank entity doesn't keep a
        // phantom entry for money that no longer exists in the ledger.
        $mirrorEntityIds = Transaction::where('mirror_of_transaction_id', $transaction->id)
            ->pluck('accounting_entity_id')->filter()->unique();
        Transaction::where('mirror_of_transaction_id', $transaction->id)->get()->each->delete();

        // Sync entity balance after removal
        $entityIds = collect([$transaction->accounting_entity_id])->merge($mirrorEntityIds)->filter()->unique();
        foreach ($entityIds as $entityId) {
            $entity = \App\Models\Entity::find($entityId);
            if ($entity) {
                app(\App\Services\EntityService::class)->syncBalance($entity);
            }
        }

        $transaction->forceDelete();
        return response()->json(['message' => 'Transaction deleted']);
    }

    public function update(Request $request, Transaction $transaction)
    {
        $user = $request->user();
        if (!$user->hasFullAccess()) {
            return response()->json(['message' => 'Only Admin/Owner can update transactions'], 403);
        }

        $data = $request->validate([
            'amount'           => 'required|numeric|min:0.01',
            'payment_mode'     => 'required|string',
            'description'      => 'nullable|string',
            'category'         => 'required|string|max:50',
            'transaction_date' => 'required|date',
        ]);

        // Re-syncs the dual-posted mirror too (old one removed, fresh one
        // posted for the new amount/mode) — a plain ->update() previously
        // left a stale mirror behind if the amount or mode changed.
        $this->transactionService->resyncSingle($transaction, $data);

        // Sync entity balance
        if ($transaction->accounting_entity_id) {
            $entity = \App\Models\Entity::find($transaction->accounting_entity_id);
            if ($entity) {
                app(\App\Services\EntityService::class)->syncBalance($entity);
            }
        }

        return response()->json($transaction->fresh());
    }

    /**
     * Get unique categories used in transactions.
     */
    public function categories()
    {
        $categories = Transaction::distinct('category')->pluck('category');
        return response()->json($categories);
    }
}
