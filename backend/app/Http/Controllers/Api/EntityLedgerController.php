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
        // 1. Get Summary from Transactions
        $transSummaries = Transaction::select(
            'entity_name',
            DB::raw('SUM(CASE WHEN type = "CASH_IN" THEN amount ELSE 0 END) as total_in'),
            DB::raw('SUM(CASE WHEN type = "CASH_OUT" THEN amount ELSE 0 END) as total_out')
        )
        ->whereNotNull('entity_name')
        ->where('entity_name', '!=', '')
        ->groupBy('entity_name')
        ->get()
        ->keyBy('entity_name');

        // 2. Get Unpaid Repair Costs (Dues we owe to forward shops)
        $repairDues = DB::table('repair_requests')
            ->where('is_forwarded', true)
            ->where('is_cost_paid', false)
            ->where('service_center_cost', '>', 0)
            ->select('forwarded_to as entity_name', DB::raw('SUM(service_center_cost) as total_due'))
            ->groupBy('forwarded_to')
            ->get();

        // 3. Merge them
        $final = [];
        $allNames = $transSummaries->keys()->merge($repairDues->pluck('entity_name'))->unique();

        foreach ($allNames as $name) {
            $trans = $transSummaries->get($name);
            $due = $repairDues->where('entity_name', $name)->first();
            
            $totalIn = (float)($trans->total_in ?? 0);
            $totalOut = (float)($trans->total_out ?? 0);
            $totalDueAccountable = (float)($due->total_due ?? 0);

            $final[] = [
                'entity_name' => $name,
                'total_in'    => $totalIn,
                'total_out'   => $totalOut,
                'repair_dues' => $totalDueAccountable, // Unsettled costs
                'balance'     => $totalIn - ($totalOut + $totalDueAccountable)
            ];
        }

        return response()->json($final);
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
