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
            $totalDropped = (float)$r->balance + \App\Models\AirtelDrop::where('retailer_id', $r->id)->sum('amount');
            $totalRecovered = \App\Models\AirtelRecovery::where('retailer_id', $r->id)->sum('amount');
            $r->pending_balance = $totalDropped - $totalRecovered;
            
            // Simplified status for the list
            if ($r->pending_balance <= 0) {
                $r->status = 'FULL RECOVERED';
            } else {
                $hasFollowUp = \App\Models\AirtelDrop::where('retailer_id', $r->id)
                    ->where('status', 'pending')
                    ->whereNotNull('next_recovery_date')
                    ->exists();
                $r->status = $hasFollowUp ? 'FOLLOW UP' : 'PENDING';
            }
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
            'shop_id' => 'required|integer',
            'balance' => 'nullable|numeric'
        ]);

        if (isset($validated['balance']) && !$request->user()->is_owner) {
            $validated['balance'] = 0;
        }

        $retailer = Retailer::create($validated);
        return response()->json($retailer, 201);
    }

    public function show($id)
    {
        $retailer = Retailer::with(['recoveries' => function($q) {
            $q->orderByDesc('recovered_at')->orderByDesc('created_at');
        }, 'recoveries.recoveryUser'])->findOrFail($id);

        $drops = \App\Models\AirtelDrop::where('retailer_id', $retailer->id)
            ->with('recoveryUser')
            ->orderByDesc('refill_date')
            ->orderByDesc('created_at')
            ->get();
        
        $totalDropAmt = (float)$retailer->drops()->sum('amount');
        $totalRecAmt = (float)$retailer->recoveries()->sum('amount');
        
        $stats = [
            'opening_balance' => (float)$retailer->balance,
            'total_dropped' => $totalDropAmt,
            'total_recovered' => $totalRecAmt,
            'total_pending' => ((float)$retailer->balance + $totalDropAmt) - $totalRecAmt,
        ];
        
        // Simplified status logic
        if ($stats['total_pending'] <= 0) {
            $retailer->status = 'FULL RECOVERED';
        } else {
            $hasFollowUp = \App\Models\AirtelDrop::where('retailer_id', $retailer->id)
                ->where('status', 'pending')
                ->whereNotNull('next_recovery_date')
                ->exists();
            $retailer->status = $hasFollowUp ? 'FOLLOW UP' : 'PENDING';
        }

        $retailer->pending_balance = $stats['total_pending'];
        $retailer->drops = $drops;

        return response()->json([
            'retailer' => $retailer,
            'stats' => $stats
        ]);
    }

    public function recordRecovery(Request $request, $id)
    {
        $retailer = Retailer::findOrFail($id);
        $validated = $request->validate([
            'amount' => 'required|numeric|min:0.01',
            'recovered_at' => 'nullable|date',
            'notes' => 'nullable|string|max:191'
        ]);

        $recoveredAt = $validated['recovered_at'] ?? now();

        $recovery = \App\Models\AirtelRecovery::create([
            'retailer_id' => $retailer->id,
            'amount' => $validated['amount'],
            'recovered_at' => $recoveredAt,
            'recovery_user_id' => $request->user()->id,
            'notes' => $validated['notes'] ?? null
        ]);

        // FIFO: Re-evaluate all drops for this retailer based on current cumulative credit
        $totalRecovered = \App\Models\AirtelRecovery::where('retailer_id', $retailer->id)->sum('amount');
        $availableCredit = (float)$totalRecovered - (float)$retailer->balance;

        $allDrops = \App\Models\AirtelDrop::where('retailer_id', $retailer->id)
            ->orderBy('refill_date')
            ->orderBy('created_at')
            ->get();

        foreach ($allDrops as $drop) {
            if ($availableCredit >= (float)$drop->amount) {
                $drop->update([
                    'status' => 'recovered',
                    'recovered_at' => $drop->status === 'recovered' ? $drop->recovered_at : $recoveredAt,
                    'recovery_user_id' => $drop->status === 'recovered' ? $drop->recovery_user_id : $request->user()->id
                ]);
                $availableCredit -= (float)$drop->amount;
            } else {
                $drop->update(['status' => 'pending', 'recovered_at' => null, 'recovery_user_id' => null]);
            }
        }

        return response()->json($recovery, 201);
    }

    public function update(Request $request, $id)
    {
        $retailer = Retailer::findOrFail($id);
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:191',
            'msisdn' => 'sometimes|required|string|max:15|unique:retailers,msisdn,' . $retailer->id,
            'address' => 'nullable|string',
            'balance' => 'nullable|numeric'
        ]);

        if (isset($validated['balance']) && !$request->user()->is_owner) {
            unset($validated['balance']);
        }

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

    public function deleteRecovery($id)
    {
        $recovery = \App\Models\AirtelRecovery::findOrFail($id);
        
        // Mark drops that were covered by this recovery date back to pending
        \App\Models\AirtelDrop::where('retailer_id', $recovery->retailer_id)
            ->where('status', 'recovered')
            ->where('recovered_at', $recovery->recovered_at)
            ->update(['status' => 'pending', 'recovered_at' => null, 'recovery_user_id' => null]);

        $recovery->delete();
        return response()->json(null, 204);
    }

    public function bulkDeleteRecoveries(Request $request)
    {
        // Delete all recovery records
        \App\Models\AirtelRecovery::truncate();
        
        // Reset ALL drops to pending status
        \App\Models\AirtelDrop::query()->update([
            'status' => 'pending',
            'recovered_at' => null,
            'recovery_user_id' => null
        ]);

        return response()->json(['message' => 'All recovery records have been cleared system-wide.']);
    }

    public function destroy($id)
    {
        $retailer = Retailer::findOrFail($id);
        $retailer->delete();
        return response()->json(null, 204);
    }
}
