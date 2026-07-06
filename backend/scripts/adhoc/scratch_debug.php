<?php

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';

$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$products = \App\Models\Product::with('category')
    ->where(function($q) {
        $q->where('name', 'like', '%VIVO%')
          ->orWhere('name', 'like', '%V70%')
          ->orWhere('name', 'like', '%Y05%')
          ->orWhere('name', 'like', '%T4X%');
    })
    ->get();

foreach ($products as $p) {
    $catName = $p->category ? $p->category->name : 'N/A';
    echo "ID: {$p->id} | Name: {$p->name} | Category: {$catName} | SKU: {$p->sku}\n";
}

