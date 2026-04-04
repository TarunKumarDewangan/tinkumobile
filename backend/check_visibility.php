<?php

require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';

use App\Models\Retailer;

$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$id = 875;
$r = Retailer::find($id);

if ($r) {
    echo "Retailer ID 875 Exists!\n";
    echo "Name: {$r->name} | shop_id: {$r->shop_id}\n";
} else {
    echo "Retailer ID 875 DOES NOT EXIST!\n";
}

$user = \App\Models\User::where('email', 'recovery@tinkumobiles.com')->first();
if ($user) {
    echo "Current Logged-in User (likely): {$user->name} | shop_id: {$user->shop_id}\n";
}
