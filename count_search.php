<?php

require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';

use App\Models\Retailer;

$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$search = 'SAHE';
$count = Retailer::where('name', 'LIKE', "%{$search}%")->count();
$results = Retailer::where('name', 'LIKE', "%{$search}%")->orderBy('name')->pluck('name', 'id');

echo "Total matching '{$search}': {$count}\n";
print_r($results);
