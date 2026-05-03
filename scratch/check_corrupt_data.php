<?php
require __DIR__ . '/../backend/vendor/autoload.php';
$app = require_once __DIR__ . '/../backend/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Retailer;
use App\Models\Entity;
use App\Models\EntityBalance;
use Illuminate\Support\Facades\DB;

echo "=== CHECKING FOR CORRUPT DATA SOURCES ===\n";

$hugeRetailers = Retailer::where('balance', '>', 1000000)->get();
echo "Retailers with balance > 1M: " . $hugeRetailers->count() . "\n";
foreach ($hugeRetailers as $r) {
    echo "  - {$r->name} (MSISDN: {$r->msisdn}): ₹" . number_format($r->balance) . "\n";
}

$hugeEntities = Entity::where('opening_balance', '>', 1000000)->get();
echo "\nEntities with opening_balance > 1M: " . $hugeEntities->count() . "\n";
foreach ($hugeEntities as $e) {
    echo "  - {$e->name}: ₹" . number_format($e->opening_balance) . "\n";
}

$manualEntities = Entity::whereNull('relation_id')->get();
echo "\nManual Entities (No Relation): " . $manualEntities->count() . "\n";
foreach ($manualEntities as $e) {
    echo "  - {$e->name} ({$e->type})\n";
}

$hugeBalances = EntityBalance::where('net_balance', '>', 1000000)->orWhere('net_balance', '<', -1000000)->get();
echo "\nCached Balances > 1M: " . $hugeBalances->count() . "\n";

$hugeDrops = DB::table('airtel_drops')->where('amount', '>', 1000000)->get();
echo "\nHuge Drops (> 1M): " . $hugeDrops->count() . "\n";
foreach ($hugeDrops as $d) {
    echo "  - ID: {$d->id} | Amount: ₹" . number_format($d->amount) . "\n";
}

echo "\n=== SUMMARY ===\n";
echo "Total Retailers: " . Retailer::count() . "\n";
echo "Total Entities: " . Entity::count() . "\n";
echo "Total Cached Balances: " . EntityBalance::count() . "\n";
