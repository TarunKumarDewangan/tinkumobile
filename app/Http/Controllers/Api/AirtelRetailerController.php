<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

use App\Models\Retailer;

class AirtelRetailerController extends Controller
{
    public function index(Request $request)
    {
        $query = Retailer::query();

        if ($request->search) {
            $query->where(function($q) use ($request) {
                $q->where('name', 'like', "%{$request->search}%")
                  ->orWhere('msisdn', 'like', "%{$request->search}%");
            });
        }

        $retailers = $query->orderBy('name')->paginate(20);
        
        $retailers->getCollection()->transform(function($r) {
            $r->pending_balance = (float)\App\Models\AirtelDrop::where('retailer_id', $r->id)
                ->where('status', 'pending')
                ->sum('amount');
            return $r;
        });

        return response()->json($retailers);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:191',
            'msisdn' => 'required|string|max:15|unique:retailers,msisdn',
            'address' => 'nullable|string',
            'shop_id' => 'required|integer'
        ]);

        $retailer = Retailer::create($validated);
        return response()->json($retailer, 201);
    }

    public function show($id)
    {
        $retailer = Retailer::findOrFail($id);

        // Explicitly load drops to ensure zero-blank issues are resolved
        $drops = \App\Models\AirtelDrop::where('retailer_id', $retailer->id)
            ->with('recoveryUser')
            ->orderByDesc('refill_date')
            ->orderByDesc('created_at')
            ->get();
        
        $stats = [
            'total_dropped' => (float)\App\Models\AirtelDrop::where('retailer_id', $retailer->id)->sum('amount'),
            'total_recovered' => (float)\App\Models\AirtelDrop::where('retailer_id', $retailer->id)->where('status', 'recovered')->sum('amount'),
            'total_pending' => (float)\App\Models\AirtelDrop::where('retailer_id', $retailer->id)->where('status', 'pending')->sum('amount'),
        ];
        
        // Append current pending balance for the profile view
        $retailer->pending_balance = $stats['total_pending'];
        $retailer->drops = $drops;

        return response()->json([
            'retailer' => $retailer,
            'stats' => $stats
        ]);
    }

    public function update(Request $request, $id)
    {
        $retailer = Retailer::findOrFail($id);
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:191',
            'msisdn' => 'sometimes|required|string|max:15|unique:retailers,msisdn,' . $retailer->id,
            'address' => 'nullable|string',
        ]);

        $retailer->update($validated);
        return response()->json($retailer);
    }

    public function export()
    {
        $retailers = Retailer::orderBy('name')->get();
        $filename = "airtel_retailers_" . date('Y-m-d') . ".csv";
        
        $headers = [
            "Content-type" => "text/csv",
            "Content-Disposition" => "attachment; filename=$filename",
            "Pragma" => "no-cache",
            "Cache-Control" => "must-revalidate, post-check=0, pre-check=0",
            "Expires" => "0"
        ];

        $columns = ['NAME', 'MSISDN', 'ADDRESS'];

        $callback = function() use($retailers, $columns) {
            $file = fopen('php://output', 'w');
            fputcsv($file, $columns);

            foreach ($retailers as $retailer) {
                fputcsv($file, [
                    $retailer->name,
                    $retailer->msisdn,
                    $retailer->address
                ]);
            }

            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }

    public function destroy($id)
    {
        $retailer = Retailer::findOrFail($id);
        $retailer->delete();
        return response()->json(null, 204);
    }
}
