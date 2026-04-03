<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);

// Force login a user (ID 1) to bypass auth middleware
$user = \App\Models\User::find(1);
\Illuminate\Support\Facades\Auth::login($user);

// Add shop_id to session if needed for ShopScope
session(['shop_id' => 1]);

try {
    $response = $app->handle(
        $request = Illuminate\Http\Request::create('/api/airtel-drops', 'GET', [
            'from_date' => '2025-01-01',
            'to_date' => '2026-04-03'
        ])
    );
    echo "Status: " . $response->getStatusCode() . "\n";
    if ($response->getStatusCode() === 500) {
        echo "ERROR DETECTED!\n";
        // Get the exception from the response if possible, or check logs
    } else {
        echo substr($response->getContent(), 0, 1000) . "\n";
    }
} catch (\Exception $e) {
    echo "EXCEPTION: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString() . "\n";
}
