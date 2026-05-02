<?php
require __DIR__ . '/../backend/vendor/autoload.php';
$app = require_once __DIR__ . '/../backend/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Services\ReportingService;
use Illuminate\Support\Facades\DB;

$service = new ReportingService();
$names = ['SAHEB MOBILE'];
$ids = DB::table('retailers')->where('name', 'SAHEB MOBILE')->pluck('id')->toArray();

echo "Testing SAHEB MOBILE (ID: " . implode(',', $ids) . ")\n";

$stats = $service->getAggregatedMovements($ids, $names);
print_r($stats);
