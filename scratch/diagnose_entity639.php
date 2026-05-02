<?php
require __DIR__ . '/../backend/vendor/autoload.php';
$app = require_once __DIR__ . '/../backend/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;

// Entity ID 639 (9752811365)
$entityId = 639;
$entityName = '9752811365';

echo "=== Transactions for entity 639 / name '9752811365' ===\n";
$tx = DB::table('transactions')
    ->whereNull('deleted_at')
    ->where(function($q) use ($entityId, $entityName) {
        $q->where('accounting_entity_id', $entityId)
          ->orWhere('entity_name', $entityName);
    })
    ->get();
foreach ($tx as $t) {
    echo "ID: {$t->id} | type: {$t->type} | amount: {$t->amount} | name: {$t->entity_name} | entity_id: {$t->accounting_entity_id}\n";
}

echo "\n=== Airtel Drops by retailer relation_id=634 ===\n";
$drops = DB::table('airtel_drops')->where('retailer_id', 634)->get();
foreach ($drops as $d) {
    echo "Drop ID: {$d->id} | amount: {$d->amount}\n";
}

echo "\nTotal drops: " . DB::table('airtel_drops')->where('retailer_id', 634)->sum('amount') . "\n";

echo "\n=== All Retailers with phone 9752811365 or name 9752811365 ===\n";
$retailers = DB::table('retailers')
    ->where('msisdn', '9752811365')
    ->orWhere('name', '9752811365')
    ->get();
print_r($retailers);

echo "\n=== ReportingService test for this entity ===\n";
$service = app(\App\Services\ReportingService::class);
$result = $service->getAggregatedMovements([$entityId], [$entityName]);
print_r($result);
