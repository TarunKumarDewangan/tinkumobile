<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Ledger;
use App\Models\Entity;
use Illuminate\Support\Facades\DB;
use App\Services\AccountingService;

class LedgerController extends Controller
{
    /**
     * Get the Daybook (All ledger entries for a specific date range)
     */
    public function daybook(Request $request)
    {
        $startDate = $request->query('start_date', now()->startOfMonth()->toDateString());
        $endDate = $request->query('end_date', now()->endOfMonth()->toDateString());

        $ledgers = Ledger::with('entity:id,name,type')
            ->whereHas('entity', function($q) {
                $q->where('type', '!=', 'RETAILER');
            })
            ->whereBetween('date', [$startDate, $endDate])
            ->orderBy('date', 'desc')
            ->orderBy('id', 'desc')
            ->get();

        $totals = [
            'debit' => $ledgers->sum('debit'),
            'credit' => $ledgers->sum('credit'),
        ];

        return response()->json([
            'entries' => $ledgers,
            'totals' => $totals
        ]);
    }

    /**
     * Get the Ledger Statement for a specific Entity
     */
    public function statement(Request $request, $entityId)
    {
        $entity = Entity::findOrFail($entityId);
        
        $startDate = $request->query('start_date'); // null = all time
        $endDate = $request->query('end_date');

        // Calculate opening balance up to start_date
        $accounting = app(AccountingService::class);
        $openingBalance = $startDate
            ? $accounting->getClosingBalance($entity, date('Y-m-d', strtotime($startDate . ' - 1 day')))
            : (($entity->balance_type === 'RECEIVABLE' ? 1 : -1) * (float)$entity->opening_balance);

        $query = Ledger::where('entity_id', $entityId);
        if ($startDate) $query->where('date', '>=', $startDate);
        if ($endDate)   $query->where('date', '<=', $endDate);
        $ledgers = $query->orderBy('date', 'asc')->orderBy('id', 'asc')->get();

        // Calculate running balances
        $runningBalance = $openingBalance;
        $statement = [];
        
        foreach ($ledgers as $ledger) {
            $runningBalance += ($ledger->debit - $ledger->credit);
            $ledger->running_balance = $runningBalance;
            $statement[] = $ledger;
        }

        return response()->json([
            'entity' => $entity,
            'opening_balance' => $openingBalance,
            'closing_balance' => $runningBalance,
            'entries' => $statement
        ]);
    }

    /**
     * Get entity balances (Entity Manager / Report)
     */
    public function entityBalances(Request $request)
    {
        $query = $request->query('q');
        $type = $request->query('type');
        
        $entities = Entity::query();
        if ($query) {
            $entities->where(function($q) use ($query) {
                $q->where('name', 'like', "%{$query}%")
                  ->orWhere('phone', 'like', "%{$query}%");
            });
        }
        if ($type) {
            $entities->where('type', $type);
        } else {
            $entities->where('type', '!=', 'RETAILER');
        }

        $entities = $entities->get();
        $accounting = app(AccountingService::class);

        $results = $entities->map(function ($entity) use ($accounting) {
            $closing = $accounting->getClosingBalance($entity);
            return [
                'id' => $entity->id,
                'name' => $entity->name,
                'phone' => $entity->phone,
                'type' => $entity->type,
                'opening_balance' => $entity->opening_balance,
                'balance_type' => $entity->balance_type,
                'net_balance' => $closing
            ];
        })->filter(function($e) use ($query) {
            // Show all entities including zero balance entities
            return true;
        })->values();

        return response()->json($results);
    }

    /**
     * Get overall summary of all entities (Receivable vs Payable)
     */
    public function summary()
    {
        $entities = DB::select("
            SELECT 
                e.id, 
                e.opening_balance * CASE WHEN e.balance_type = 'RECEIVABLE' THEN 1 ELSE -1 END as op_bal,
                COALESCE(SUM(l.debit), 0) as total_debit,
                COALESCE(SUM(l.credit), 0) as total_credit
            FROM entities e
            LEFT JOIN ledgers l ON e.id = l.entity_id
            WHERE e.type != 'RETAILER'
            GROUP BY e.id, e.opening_balance, e.balance_type
        ");

        $receivable = 0;
        $payable = 0;
        
        foreach($entities as $e) {
            $bal = $e->op_bal + $e->total_debit - $e->total_credit;
            if ($bal > 0) $receivable += $bal;
            if ($bal < 0) $payable += abs($bal);
        }

        return response()->json([
            'overallTotal' => $receivable - $payable,
            'receivable' => $receivable,
            'payable' => $payable,
        ]);
    }

    /**
     * Get detailed breakdown of accounts contributing to summary totals
     */
    public function breakdown(Request $request)
    {
        $type = $request->query('type', 'OVERALL'); // RECEIVABLE, PAYABLE, OVERALL
        
        $entities = Entity::where('type', '!=', 'RETAILER')->get();
        $accounting = app(AccountingService::class);
        
        $results = [];
        foreach($entities as $entity) {
            $balance = $accounting->getClosingBalance($entity);
            
            if (round($balance, 2) == 0) continue;
            
            if ($type === 'RECEIVABLE' && $balance <= 0) continue;
            if ($type === 'PAYABLE' && $balance >= 0) continue;
            
            $results[] = [
                'id' => $entity->id,
                'name' => $entity->name,
                'phone' => $entity->phone,
                'type' => $entity->type,
                'balance' => (float)$balance
            ];
        }
        
        // Sort by magnitude of balance
        usort($results, function($a, $b) {
            return abs($b['balance']) <=> abs($a['balance']);
        });
        
        return response()->json($results);
    }
}
