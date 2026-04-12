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
        // 1. Get All Known Entities from the Master Table
        $entities = \App\Models\Entity::all();

        // 2. Get Summary from Transactions
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

        // 3. Get Unpaid Repair Costs
        $repairDues = DB::table('repair_requests')
            ->where('is_forwarded', true)
            ->where('is_cost_paid', false)
            ->where('service_center_cost', '>', 0)
            ->select('forwarded_to as entity_name', DB::raw('SUM(service_center_cost) as total_due'))
            ->groupBy('forwarded_to')
            ->get();

        // 4. Combine Everything
        $final = [];
        
        // Use the Master Entities list as the base
        foreach ($entities as $e) {
            $trans = $transSummaries->get($e->name);
            $due = $repairDues->where('entity_name', $e->name)->first();
            
            $totalIn = (float)($trans->total_in ?? 0);
            $totalOut = (float)($trans->total_out ?? 0);
            $totalRepairDue = (float)($due->total_due ?? 0);

            // Starting point from Opening Balance
            $opening = (float)$e->opening_balance;
            if ($e->balance_type === 'PAYABLE') {
                $opening = -$opening; // We owe them initially
            }

            // Final Calculation: Opening + (Money In - Money Out - Debt Owed)
            $currentBalance = $opening + ($totalIn - $totalOut - $totalRepairDue);

            $final[] = [
                'id' => $e->id,
                'entity_name' => $e->name,
                'entity_type' => $e->type,
                'total_in'    => $totalIn,
                'total_out'   => $totalOut,
                'repair_dues' => $totalRepairDue,
                'opening_balance' => $e->opening_balance,
                'balance_type' => $e->balance_type,
                'balance'     => $currentBalance
            ];
        }

        // Handle string-only entities that might not be in the Master Entity table yet
        $knownNames = $entities->pluck('name')->toArray();
        foreach ($transSummaries as $name => $trans) {
            if (!in_array($name, $knownNames)) {
                $final[] = [
                    'entity_name' => $name,
                    'entity_type' => 'UNREGISTERED',
                    'total_in'    => (float)$trans->total_in,
                    'total_out'   => (float)$trans->total_out,
                    'repair_dues' => 0,
                    'opening_balance' => 0,
                    'balance'     => (float)$trans->total_in - (float)$trans->total_out
                ];
            }
        }

        return response()->json($final);
    }

    /**
     * Get detailed ledger for a specific entity.
     */
    public function show($entityName)
    {
        $entity = \App\Models\Entity::where('name', $entityName)->first();
        $transactions = Transaction::where('entity_name', $entityName)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'entity' => $entity,
            'transactions' => $transactions
        ]);
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
