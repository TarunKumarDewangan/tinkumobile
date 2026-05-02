<?php
require __DIR__ . '/../backend/vendor/autoload.php';
$app = require_once __DIR__ . '/../backend/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;
use App\Models\Entity;
use App\Services\EntityService;

echo "=== FULL ACCOUNT SYSTEM ANALYSIS ===\n\n";

// 1. Check DAMAN KIRANA specifically
echo "--- DAMAN KIRANA Deep Trace ---\n";
$retailer = DB::table('retailers')->where('name', 'DAMAN KIRANA')->first();
echo "Retailer: ";
print_r($retailer);

$entity = DB::table('entities')->where('name', 'DAMAN KIRANA')->first();
echo "Entity: ";
print_r($entity);

$drops = DB::table('airtel_drops')->where('retailer_id', $retailer->id)->get();
echo "Total Drops: " . $drops->sum('amount') . " (" . $drops->count() . " drops)\n";

$recoveries = DB::table('airtel_recoveries')->where('retailer_id', $retailer->id)->get();
echo "Total Recoveries from airtel_recoveries: " . $recoveries->sum('amount') . "\n";

// Check transactions for DAMAN KIRANA
$transactions = DB::table('transactions')
    ->whereNull('deleted_at')
    ->where(function($q) use ($entity) {
        $q->where('entity_name', 'DAMAN KIRANA')
          ->orWhere('accounting_entity_id', $entity->id ?? 0);
    })
    ->get();

echo "\nTransactions for DAMAN KIRANA:\n";
foreach ($transactions as $t) {
    echo "  ID: {$t->id} | Type: {$t->type} | Amount: {$t->amount} | Category: {$t->category} | entity_name: {$t->entity_name}\n";
}

echo "\n--- What Entity Ledger 'show()' computes ---\n";
$totalOut = $drops->sum('amount');
$totalIn = $transactions->where('type', 'IN')->sum('amount');
$openingFromEntity = (float)($entity->opening_balance ?? 0);
$openingFromRetailer = (float)($retailer->balance ?? 0);

echo "Drops (out_worth): $totalOut\n";
echo "TX In (in_worth): $totalIn\n";
echo "Entity opening_balance: $openingFromEntity\n";
echo "Retailer balance (real opening): $openingFromRetailer\n";
$liveNet = $openingFromEntity + $totalOut - $totalIn;
echo "Live Net (entity opening + out - in): $liveNet\n";
echo "CORRECT Net should be: " . ($openingFromRetailer + $totalOut - $recoveries->sum('amount')) . "\n";

// 2. Check why Entity Manager shows huge amounts
echo "\n\n=== WHY ENTITY MANAGER SHOWS HUGE AMOUNTS ===\n";
$hugeBal = DB::table('entity_balances')
    ->where(function($q) { $q->where('net_balance', '>', 100000)->orWhere('unrealized', '>', 100000); })
    ->get();
echo "entity_balances table has " . $hugeBal->count() . " huge entries (>100k)\n";
foreach ($hugeBal->take(5) as $b) {
    $e = DB::table('entities')->where('id', $b->entity_id)->first();
    echo "  Entity: " . ($e->name ?? '??') . " | net: {$b->net_balance} | unrealized: {$b->unrealized}\n";
}

// 3. Check EntityService::calculateBalances for DAMAN KIRANA
echo "\n=== EntityService calculation for DAMAN KIRANA ===\n";
if ($entity) {
    $entityModel = Entity::find($entity->id);
    $service = app(EntityService::class);
    $result = $service->calculateBalances(collect([$entityModel]));
    $calc = $result->first();
    echo "in_worth: {$calc->in_worth} | out_worth: {$calc->out_worth} | unrealized: {$calc->unrealized} | net: {$calc->net_balance}\n";
}

// 4. Check how airtel drops are being summed (the key join)
echo "\n=== Airtel join test for DAMAN KIRANA ===\n";
$airtelResult = DB::table('airtel_drops')
    ->join('retailers', 'airtel_drops.retailer_id', '=', 'retailers.id')
    ->where('retailers.name', 'DAMAN KIRANA')
    ->select('retailers.name as entity_name', DB::raw('SUM(airtel_drops.amount) as total_drop'))
    ->groupBy('retailers.name')
    ->first();
echo "Airtel drops sum via join: " . ($airtelResult->total_drop ?? 0) . "\n";

// 5. Check retailers with huge drop amounts
echo "\n=== Which retailer causes huge unrealized? ===\n";
$bigDrops = DB::table('airtel_drops')
    ->join('retailers', 'airtel_drops.retailer_id', '=', 'retailers.id')
    ->select('retailers.name', DB::raw('SUM(airtel_drops.amount) as total'))
    ->groupBy('retailers.name')
    ->having('total', '>', 10000)
    ->get();
echo "Retailers with >10k in drops:\n";
foreach ($bigDrops as $r) {
    echo "  {$r->name}: {$r->total}\n";
}
