<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Retailer;
use App\Models\AirtelDrop;

echo "--- CHECKING RETAILER ID 2 ---\n";
$r2 = Retailer::find(2);
if ($r2) {
    echo "ID: 2 | Name: {$r2->name} | MSISDN: {$r2->msisdn} | Shop: {$r2->shop_id}\n";
    $dropsCount = AirtelDrop::where('retailer_id', 2)->count();
    echo "Drops Count: $dropsCount\n";
} else {
    echo "Retailer ID 2 NOT FOUND\n";
}

echo "\n--- SEARCHING FOR LAVNYA MOBILE ---\n";
$retailers = Retailer::where('name', 'LIKE', '%LAVNYA%')->get();
foreach ($retailers as $r) {
    $drops = AirtelDrop::where('retailer_id', $r->id)->count();
    $balance = AirtelDrop::where('retailer_id', $r->id)->where('status', 'pending')->sum('amount');
    $paid = AirtelDrop::where('retailer_id', $r->id)->where('status', 'recovered')->sum('amount');
    echo "ID: {$r->id} | Name: {$r->name} | MSISDN: {$r->msisdn} | Drops: $drops | Pending: ₹$balance | Paid: ₹$paid\n";
}
