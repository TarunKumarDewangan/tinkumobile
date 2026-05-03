<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\AirtelRecovery;
use App\Models\Entity;
use App\Services\AccountingService;

class BackfillAirtelRecoveries extends Command
{
    protected $signature = 'ledger:backfill-airtel-recoveries';
    protected $description = 'Backfill all existing Airtel Recovery records into the ledgers table as CREDIT entries.';

    public function handle()
    {
        $accounting = app(AccountingService::class);
        $recoveries = AirtelRecovery::with('retailer')->get();
        $count = 0;
        $skipped = 0;

        foreach ($recoveries as $recovery) {
            if (!$recovery->retailer) {
                $skipped++;
                continue;
            }
            $entity = Entity::where('name', $recovery->retailer->name)->first();
            if (!$entity) {
                $this->warn("No entity found for retailer: {$recovery->retailer->name}");
                $skipped++;
                continue;
            }

            $accounting->post(
                entityId:    $entity->id,
                date:        $recovery->recovered_at?->toDateString() ?? now()->toDateString(),
                voucherType: 'AIRTEL_RECOVERY',
                voucherId:   $recovery->id,
                particulars: 'Airtel Recovery' . ($recovery->notes ? ': ' . $recovery->notes : '') . ' (MSISDN: ' . $recovery->retailer->msisdn . ')',
                debit:       0,
                credit:      $recovery->amount,
                shopId:      null,
                userId:      $recovery->recovery_user_id
            );

            $count++;
        }

        $this->info("✅ Backfilled {$count} recovery entries into the ledger. Skipped: {$skipped}.");
    }
}
