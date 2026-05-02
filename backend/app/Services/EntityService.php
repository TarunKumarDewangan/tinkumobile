<?php

namespace App\Services;

use App\Models\Entity;
use Illuminate\Support\Facades\DB;

class EntityService
{
    /**
     * Recalculate and sync balance for a single entity.
     */
    public function syncBalance(Entity $entity)
    {
        $balances = $this->calculateBalances(collect([$entity]));
        $calculated = $balances->first();

        DB::table('entity_balances')->updateOrInsert(
            ['entity_id' => $entity->id],
            [
                'in_worth' => $calculated->in_worth,
                'out_worth' => $calculated->out_worth,
                'unrealized' => $calculated->unrealized,
                'net_balance' => $calculated->net_balance,
                'repair_dues' => $calculated->repair_dues,
                'updated_at' => now(),
            ]
        );

        return $calculated;
    }

    /**
     * Recalculate balances for a collection of entities.
     * Ported from Entity::calculateBalances
     */
    public function calculateBalances($entities)
    {
        if ($entities->isEmpty()) return $entities;

        $entityIds = $entities->pluck('id')->filter()->toArray();
        $allSearchNames = $entities->pluck('name')->filter()->toArray();

        // 1. Realized Worth (Transactions)
        $realized = DB::table('transactions')
            ->whereNull('deleted_at')
            ->where(function($q) use ($entityIds, $allSearchNames) {
                if (!empty($entityIds)) $q->whereIn('accounting_entity_id', $entityIds);
                if (!empty($allSearchNames)) $q->orWhereIn('entity_name', $allSearchNames);
            })
            ->select('accounting_entity_id as entity_id', 'entity_name', 
                DB::raw('SUM(CASE WHEN type = "IN" THEN amount ELSE 0 END) as total_in'),
                DB::raw('SUM(CASE WHEN type = "OUT" THEN amount ELSE 0 END) as total_out')
            )
            ->groupBy('accounting_entity_id', 'entity_name')
            ->get();

        // 2. Repair Charges
        $repairCharges = DB::table('repair_requests')
            ->where('is_pay_later', true)
            ->where(function($q) use ($entityIds, $allSearchNames) {
                 if (!empty($entityIds)) $q->whereIn('accounting_entity_id', $entityIds);
                 if (!empty($allSearchNames)) $q->orWhereIn('customer_name', $allSearchNames);
            })
            ->select('accounting_entity_id as entity_id', 'customer_name', DB::raw('SUM(quoted_amount) as total_charge'))
            ->groupBy('accounting_entity_id', 'customer_name')
            ->get();

        // 3. Repair Forwarding Dues (Matched by name)
        $forwardingDues = !empty($allSearchNames) ? DB::table('repair_requests')
            ->whereIn('forwarded_to', $allSearchNames)
            ->select('forwarded_to as entity_name', DB::raw('SUM(service_center_cost) as total_due'))
            ->groupBy('forwarded_to')
            ->get()->keyBy('entity_name') : collect();

        // 4. Sales Charges
        $salesCharges = !empty($entityIds) ? DB::table('sale_invoices')
            ->whereNull('deleted_at')
            ->whereIn('accounting_entity_id', $entityIds)
            ->select('accounting_entity_id as entity_id', DB::raw('SUM(grand_total) as total_charge'))
            ->groupBy('accounting_entity_id')
            ->get()->keyBy('entity_id') : collect();

        // 5. Purchase Charges
        $purchaseCharges = !empty($entityIds) ? DB::table('purchase_invoices')
            ->whereNull('deleted_at')
            ->whereIn('accounting_entity_id', $entityIds)
            ->select('accounting_entity_id as entity_id', DB::raw('SUM(grand_total) as total_charge'))
            ->groupBy('accounting_entity_id')
            ->get()->keyBy('entity_id') : collect();

        // 6. Loan Charges
        $loanCharges = !empty($entityIds) ? DB::table('loans')
            ->whereIn('accounting_entity_id', $entityIds)
            ->select('accounting_entity_id as entity_id', DB::raw('SUM(monthly_installment * total_months) as total_charge'))
            ->groupBy('accounting_entity_id')
            ->get()->keyBy('entity_id') : collect();

        // 7. Airtel Stock Drops (Matched by retailer name)
        $airtelCharges = !empty($allSearchNames) ? DB::table('airtel_drops')
            ->join('retailers', 'airtel_drops.retailer_id', '=', 'retailers.id')
            ->whereIn('retailers.name', $allSearchNames)
            ->select('retailers.name as entity_name', DB::raw('SUM(airtel_drops.amount) as total_drop'))
            ->groupBy('retailers.name')
            ->get()->keyBy('entity_name') : collect();

        return $entities->map(function ($entity) use ($realized, $repairCharges, $forwardingDues, $salesCharges, $purchaseCharges, $loanCharges, $airtelCharges) {
            $id = $entity->id;
            $name = $entity->name;

            $opening = ($entity->balance_type == 'RECEIVABLE' ? 1 : -1) * (float)$entity->opening_balance;
            
            // Sum up realized from either ID match or Name match
            $matchedRealized = $realized->filter(fn($r) => ($id && $r->entity_id == $id) || ($name && $r->entity_name == $name));
            $inWorth = $matchedRealized->sum('total_in');
            $outWorth = $matchedRealized->sum('total_out');

            $repCharge = $repairCharges->filter(fn($r) => ($id && $r->entity_id == $id) || ($name && $r->customer_name == $name))->sum('total_charge');
            
            $unrealized = $repCharge
                        - ($forwardingDues[$name]->total_due ?? 0)
                        + ($salesCharges[$id]->total_charge ?? 0)
                        - ($purchaseCharges[$id]->total_charge ?? 0)
                        + ($loanCharges[$id]->total_charge ?? 0)
                        + ($airtelCharges[$name]->total_drop ?? 0);

            $entity->setAttribute('in_worth', (float)$inWorth);
            $entity->setAttribute('out_worth', (float)$outWorth);
            $entity->setAttribute('unrealized', (float)$unrealized);
            
            $net = (float)($opening + $unrealized - $inWorth + $outWorth);
            $entity->setAttribute('net_balance', $net);
            $entity->setAttribute('repair_dues', (float)$repCharge);

            return $entity;
        });
    }

    /**
     * Sync all entity balances.
     */
    public function syncAll()
    {
        Entity::chunk(100, function ($entities) {
            $calculated = $this->calculateBalances($entities);
            foreach ($calculated as $e) {
                DB::table('entity_balances')->updateOrInsert(
                    ['entity_id' => $e->id],
                    [
                        'in_worth' => $e->in_worth,
                        'out_worth' => $e->out_worth,
                        'unrealized' => $e->unrealized,
                        'net_balance' => $e->net_balance,
                        'repair_dues' => $e->repair_dues,
                        'updated_at' => now(),
                    ]
                );
            }
        });
    }
}
