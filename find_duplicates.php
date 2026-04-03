<?php

require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';

use App\Models\Retailer;

$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$name = 'SAHEB MOBILE';
$retailers = Retailer::where('name', 'LIKE', "%{$name}%")->get();

echo "--- Searching for Name: {$name} ---\n";
foreach ($retailers as $r) {
    $c = $r->drops()->count();
    echo "ID: {$r->id} | MSISDN: {$r->msisdn} | Drops: {$c}\n";
}
