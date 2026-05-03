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

$hugeRetailers = Retailer::where('balance', '>', 1000000)
    ->get();
echo "Retailers with huge balance/opening: " . $hugeRetailers->count() . "\n";
foreach ($hugeRetailers as $r) {
    echo "  - {$r->name}: Bal: ₹" . number_format($r->balance) . " | Opening: ₹" . number_format($r->opening_balance) . "\n";
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

$hugeTransactions = DB::table('transactions')->where('amount', '>', 1000000)->get();
echo "\nHuge Transactions (> 1M): " . $hugeTransactions->count() . "\n";
foreach ($hugeTransactions as $t) {
    echo "  - ID: {$t->id} | Amount: ₹" . number_format($t->amount) . " | Name: {$t->entity_name}\n";
}

$hugeRepairs = DB::table('repair_requests')->where('quoted_amount', '>', 1000000)->get();
echo "\nHuge Repairs (> 1M): " . $hugeRepairs->count() . "\n";
foreach ($hugeRepairs as $r) {
    echo "  - ID: {$r->id} | Amount: ₹" . number_format($r->quoted_amount) . " | Name: {$r->customer_name}\n";
}

$hugeSales = DB::table('sale_invoices')->where('grand_total', '>', 1000000)->get();
echo "\nHuge Sales (> 1M): " . $hugeSales->count() . "\n";
foreach ($hugeSales as $s) {
    echo "  - ID: {$s->id} | Amount: ₹" . number_format($s->grand_total) . " | Name: {$s->customer_name}\n";
}

$hugeLoans = DB::table('loans')->whereRaw('monthly_installment * total_months > 1000000')->get();
echo "\nHuge Loans (> 1M): " . $hugeLoans->count() . "\n";
foreach ($hugeLoans as $l) {
    echo "  - ID: {$l->id} | Installment: {$l->monthly_installment} | Months: {$l->total_months} | Total: ₹" . number_format($l->monthly_installment * $l->total_months) . "\n";
}

echo "\n=== ABSOLUTE TOTALS ===\n";
echo "Total Airtel Drops: " . number_format(DB::table('airtel_drops')->sum('amount')) . "\n";
echo "Total Transactions IN: " . number_format(DB::table('transactions')->where('type', 'IN')->sum('amount')) . "\n";
echo "Total Transactions OUT: " . number_format(DB::table('transactions')->where('type', 'OUT')->sum('amount')) . "\n";
echo "Total Sales: " . number_format(DB::table('sale_invoices')->sum('grand_total')) . "\n";
echo "Total Purchases: " . number_format(DB::table('purchase_invoices')->sum('grand_total')) . "\n";
echo "Total Repairs: " . number_format(DB::table('repair_requests')->sum('quoted_amount')) . "\n";
echo "Total Loans: " . number_format(DB::table('loans')->select(DB::raw('SUM(monthly_installment * total_months) as total'))->first()->total) . "\n";

echo "\n=== SUMMARY ===\n";
echo "Total Retailers: " . Retailer::count() . "\n";
echo "Total Entities: " . Entity::count() . "\n";
echo "Total Cached Balances: " . EntityBalance::count() . "\n";
