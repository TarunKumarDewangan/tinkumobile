<?php
require __DIR__ . '/../backend/vendor/autoload.php';
$app = require_once __DIR__ . '/../backend/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;

$entity = DB::table('entities')->where('name', 'SAHEB MOBILE')->first();
print_r($entity);

$balances = DB::table('entity_balances')->where('entity_id', $entity->id)->first();
print_r($balances);
