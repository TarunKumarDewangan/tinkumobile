<?php

require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';

use App\Models\Retailer;
use App\Models\AirtelDrop;

$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$msisdn = '9179335224';
$retailers = Retailer::where('msisdn', $msisdn)->get();

echo "--- Searching for MSISDN: {$msisdn} ---\n";
foreach ($retailers as $r) {
    $c = $r->drops()->count();
    echo "Retailer ID: {$r->id} | Name: {$r->name} | Drops: {$c}\n";
}

$drops = AirtelDrop::where('retailer_id', 875)->get();
echo "\n--- Drops for ID 875 ---\n";
foreach ($drops as $d) {
    echo "Drop ID: {$d->id} | Amount: {$d->amount} | Status: {$d->status}\n";
}
