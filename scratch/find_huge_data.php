<?php
require __DIR__ . '/../backend/vendor/autoload.php';
$app = require_once __DIR__ . '/../backend/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;

$tables = [
    'airtel_drops' => 'amount',
    'airtel_recoveries' => 'amount',
    'sale_invoices' => 'grand_total',
    'purchase_invoices' => 'grand_total',
    'loans' => 'monthly_installment',
    'transactions' => 'amount',
    'entities' => 'opening_balance'
];

foreach ($tables as $table => $col) {
    $max = DB::table($table)->max($col);
    echo "Max $col in $table: $max\n";
    if ($max > 1000000) {
        $row = DB::table($table)->where($col, $max)->first();
        echo "Row with max $col in $table: " . json_encode($row) . "\n";
    }
}

$totalDrops = DB::table('airtel_drops')->sum('amount');
echo "Grand Total Drops: $totalDrops\n";

$totalRec = DB::table('airtel_recoveries')->sum('amount');
echo "Grand Total Recoveries: $totalRec\n";
