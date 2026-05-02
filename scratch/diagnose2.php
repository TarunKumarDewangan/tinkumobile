<?php
require __DIR__ . '/../backend/vendor/autoload.php';
$app = require_once __DIR__ . '/../backend/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;
use App\Models\Entity;
use App\Services\EntityService;

// Check where the huge balances actually come from
// 1. Find all entity_balances with huge values
echo "=== Entities with unrealized > 100000 ===\n";
$bigUnrealized = DB::table('entity_balances')
    ->where(function($q) {
        $q->where('unrealized', '>', 100000)
          ->orWhere('unrealized', '<', -100000);
    })
    ->get();

foreach ($bigUnrealized as $bal) {
    $e = DB::table('entities')->where('id', $bal->entity_id)->first();
    echo "Entity: " . ($e->name ?? 'UNKNOWN') . " (ID: {$bal->entity_id}) | unrealized: {$bal->unrealized} | net: {$bal->net_balance}\n";
}

echo "\n=== Checking EntityService for entity 639 ===\n";
$entity = Entity::find(639);
if ($entity) {
    $service = app(EntityService::class);
    $result = $service->calculateBalances(collect([$entity]));
    $calculated = $result->first();
    echo "in_worth: " . $calculated->in_worth . "\n";
    echo "out_worth: " . $calculated->out_worth . "\n";
    echo "unrealized: " . $calculated->unrealized . "\n";
    echo "net_balance: " . $calculated->net_balance . "\n";
} else {
    echo "Entity 639 not found\n";
}

echo "\n=== Checking 'A TO Z MOBILE CENTER' specifically ===\n";
$atoz = DB::table('entities')->where('name', 'A TO Z MOBILE CENTER')->first();
print_r($atoz);
if ($atoz) {
    $balance = DB::table('entity_balances')->where('entity_id', $atoz->id)->first();
    print_r($balance);
    
    // Check its airtel drops via retailer join
    $airtelDrops = DB::table('airtel_drops')
        ->join('retailers', 'airtel_drops.retailer_id', '=', 'retailers.id')
        ->where('retailers.name', 'A TO Z MOBILE CENTER')
        ->select('retailers.name', DB::raw('SUM(airtel_drops.amount) as total_drop'))
        ->groupBy('retailers.name')
        ->get();
    echo "Airtel Drops for A TO Z MOBILE CENTER:\n";
    print_r($airtelDrops);
    
    // Check sale_invoices
    $sales = DB::table('sale_invoices')
        ->whereNull('deleted_at')
        ->where('accounting_entity_id', $atoz->id)
        ->sum('grand_total');
    echo "Sales total: $sales\n";
}

echo "\n=== Looking at entity 'A V MOBILE SHOP RANWA' ===\n";
$avmobile = DB::table('entities')->where('name', 'like', '%A V MOBILE%')->get();
print_r($avmobile);
