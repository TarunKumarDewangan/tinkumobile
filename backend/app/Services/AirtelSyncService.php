<?php

namespace App\Services;

use App\Models\Retailer;
use App\Models\AirtelDrop;
use App\Models\AirtelRecovery;
use Illuminate\Support\Facades\DB;

class AirtelSyncService
{
    /**
     * Synchronize and recalculate drop allocations for a single retailer.
     */
    public function syncRetailer($retailerId)
    {
        $retailer = Retailer::find($retailerId);
        if (!$retailer) return;

        DB::transaction(function() use ($retailer) {
            // 1. Get drops and recoveries in ascending date order
            $drops = AirtelDrop::where('retailer_id', $retailer->id)
                ->orderBy('refill_date', 'asc')
                ->orderBy('id', 'asc')
                ->get();

            $recoveries = AirtelRecovery::where('retailer_id', $retailer->id)
                ->orderBy('recovered_at', 'asc')
                ->orderBy('id', 'asc')
                ->get();

            // 2. Reset drops
            foreach ($drops as $drop) {
                $drop->paid_amount = 0.00;
                $drop->status = 'pending';
                $drop->recovered_at = null;
                $drop->recovery_user_id = null;
            }

            $remainingOpeningBalance = (float)$retailer->balance;

            // 3. Match recoveries
            foreach ($recoveries as $recovery) {
                $remainingRecovery = (float)$recovery->amount;

                // First pay off opening balance
                if ($remainingOpeningBalance > 0) {
                    if ($remainingRecovery >= $remainingOpeningBalance) {
                        $remainingRecovery -= $remainingOpeningBalance;
                        $remainingOpeningBalance = 0;
                    } else {
                        $remainingOpeningBalance -= $remainingRecovery;
                        $remainingRecovery = 0;
                    }
                }

                if ($remainingRecovery <= 0) {
                    continue;
                }

                // Distribute to drops
                foreach ($drops as $drop) {
                    $unpaid = (float)$drop->amount - (float)$drop->paid_amount;
                    if ($unpaid <= 0) {
                        continue;
                    }

                    if ($remainingRecovery >= $unpaid) {
                        $drop->paid_amount = (float)$drop->amount;
                        $drop->status = 'recovered';
                        $drop->recovered_at = $recovery->recovered_at;
                        $drop->recovery_user_id = $recovery->recovery_user_id;
                        $remainingRecovery -= $unpaid;
                    } else {
                        $drop->paid_amount += $remainingRecovery;
                        // Keep status as pending, but record the partial amount paid
                        $remainingRecovery = 0;
                    }

                    if ($remainingRecovery <= 0) {
                        break;
                    }
                }
            }

            // 4. Save drops
            foreach ($drops as $drop) {
                $drop->saveQuietly();
            }
        });
    }

    /**
     * Synchronize and recalculate drop allocations for all retailers.
     */
    public function syncAllRetailers()
    {
        $retailers = Retailer::all();
        foreach ($retailers as $retailer) {
            $this->syncRetailer($retailer->id);
        }
    }
}
