<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

class ReportingService
{
    /**
     * Get aggregated financial movements for a list of entities.
     * Logic extracted from EntityLedgerController.
     */
    public function getAggregatedMovements(array $ids, array $names, $start = null, $end = null)
    {
        $stats = [];

        // 1. Real Transactions (Money In/Out)
        $txQuery = DB::table('transactions')
            ->whereNull('deleted_at')
            ->where(function($q) use ($ids, $names) {
                if (!empty($ids)) $q->whereIn('accounting_entity_id', $ids);
                if (!empty($names)) $q->orWhereIn('entity_name', $names);
            });

        if ($start) $txQuery->where('transaction_date', '>=', $start);
        if ($end) $txQuery->where('transaction_date', '<=', $end);

        $txData = $txQuery->select(
            'accounting_entity_id',
            'entity_name',
            DB::raw('SUM(CASE WHEN type = "IN" THEN amount ELSE 0 END) as total_in'),
            DB::raw('SUM(CASE WHEN type = "OUT" THEN amount ELSE 0 END) as total_out')
        )->groupBy('accounting_entity_id', 'entity_name')->get();

        foreach ($txData as $row) {
            $key = $row->accounting_entity_id ?: $row->entity_name;
            if (!$key) continue;
            if (!isset($stats[$key])) $stats[$key] = ['in' => 0, 'out' => 0, 'unrealized' => 0];
            $stats[$key]['in'] += (float)$row->total_in;
            $stats[$key]['out'] += (float)$row->total_out;
        }

        // 2. Business Worth Aggregation (Unrealized debt/credit)
        $aggregates = [
            'repairs'    => [DB::table('repair_requests'), 'customer_name', 'quoted_amount', ['is_pay_later' => true], 'submitted_date', 1],
            'forwarding' => [DB::table('repair_requests'), 'forwarded_to', 'service_center_cost', [], 'submitted_date', -1],
            'sales'      => [DB::table('sale_invoices'), 'accounting_entity_id', 'grand_total', ['deleted_at' => null], 'sale_date', 1],
            'purchases'  => [DB::table('purchase_invoices'), 'accounting_entity_id', 'grand_total', ['deleted_at' => null], 'purchase_date', -1],
            'loans'      => [DB::table('loans'), 'accounting_entity_id', 'monthly_installment * total_months', [], 'start_date', 1],
            'airtel'     => [DB::table('airtel_drops'), 'retailer_id', 'airtel_drops.amount', [], 'refill_date', 1]
        ];

        foreach ($aggregates as $type => $config) {
            [$query, $keyCol, $valCol, $wheres, $dateCol, $multiplier] = $config;
            
            $q = clone $query;
            foreach ($wheres as $c => $v) {
                if ($v === null) $q->whereNull($c);
                else $q->where($c, $v);
            }

            // Apply filters based on key type
            if ($type === 'airtel') {
                // Airtel is special: join to retailers to match by name
                $q->join('retailers', 'airtel_drops.retailer_id', '=', 'retailers.id')
                  ->whereIn('retailers.name', $names);
                $selectKey = 'retailers.name';
            } elseif ($keyCol === 'accounting_entity_id') {
                if (empty($ids)) continue;
                $q->whereIn('accounting_entity_id', $ids);
                $selectKey = 'accounting_entity_id';
            } else {
                if (empty($names)) continue;
                $q->whereIn($keyCol, $names);
                $selectKey = $keyCol;
            }

            if ($start) $q->where($dateCol, '>=', $start);
            if ($end) $q->where($dateCol, '<=', $end);

            // Use selectRaw to handle both strings and Expression objects safely
            $data = $q->select([DB::raw("$selectKey as group_key")])
                ->selectRaw("SUM($valCol) as total")
                ->groupBy($selectKey)
                ->get();
            
            foreach ($data as $row) {
                $key = $row->group_key;
                if (!$key) continue;
                if (!isset($stats[$key])) $stats[$key] = ['in' => 0, 'out' => 0, 'unrealized' => 0];
                $stats[$key]['unrealized'] += (float)$row->total * $multiplier;
            }
        }

        return $stats;
    }
}
