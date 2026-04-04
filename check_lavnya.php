<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\AirtelDrop;
use App\Models\Retailer;

$msisdn = '6232134110';
$retailer = Retailer::where('msisdn', $msisdn)->first();

if (!$retailer) {
    echo "Retailer not found for MSISDN $msisdn\n";
    exit;
}

echo "Retailer: " . $retailer->name . " (ID: " . $retailer->id . ")\n";
$drops = AirtelDrop::where('retailer_id', $retailer->id)->orderBy('refill_date')->get();

echo "Total Drops Found: " . $drops->count() . "\n";
echo "ID | Amount | Status | Refill Date | Reason | Next Followup\n";
echo str_repeat("-", 80) . "\n";

foreach ($drops as $d) {
    echo $d->id . " | " . $d->amount . " | " . $d->status . " | " . $d->refill_date . " | " . ($d->reason ?? '-') . " | " . ($d->next_recovery_date ?? '-') . "\n";
}
