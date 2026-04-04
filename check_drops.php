<?php

require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';

use App\Models\Retailer;
use App\Models\AirtelDrop;
use Illuminate\Support\Facades\DB;

$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

echo "--- Retailers List ---\n";
$retailers = Retailer::all();
foreach ($retailers as $r) {
    $dropsCount = $r->drops()->count();
    $totalAmount = $r->drops()->sum('amount');
    echo "ID: {$r->id} | Name: {$r->name} | MSISDN: {$r->msisdn} | Drops: {$dropsCount} | Total: {$totalAmount}\n";
}

echo "\n--- Orphaned Drops (No Retailer) ---\n";
$orphans = AirtelDrop::whereNotExists(function($query) {
    $query->select(DB::raw(1))
          ->from('retailers')
          ->whereRaw('retailers.id = airtel_drops.retailer_id');
})->count();
echo "Orphaned Drops: {$orphans}\n";

echo "\n--- Recent Drops ---\n";
$recent = AirtelDrop::with('retailer')->orderByDesc('id')->limit(5)->get();
foreach ($recent as $d) {
    echo "Drop ID: {$d->id} | Amount: {$d->amount} | Retailer ID: {$d->retailer_id} | Retailer Name: ".($d->retailer->name ?? 'N/A')."\n";
}
