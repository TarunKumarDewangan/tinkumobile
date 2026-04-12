<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Transaction;
use App\Traits\RecordsTransactions;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class EntityLedgerController extends Controller
{
    use RecordsTransactions;

    /**
     * Get summary of all entities with balances.
     */
    public function index(Request $request)
    {
        // Exclude specific entities if needed, but for now we follow the user's "any entity" request
        // except airtel recovery and customer (assuming customers have phone numbers or specific prefixes)
        // Actually, we'll just group everything and let the UI filter.
        
        $summaries = Transaction::select(
            'entity_name',
            DB::raw('SUM(CASE WHEN type = "CASH_IN" THEN amount ELSE 0 END) as total_in'),
            DB::raw('SUM(CASE WHEN type = "CASH_OUT" THEN amount ELSE 0 END) as total_out'),
            DB::raw('SUM(CASE WHEN type = "CASH_IN" THEN amount ELSE -amount END) as balance')
        )
        ->whereNotNull('entity_name')
        ->where('entity_name', '!=', '')
        ->groupBy('entity_name')
        ->get();

        return response()->json($summaries);
    }

    /**
     * Get detailed ledger for a specific entity.
     */
    public function show($entityName)
    {
        $transactions = Transaction::where('entity_name', $entityName)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($transactions);
    }

    /**
     * Record a manual settlement for an entity.
     */
    public function settle(Request $request)
    {
        $request->validate([
            'entity_name' => 'required|string',
            'amount' => 'required|numeric|min:0',
            'type' => 'required|in:CASH_IN,CASH_OUT',
            'payment_mode' => 'required|string',
            'description' => 'nullable|string',
            'category' => 'required|string'
        ]);

        $transaction = $this->recordTransaction([
            'amount' => $request->amount,
            'type' => $request->type,
            'category' => $request->category,
            'description' => $request->description ?? "Manual settlement for {$request->entity_name}",
            'payment_mode' => $request->payment_mode,
            'entity_name' => $request->entity_name
        ]);

        return response()->json([
            'message' => 'Settlement recorded successfully',
            'transaction' => $transaction
        ]);
    }
}
