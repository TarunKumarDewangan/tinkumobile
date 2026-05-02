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

        // 1. Transactions Aggregation
        $txQuery = DB::table('transactions')
            ->where(function($q) use ($ids, $names) {
                if (!empty($ids)) $q->whereIn('accounting_entity_id', $ids);
                if (!empty($names)) $q->orWhereIn('entity_name', $names);
            })
            ->whereNull('deleted_at');

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
            if (!isset($stats[$key])) $stats[$key] = ['in' => 0, 'out' => 0, 'unrealized' => 0];
            $stats[$key]['in'] += (float)$row->total_in;
            $stats[$key]['out'] += (float)$row->total_out;
        }

        // 2. Business Worth Aggregation (Unrealized)
        $aggregates = [
            'repairs' => [DB::table('repair_requests'), 'customer_name', 'quoted_amount', ['is_pay_later' => true], 'submitted_date'],
            'forwarding' => [DB::table('repair_requests'), 'forwarded_to', 'service_center_cost', [], 'submitted_date', -1],
            'sales' => [DB::table('sale_invoices'), 'accounting_entity_id', 'grand_total', ['deleted_at' => null], 'sale_date'],
            'purchases' => [DB::table('purchase_invoices'), 'accounting_entity_id', 'grand_total', ['deleted_at' => null], 'purchase_date', -1],
            'loans' => [DB::table('loans'), 'accounting_entity_id', 'monthly_installment * total_months', [], 'start_date'],
            'airtel' => [DB::table('airtel_drops')->join('retailers', 'airtel_drops.retailer_id', '=', 'retailers.id'), 'retailers.name', 'amount', [], 'refill_date']
        ];

        foreach ($aggregates as $type => $config) {
            [$query, $keyCol, $valCol, $wheres, $dateCol, $multiplier] = array_pad($config, 6, 1);
            
            $q = clone $query;
            foreach ($wheres as $c => $v) {
                if ($v === null) $q->whereNull($c);
                else $q->where($c, $v);
            }

            if (strpos($keyCol, '.') !== false || $keyCol !== 'accounting_entity_id') {
                 $q->whereIn($keyCol, $names);
            } else {
                 $q->whereIn($keyCol, $ids);
            }

            if ($start) $q->where($dateCol, '>=', $start);
            if ($end) $q->where($dateCol, '<=', $end);

            $data = $q->select([
                DB::raw("$keyCol as group_key"),
                DB::raw("SUM($valCol) as total")
            ])->groupBy($keyCol)->get();
            
            foreach ($data as $row) {
                $key = $row->group_key;
                if (!isset($stats[$key])) $stats[$key] = ['in' => 0, 'out' => 0, 'unrealized' => 0];
                $stats[$key]['unrealized'] += (float)$row->total * $multiplier;
            }
        }

        return $stats;
    }
}
