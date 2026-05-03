<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Transaction;
use App\Models\Entity;

class BackfillTransactionEntities extends Command
{
    protected $signature = 'ledger:backfill-transaction-entities';
    protected $description = 'Auto-create Entity records for transactions that have entity_name but no accounting_entity_id, and re-post them to the ledgers table.';

    public function handle()
    {
        $orphans = Transaction::whereNotNull('entity_name')
            ->whereNull('accounting_entity_id')
            ->get();

        $this->info("Found {$orphans->count()} transactions without an entity link.");

        $created = 0;
        $linked  = 0;

        foreach ($orphans as $tx) {
            $entity = Entity::firstOrCreate(
                ['name' => $tx->entity_name],
                [
                    'type'            => 'CUSTOMER',
                    'opening_balance' => 0,
                    'balance_type'    => 'RECEIVABLE',
                ]
            );

            if ($entity->wasRecentlyCreated) $created++;

            // Link the transaction to the entity
            $tx->accounting_entity_id = $entity->id;
            $tx->save(); // This will trigger PostsToLedger::updated() → posts to ledgers table

            $linked++;
        }

        $this->info("✅ Done. Entities created: {$created}, Transactions linked & posted to ledger: {$linked}.");
    }
}
