<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Get all customer phone numbers that are duplicated
        $duplicates = DB::table('customers')
            ->select('phone')
            ->whereNull('deleted_at')
            ->groupBy('phone')
            ->havingRaw('COUNT(*) > 1')
            ->pluck('phone');

        foreach ($duplicates as $phone) {
            // Get all active customer records with this phone number
            $records = DB::table('customers')
                ->where('phone', $phone)
                ->whereNull('deleted_at')
                ->orderBy('id', 'asc')
                ->get();

            // Find if any of these are linked to an entity
            $bestRecord = null;
            foreach ($records as $record) {
                $hasEntity = DB::table('entities')
                    ->where('relation_type', 'App\Models\Customer')
                    ->where('relation_id', $record->id)
                    ->exists();
                if ($hasEntity) {
                    $bestRecord = $record;
                    break;
                }
            }

            // Fallback to the first record if none are linked to an entity
            if (!$bestRecord) {
                $bestRecord = $records->first();
            }

            // Deduplicate other records by transferring their transactions and deleting them
            foreach ($records as $record) {
                if ($record->id === $bestRecord->id) {
                    continue;
                }

                // Transfer related data to the best record
                $tablesToUpdate = [
                    'sale_invoices' => 'customer_id',
                    'repair_requests' => 'customer_id',
                    'recharge_sales' => 'customer_id',
                    'loans' => 'customer_id',
                    'old_mobile_purchases' => 'customer_id',
                    'follow_ups' => 'customer_id',
                    'customer_events' => 'customer_id',
                ];

                foreach ($tablesToUpdate as $table => $column) {
                    if (Schema::hasTable($table)) {
                        DB::table($table)
                            ->where($column, $record->id)
                            ->update([$column => $bestRecord->id]);
                    }
                }

                // Update sim_cards where sold_to is used
                if (Schema::hasTable('sim_cards') && Schema::hasColumn('sim_cards', 'sold_to')) {
                    DB::table('sim_cards')
                        ->where('sold_to', $record->id)
                        ->update(['sold_to' => $bestRecord->id]);
                }

                // Force delete the duplicate customer record to make sure it doesn't show in autocomplete
                DB::table('customers')->where('id', $record->id)->delete();
            }
        }
    }

    public function down(): void
    {
        // No rolling back of deduplication as it merges duplicates and keeps data intact.
    }
};
