<?php

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

echo "Starting database cleanup...\n";

DB::transaction(function() {
    // 1. Remove trailing commas from all customer phone numbers
    DB::statement("UPDATE customers SET phone = TRIM(TRAILING ',' FROM phone) WHERE phone LIKE '%,';");
    echo "Cleaned trailing commas from customers table.\n";

    DB::statement("UPDATE entities SET phone = TRIM(TRAILING ',' FROM phone) WHERE phone LIKE '%,';");
    echo "Cleaned trailing commas from entities table.\n";

    // 2. Fetch all duplicates (now that phone numbers are cleaned up)
    $duplicates = DB::table('customers')
        ->select('phone')
        ->whereNull('deleted_at')
        ->groupBy('phone')
        ->havingRaw('COUNT(*) > 1')
        ->pluck('phone');

    echo "Found " . count($duplicates) . " duplicate phone numbers.\n";

    foreach ($duplicates as $phone) {
        $records = DB::table('customers')
            ->where('phone', $phone)
            ->whereNull('deleted_at')
            ->orderBy('id', 'asc')
            ->get();

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
            $bestRecord = $records->first();
        }

        echo "Merging duplicate records for phone: {$phone} into Customer ID: {$bestRecord->id}\n";

        // Merge transactions and delete duplicates
        foreach ($records as $record) {
            if ($record->id === $bestRecord->id) continue;

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

            // Force delete duplicate
            DB::table('customers')->where('id', $record->id)->delete();
            echo "Deleted duplicate Customer ID: {$record->id}\n";
        }
    }
});

// 3. Rebuild entities index & recalculate balances to make sure the ledger is perfect
echo "Running master entities and ledger balance reset...\n";
app(App\Http\Controllers\Api\EntityController::class)->hardReset();
echo "Cleanup and merge completed successfully!\n";
