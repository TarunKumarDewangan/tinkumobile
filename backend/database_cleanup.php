<?php

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

echo "Starting database cleanup...\n";

DB::transaction(function() {
    // 1. Fetch all active customers (ignoring soft deletes automatically)
    $customers = \App\Models\Customer::all();

    // 2. Group customers by normalized phone number
    $grouped = [];
    foreach ($customers as $customer) {
        $cleanPhone = rtrim(trim($customer->phone), ',');
        $grouped[$cleanPhone][] = $customer;
    }

    echo "Analyzing " . count($grouped) . " unique normalized phone numbers...\n";

    foreach ($grouped as $phone => $records) {
        if (count($records) < 2) {
            // No duplicates for this phone number. Just clean up the trailing comma if present!
            $record = $records[0];
            $cleanPhone = rtrim(trim($record->phone), ',');
            if ($record->phone !== $cleanPhone) {
                echo "Cleaning trailing comma for single Customer ID {$record->id} ({$record->name}): '{$record->phone}' -> '{$cleanPhone}'\n";
                DB::table('customers')->where('id', $record->id)->update(['phone' => $cleanPhone]);
            }
            continue;
        }

        // We have duplicates! Let's choose the best record to keep.
        // Best record is the one that has an entity link, or fallback to the first one.
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

        if (!$bestRecord) {
            $bestRecord = $records[0];
        }

        echo "Merging duplicates for phone: '{$phone}' (kept Customer ID: {$bestRecord->id})\n";

        // Update all related records from other customers to point to the kept customer
        foreach ($records as $record) {
            if ($record->id === $bestRecord->id) continue;

            echo "  -> Merging Customer ID {$record->id} into {$bestRecord->id}...\n";

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

            // Force delete the duplicate customer record
            DB::table('customers')->where('id', $record->id)->delete();
            echo "  -> Deleted duplicate Customer ID {$record->id}\n";
        }

        // Now that duplicates are gone, clean the phone number on the kept customer record
        $cleanPhone = rtrim(trim($bestRecord->phone), ',');
        if ($bestRecord->phone !== $cleanPhone) {
            DB::table('customers')->where('id', $bestRecord->id)->update(['phone' => $cleanPhone]);
            echo "  -> Cleaned phone of kept Customer ID {$bestRecord->id} to '{$cleanPhone}'\n";
        }
    }

    // 3. Clean up the entities table phone numbers (no unique constraint on entities.phone)
    DB::statement("UPDATE entities SET phone = TRIM(TRAILING ',' FROM phone) WHERE phone LIKE '%,';");
    echo "Cleaned trailing commas from entities table.\n";
});

// 4. Rebuild entities index & recalculate balances to make sure the ledger is perfect
echo "Running master entities and ledger balance reset...\n";
app(App\Http\Controllers\Api\EntityController::class)->hardReset();
echo "Cleanup and merge completed successfully!\n";
