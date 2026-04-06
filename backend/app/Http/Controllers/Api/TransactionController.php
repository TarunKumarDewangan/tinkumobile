<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Transaction;
use App\Models\ExpenseCategory;
use App\Traits\RecordsTransactions;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TransactionController extends Controller
{
    use RecordsTransactions;

    public function index(Request $request)
    {
        $user = $request->user();
        $query = Transaction::with(['user', 'entity']);

        if (!$user->hasFullAccess()) {
            $query->where('shop_id', $user->shop_id);
        } elseif ($request->shop_id) {
            $query->where('shop_id', $request->shop_id);
        }

        if ($request->type) $query->where('type', $request->type);
        if ($request->category) $query->where('category', $request->category);
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
            'entity_type'      => 'nullable|string', // e.g. 'ExpenseCategory'
            'entity_id'        => 'nullable|integer',
            'description'      => 'nullable|string',
            'transaction_date' => 'required|date',
            'shop_id'          => $user->hasFullAccess() ? 'nullable|exists:shops,id' : 'nullable'
        ]);

        $data['shop_id'] = $user->hasFullAccess() ? ($data['shop_id'] ?? $user->shop_id) : $user->shop_id;
        $data['user_id'] = $user->id;

        // Map short entity type names to full class names if provided
        if ($data['entity_type'] === 'ExpenseCategory') {
            $data['entity_type'] = \App\Models\ExpenseCategory::class;
        }

        $transaction = Transaction::create($data);

        return response()->json($transaction, 201);
    }

    public function destroy(Request $request, Transaction $transaction)
    {
        $user = $request->user();
        if (!$user->hasFullAccess()) {
            return response()->json(['message' => 'Only Admin/Owner can delete transactions'], 403);
        }

        $transaction->delete();
        return response()->json(['message' => 'Transaction deleted']);
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
