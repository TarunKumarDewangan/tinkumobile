<?php
require __DIR__ . '/../backend/vendor/autoload.php';
$app = require_once __DIR__ . '/../backend/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;

// The live server data is different from local.
// Check all entity_balances with big values
echo "All entity_balances values:\n";
$all = DB::table('entity_balances')->orderByDesc('net_balance')->take(10)->get();
foreach ($all as $b) {
    $e = DB::table('entities')->where('id', $b->entity_id)->first();
    echo "  ID:{$b->entity_id} | Entity: " . ($e->name ?? '???') . " | net: {$b->net_balance} | unrealized: {$b->unrealized} | in: {$b->in_worth} | out: {$b->out_worth}\n";
}

echo "\nTotal entity_balances rows: " . DB::table('entity_balances')->count() . "\n";
echo "Total entities rows: " . DB::table('entities')->count() . "\n";
echo "Total retailers rows: " . DB::table('retailers')->count() . "\n";
echo "Total airtel_drops rows: " . DB::table('airtel_drops')->count() . "\n";
echo "Total airtel_recoveries rows: " . DB::table('airtel_recoveries')->count() . "\n";
echo "Total transactions rows: " . DB::table('transactions')->count() . "\n";

// Check EntityService calculateBalances for entity 639 (9752811365) live
echo "\n=== EntityService for 9752811365 (entity 639) ===\n";
$entity639 = \App\Models\Entity::find(639);
if ($entity639) {
    $service = app(\App\Services\EntityService::class);
    $result = $service->calculateBalances(collect([$entity639]));
    $calc = $result->first();
    echo "Result: in={$calc->in_worth} | out={$calc->out_worth} | unrealized={$calc->unrealized} | net={$calc->net_balance}\n";
} else {
    echo "Entity 639 not found in local DB\n";
}

// What does Entity::calculateBalances return for 639?
echo "\n=== Entity::calculateBalances (static) for 639 ===\n";
if ($entity639) {
    $result2 = \App\Models\Entity::calculateBalances(collect([$entity639]));
    $calc2 = $result2->first();
    echo "Result: in={$calc2->in_worth} | out={$calc2->out_worth} | unrealized={$calc2->unrealized} | net={$calc2->net_balance}\n";
}
