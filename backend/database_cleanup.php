<?php

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

echo "Starting database cleanup (including soft-deleted records)...\n";

DB::transaction(function() {
    // 1. Fetch all customer records including soft-deleted ones
    $customers = \App\Models\Customer::withTrashed()->get();

    // 2. Group customers by normalized phone number
    $grouped = [];
    foreach ($customers as $customer) {
        $cleanPhone = rtrim(trim($customer->phone), ',');
        $grouped[$cleanPhone][] = $customer;
    }

    echo "Analyzing " . count($grouped) . " unique normalized phone numbers...\n";

    foreach ($grouped as $phone => $records) {
        // If there's only 1 record, but it is soft-deleted, we can just leave it alone.
        // If it's active, we clean its trailing comma.
        if (count($records) < 2) {
            $record = $records[0];
            if (is_null($record->deleted_at)) {
                $cleanPhone = rtrim(trim($record->phone), ',');
                if ($record->phone !== $cleanPhone) {
                    echo "Cleaning trailing comma for single active Customer ID {$record->id} ({$record->name}): '{$record->phone}' -> '{$cleanPhone}'\n";
                    DB::table('customers')->where('id', $record->id)->update(['phone' => $cleanPhone]);
                }
            }
            continue;
        }

        // We have duplicates (could be multiple active, or combination of active and soft-deleted).
        // Let's choose the best record to keep:
        // Priority: 1. Active with Entity, 2. Active without Entity, 3. Soft-deleted with Entity, 4. Soft-deleted without Entity.
        $bestRecord = null;
        $activeRecords = array_filter($records, fn($r) => is_null($r->deleted_at));

        if (!empty($activeRecords)) {
            // Find active record linked to an entity
            foreach ($activeRecords as $record) {
                $hasEntity = DB::table('entities')
                    ->where('relation_type', 'App\Models\Customer')
                    ->where('relation_id', $record->id)
                    ->exists();
                if ($hasEntity) {
                    $bestRecord = $record;
                    break;
                }
            }
            if (!$bestRecord) {
                $bestRecord = reset($activeRecords); // keep first active
            }
        } else {
            // All are soft-deleted, check if any has an entity
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
            if (!$bestRecord) {
                $bestRecord = $records[0]; // fallback
            }
        }

        $statusStr = is_null($bestRecord->deleted_at) ? "ACTIVE" : "SOFT-DELETED";
        echo "Merging duplicates for phone: '{$phone}' (kept Customer ID: {$bestRecord->id} - {$statusStr})\n";

        // Update all related records from other duplicate customer IDs to point to the kept customer ID
        foreach ($records as $record) {
            if ($record->id === $bestRecord->id) continue;

            $dupStatusStr = is_null($record->deleted_at) ? "ACTIVE" : "SOFT-DELETED";
            echo "  -> Merging {$dupStatusStr} Customer ID {$record->id} into Kept Customer ID {$bestRecord->id}...\n";

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
                    DB::table($table)->where($column, $record->id)->update([$column => $bestRecord->id]);
                }
            }

            if (Schema::hasTable('sim_cards') && Schema::hasColumn('sim_cards', 'sold_to')) {
                DB::table('sim_cards')->where('sold_to', $record->id)->update(['sold_to' => $bestRecord->id]);
            }

            // Force delete (hard delete) the duplicate customer record to completely remove it from index
            DB::table('customers')->where('id', $record->id)->delete();
            echo "  -> Hard Deleted duplicate Customer ID {$record->id}\n";
        }

        // Clean the phone number of the kept customer record
        $cleanPhone = rtrim(trim($bestRecord->phone), ',');
        if ($bestRecord->phone !== $cleanPhone) {
            DB::table('customers')->where('id', $bestRecord->id)->update(['phone' => $cleanPhone]);
            echo "  -> Cleaned phone of kept Customer ID {$bestRecord->id} to '{$cleanPhone}'\n";
        }
    }

    // 3. Clean up the entities table phone numbers (entities table has no unique constraint on phone)
    DB::statement("UPDATE entities SET phone = TRIM(TRAILING ',' FROM phone) WHERE phone LIKE '%,';");
    echo "Cleaned trailing commas from entities table.\n";
});

// 4. Rebuild entities index & recalculate balances to make sure the ledger is perfect
echo "Running master entities and ledger balance reset...\n";
app(App\Http\Controllers\Api\EntityController::class)->hardReset();
echo "Cleanup and merge completed successfully!\n";
