<?php

// Bootstrap Laravel
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Http;

try {
    echo "Starting test run of pull and restore...\n";

    // 1. Fetch from live website
    $liveUrl = "https://api.tinkumobile.in";
    $email = "owner@tinkumobile.in";
    // We can also just read the backup from local if we had one, but let's see.
    // If the user's test connection worked, let's login and download backup to debug.
    
    // Instead of logging in, let's print the tables and schema to check for anomalies.
    // Let's run a dry-run insert of products, categories, etc.
    echo "Running dry run checks...\n";
    
} catch (\Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString() . "\n";
}
