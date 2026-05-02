<?php
require __DIR__ . '/../backend/vendor/autoload.php';
$app = require_once __DIR__ . '/../backend/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;

echo "Checking Retailers with name SAHEB MOBILE:\n";
$retailers = DB::table('retailers')->where('name', 'SAHEB MOBILE')->get();
print_r($retailers);

echo "\nChecking Entities with name SAHEB MOBILE:\n";
$entities = DB::table('entities')->where('name', 'SAHEB MOBILE')->get();
print_r($entities);
