<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "Ledger Records: " . \App\Models\Ledger::count() . "\n";
echo "Total Debit: " . \App\Models\Ledger::sum('debit') . "\n";
echo "Total Credit: " . \App\Models\Ledger::sum('credit') . "\n";
