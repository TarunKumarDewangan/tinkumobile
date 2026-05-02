<?php
require __DIR__ . '/../backend/vendor/autoload.php';
$app = require_once __DIR__ . '/../backend/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;

$duplicates = DB::table('retailers')
    ->select('name', DB::raw('COUNT(*) as count'))
    ->groupBy('name')
    ->having('count', '>', 1)
    ->get();

echo "Duplicate Retailer Names:\n";
print_r($duplicates);

$entities = DB::table('entities')
    ->select('name', DB::raw('COUNT(*) as count'))
    ->groupBy('name')
    ->having('count', '>', 1)
    ->get();

echo "\nDuplicate Entity Names:\n";
print_r($entities);
