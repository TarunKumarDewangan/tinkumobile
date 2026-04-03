<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);

// Force login a user (ID 1)
$user = \App\Models\User::find(1);
\Illuminate\Support\Facades\Auth::login($user);

use App\Models\Retailer;
use Illuminate\Http\Request;

$request = Request::create('/api/airtel-drops', 'GET', [
    'from_date' => '2025-01-01',
    'to_date' => '2026-04-03'
]);

try {
    $query = Retailer::whereHas('drops', function($q) use ($request) {
        if ($request->from_date && $request->to_date) {
            $q->whereBetween('refill_date', [$request->from_date . ' 00:00:00', $request->to_date . ' 23:59:59']);
        }
    });

    if ($request->status && in_array($request->status, ['pending_only', 'recovered_only', 'partial_only'])) {
        $query->whereIn('id', function($sub) use ($request) {
            $sub->select('retailer_id')->from('airtel_drops')->groupBy('retailer_id');
            if ($request->from_date && $request->to_date) {
                $sub->whereBetween('refill_date', [$request->from_date . ' 00:00:00', $request->to_date . ' 23:59:59']);
            }
            if ($request->status === 'pending_only') {
                $sub->havingRaw("SUM(CASE WHEN status='recovered' THEN 1 ELSE 0 END) = 0");
            }
        });
    }

    echo "SQL: " . $query->toSql() . "\n";
    echo "Bindings: " . json_encode($query->getBindings()) . "\n";
    
    $results = $query->get();
    echo "Found: " . $results->count() . " retailers\n";

} catch (\Exception $e) {
    echo "EXCEPTION: " . $e->getMessage() . "\n";
}
