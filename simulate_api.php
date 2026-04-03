<?php

require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';

use App\Models\Retailer;
use App\Http\Controllers\Api\AirtelRetailerController;
use Illuminate\Http\Request;

$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$id = 875;
$retailer = Retailer::find($id);

if (!$retailer) {
    die("Retailer 875 not found\n");
}

$controller = new AirtelRetailerController();
$response = $controller->show($retailer);

echo json_encode($response->getData(), JSON_PRETTY_PRINT);
