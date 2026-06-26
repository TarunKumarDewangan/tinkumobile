<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Remove all Entity records that were auto-created by the SyncsWithMasterEntity
     * trait on the Retailer model. These leaked Airtel retailer data into the main
     * accounting system. This migration is safe to run — it only affects entities
     * whose relation_type = 'App\Models\Retailer'.
     *
     * Also cleans up any orphaned ledger entries for those entity IDs.
     *
     * Run this AFTER deploying the isolation changes.
     */
    public function up(): void
    {
        // 1. Get all entity IDs linked to Retailer model
        $retailerEntityIds = DB::table('entities')
            ->where('relation_type', 'App\\Models\\Retailer')
            ->pluck('id')
            ->toArray();

        if (empty($retailerEntityIds)) {
            return; // Nothing to clean
        }

        // 2. Remove ledger entries for these entities
        DB::table('ledgers')
            ->whereIn('entity_id', $retailerEntityIds)
            ->delete();

        // 3. Remove entity balance cache entries
        DB::table('entity_balances')
            ->whereIn('entity_id', $retailerEntityIds)
            ->delete();

        // 4. Null out accounting_entity_id on transactions referencing these entities
        //    (we don't delete the transactions — they are AIRTEL_RECOVERY type, kept for history)
        DB::table('transactions')
            ->whereIn('accounting_entity_id', $retailerEntityIds)
            ->update(['accounting_entity_id' => null]);

        // 5. Delete the entity records themselves
        DB::table('entities')
            ->where('relation_type', 'App\\Models\\Retailer')
            ->delete();
    }

    /**
     * This cleanup is intentional and irreversible.
     * No rollback provided — entities will be re-created via Entity Manager if needed.
     */
    public function down(): void
    {
        // Intentionally empty — this is a one-way cleanup migration
    }
};
