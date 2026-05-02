<?php
require __DIR__ . '/../backend/vendor/autoload.php';
$app = require_once __DIR__ . '/../backend/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;
use App\Models\Entity;
use App\Services\EntityService;

// Find ALL entities with huge balance
echo "=== entity_balances with huge values ===\n";
$bigBalances = DB::table('entity_balances')
    ->where(function($q) {
        $q->where('net_balance', '>', 100000)
          ->orWhere('net_balance', '<', -100000)
          ->orWhere('unrealized', '>', 100000)
          ->orWhere('unrealized', '<', -100000);
    })
    ->get();

foreach ($bigBalances as $bal) {
    $e = DB::table('entities')->where('id', $bal->entity_id)->first();
    echo "Name: " . ($e->name ?? 'UNKNOWN') . " | unrealized: {$bal->unrealized} | in: {$bal->in_worth} | out: {$bal->out_worth} | net: {$bal->net_balance}\n";
}

// Trace what's generating unrealized for A TO Z MOBILE CENTER
echo "\n=== Step-by-step EntityService for A TO Z MOBILE CENTER ===\n";
$atoz = Entity::where('name', 'A TO Z MOBILE CENTER')->first();
if ($atoz) {
    $id = $atoz->id;
    $name = $atoz->name;
    echo "Entity ID: $id | Name: $name\n";

    // Check repair_requests where customer_name matches
    $repairs = DB::table('repair_requests')
        ->where('is_pay_later', true)
        ->where(function($q) use ($id, $name) {
            $q->where('accounting_entity_id', $id)
              ->orWhere('customer_name', $name);
        })
        ->select('id', 'quoted_amount', 'customer_name', 'accounting_entity_id')
        ->get();
    echo "Repair charges: " . $repairs->sum('quoted_amount') . "\n";
    foreach ($repairs as $r) {
        echo "  Repair ID: {$r->id} | amount: {$r->quoted_amount} | customer: {$r->customer_name}\n";
    }
    
    // Check airtel_drops via retailers
    $airtel = DB::table('airtel_drops')
        ->join('retailers', 'airtel_drops.retailer_id', '=', 'retailers.id')
        ->where('retailers.name', $name)
        ->select(DB::raw('SUM(airtel_drops.amount) as total'))
        ->first();
    echo "Airtel drops: " . ($airtel->total ?? 0) . "\n";
    
    // Check sale_invoices
    $sales = DB::table('sale_invoices')->whereNull('deleted_at')->where('accounting_entity_id', $id)->sum('grand_total');
    echo "Sales: $sales\n";
    
    // Check purchase_invoices
    $purchases = DB::table('purchase_invoices')->whereNull('deleted_at')->where('accounting_entity_id', $id)->sum('grand_total');
    echo "Purchases: $purchases\n";
    
    // Check loans
    $loans = DB::table('loans')->where('accounting_entity_id', $id)->sum(DB::raw('monthly_installment * total_months'));
    echo "Loans: $loans\n";
    
    $service = app(EntityService::class);
    $result = $service->calculateBalances(collect([$atoz]));
    $calc = $result->first();
    echo "Calculated: in={$calc->in_worth} | out={$calc->out_worth} | unrealized={$calc->unrealized} | net={$calc->net_balance}\n";
} else {
    echo "NOT FOUND!\n";
}
