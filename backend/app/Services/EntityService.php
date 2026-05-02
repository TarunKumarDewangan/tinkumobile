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

        $entityIds = $entities->pluck('id')->toArray();
        $allSearchNames = $entities->pluck('name')->toArray();

        // 1. Get Realized Worth (Transactions)
        $realized = DB::table('transactions')
            ->where(function($q) use ($entityIds, $allSearchNames) {
                $q->whereIn('accounting_entity_id', $entityIds)
                  ->orWhereIn('entity_name', $allSearchNames);
            })
            ->whereNull('deleted_at')
            ->select('accounting_entity_id as entity_id', 'entity_name', 
                DB::raw('SUM(CASE WHEN type = "IN" THEN amount ELSE 0 END) as total_in'),
                DB::raw('SUM(CASE WHEN type = "OUT" THEN amount ELSE 0 END) as total_out')
            )
            ->groupBy('accounting_entity_id', 'entity_name')
            ->get();

        // 2. Get Repair Charges
        $repairCharges = DB::table('repair_requests')
            ->where(function($q) use ($entityIds, $allSearchNames) {
                 $q->whereIn('accounting_entity_id', $entityIds)
                   ->orWhereIn('customer_name', $allSearchNames);
            })
            ->where('is_pay_later', true)
            ->select('accounting_entity_id as entity_id', 'customer_name', DB::raw('SUM(quoted_amount) as total_charge'))
            ->groupBy('accounting_entity_id', 'customer_name')
            ->get();

        // 3. Get Repair Forwarding Dues
        $forwardingDues = DB::table('repair_requests')
            ->whereIn('forwarded_to', $allSearchNames)
            ->select('forwarded_to as entity_name', DB::raw('SUM(service_center_cost) as total_due'))
            ->groupBy('forwarded_to')
            ->get()->keyBy('entity_name');

        // 4. Get Sales Charges
        $salesCharges = DB::table('sale_invoices')
            ->where(function($q) use ($entityIds) {
                $q->whereIn('accounting_entity_id', $entityIds);
            })
            ->whereNull('deleted_at')
            ->select('accounting_entity_id as entity_id', DB::raw('SUM(grand_total) as total_charge'))
            ->groupBy('accounting_entity_id')
            ->get()->keyBy('entity_id');

        // 5. Get Purchase Charges
        $purchaseCharges = DB::table('purchase_invoices')
            ->where(function($q) use ($entityIds) {
                $q->whereIn('accounting_entity_id', $entityIds);
            })
            ->whereNull('deleted_at')
            ->select('accounting_entity_id as entity_id', DB::raw('SUM(grand_total) as total_charge'))
            ->groupBy('accounting_entity_id')
            ->get()->keyBy('entity_id');

        // 6. Get Loan Charges
        $loanCharges = DB::table('loans')
            ->whereIn('accounting_entity_id', $entityIds)
            ->select('accounting_entity_id as entity_id', DB::raw('SUM(monthly_installment * total_months) as total_interest_loan'))
            ->groupBy('accounting_entity_id')
            ->get()->keyBy('entity_id');

        // 7. Get Airtel Charges (Still linked to Retailers, but we can link by name if needed)
        $airtelCharges = DB::table('airtel_drops')
            ->join('retailers', 'airtel_drops.retailer_id', '=', 'retailers.id')
            ->whereIn('retailers.name', $allSearchNames)
            ->select('retailers.name as entity_name', DB::raw('SUM(amount) as total_drop'))
            ->groupBy('retailers.name')
            ->get()->keyBy('entity_name');

        return $entities->map(function ($entity) use ($realized, $repairCharges, $forwardingDues, $salesCharges, $purchaseCharges, $loanCharges, $airtelCharges) {
            $id = $entity->id;
            $name = $entity->name;

            $opening = ($entity->balance_type == 'RECEIVABLE' ? 1 : -1) * $entity->opening_balance;
            
            // Sum up realized from either ID match or Name match
            $matchedRealized = $realized->filter(fn($r) => $r->entity_id == $id || $r->entity_name == $name);
            $inWorth = $matchedRealized->sum('total_in');
            $outWorth = $matchedRealized->sum('total_out');

            $repCharge = $repairCharges->filter(fn($r) => $r->entity_id == $id || $r->customer_name == $name)->sum('total_charge');
            
            $unrealized = $repCharge
                        - ($forwardingDues[$name]->total_due ?? 0)
                        + ($salesCharges[$id]->total_charge ?? 0)
                        - ($purchaseCharges[$id]->total_charge ?? 0)
                        + ($loanCharges[$id]->total_interest_loan ?? 0)
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
