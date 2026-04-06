<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

use App\Models\Retailer;
use App\Models\AirtelDrop;
use App\Models\AirtelRecovery;
use App\Models\User;
use App\Models\ActivityLog;
use App\Traits\RecordsTransactions;

class AirtelRetailerController extends Controller
{
    use RecordsTransactions;
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
                $hasFollowUp = AirtelDrop::where('retailer_id', $r->id)
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

        if (isset($validated['balance']) && !($request->user()->isOwner() || $request->user()->isManager())) {
            $validated['balance'] = 0;
        }

        $retailer = Retailer::create($validated);
        ActivityLog::log('CREATE_RETAILER', $retailer, 'Added retailer: ' . $retailer->name . ' (MSISDN: ' . $retailer->msisdn . ')');

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

        $recovery = AirtelRecovery::create([
            'retailer_id' => $retailer->id,
            'amount' => $validated['amount'],
            'recovered_at' => $recoveredAt,
            'recovery_user_id' => $request->user()->id,
            'notes' => $validated['notes'] ?? null
        ]);

        // Record Transaction
        $this->recordTransaction([
            'type'             => 'IN',
            'category'         => 'AIRTEL_RECOVERY',
            'amount'           => $recovery->amount,
            'payment_mode'     => 'CASH', // Default for now
            'description'      => "Recovery payment from {$retailer->name} (MSISDN: {$retailer->msisdn})",
            'ref_id'           => $recovery->id,
            'transaction_date' => $recovery->recovered_at->toDateString(),
        ]);

        ActivityLog::log('RECORD_RECOVERY', $retailer, 'Recorded recovery of ₹' . number_format($validated['amount']) . ' for ' . $retailer->name);

        // FIFO: Re-evaluate all drops for this retailer based on current cumulative credit
        $totalRecovered = AirtelRecovery::where('retailer_id', $retailer->id)->sum('amount');
        $availableCredit = (float)$totalRecovered - (float)$retailer->balance;

        $allDrops = AirtelDrop::where('retailer_id', $retailer->id)
            ->orderBy('refill_date')
            ->orderBy('created_at')
            ->get();

        foreach ($allDrops as $drop) {
            $dropAmt = (float)$drop->amount;
            if ($availableCredit > 0) {
                if ($availableCredit >= $dropAmt) {
                    $drop->update([
                        'paid_amount' => $dropAmt,
                        'status' => 'recovered',
                        'recovered_at' => $drop->status === 'recovered' ? $drop->recovered_at : $recoveredAt,
                        'recovery_user_id' => $drop->status === 'recovered' ? $drop->recovery_user_id : $request->user()->id
                    ]);
                    $availableCredit -= $dropAmt;
                } else {
                    $drop->update([
                        'paid_amount' => $availableCredit,
                        'status' => 'pending', // Partial recovery still counts as pending
                        'recovered_at' => null,
                        'recovery_user_id' => null
                    ]);
                    $availableCredit = 0;
                }
            } else {
                $drop->update([
                    'paid_amount' => 0,
                    'status' => 'pending', 
                    'recovered_at' => null, 
                    'recovery_user_id' => null
                ]);
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

        if (isset($validated['balance']) && !($request->user()->isOwner() || $request->user()->isManager())) {
            unset($validated['balance']);
        }

        $retailer->update($validated);
        ActivityLog::log('UPDATE_RETAILER', $retailer, 'Updated retailer: ' . $retailer->name . ' (MSISDN: ' . $retailer->msisdn . ')');

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

    public function deleteRecovery(Request $request, $id)
    {
        if ($request->user()->isManager()) {
            return response()->json(['message' => 'Managers cannot delete recovery records'], 403);
        }

        $recovery = \App\Models\AirtelRecovery::findOrFail($id);
        $retailerId = $recovery->retailer_id;
        $retailer = Retailer::find($retailerId);
        $amount = $recovery->amount;
        $recovery->delete();
        
        ActivityLog::log('DELETE_RECOVERY', $retailer, 'Deleted recovery payment of ₹' . number_format($amount) . ' for ' . ($retailer->name ?? 'Unknown'));

        // Re-evaluate FIFO after deletion
        $retailer = Retailer::find($retailerId);
        $totalRecovered = AirtelRecovery::where('retailer_id', $retailerId)->sum('amount');
        $availableCredit = (float)$totalRecovered - (float)$retailer->balance;

        $allDrops = AirtelDrop::where('retailer_id', $retailerId)
            ->orderBy('refill_date')
            ->orderBy('created_at')
            ->get();

        foreach ($allDrops as $drop) {
            $dropAmt = (float)$drop->amount;
            if ($availableCredit > 0) {
                if ($availableCredit >= $dropAmt) {
                    $drop->update([
                        'paid_amount' => $dropAmt,
                        'status' => 'recovered'
                    ]);
                    $availableCredit -= $dropAmt;
                } else {
                    $drop->update([
                        'paid_amount' => $availableCredit,
                        'status' => 'pending',
                        'recovered_at' => null,
                        'recovery_user_id' => null
                    ]);
                    $availableCredit = 0;
                }
            } else {
                $drop->update([
                    'paid_amount' => 0,
                    'status' => 'pending',
                    'recovered_at' => null,
                    'recovery_user_id' => null
                ]);
            }
        }

        return response()->json(null, 204);
    }

    public function bulkDeleteRecoveries(Request $request)
    {
        if ($request->user()->isManager()) {
            return response()->json(['message' => 'Managers cannot delete recovery records'], 403);
        }

        // Delete all recovery records
        \App\Models\AirtelRecovery::truncate();
        
        ActivityLog::log('BULK_DELETE_RECOVERIES', null, 'Cleared ALL recovery payments from the system');
        
        // Reset ALL drops to pending status
        AirtelDrop::query()->update([
            'paid_amount' => 0,
            'status' => 'pending',
            'recovered_at' => null,
            'recovery_user_id' => null
        ]);

        return response()->json(['message' => 'All recovery records have been cleared system-wide.']);
    }

    public function destroy(Request $request, $id)
    {
        if ($request->user()->isManager()) {
            return response()->json(['message' => 'Managers cannot delete retailers'], 403);
        }

        $retailer = Retailer::findOrFail($id);
        $name = $retailer->name;
        $retailer->delete();
        ActivityLog::log('DELETE_RETAILER', null, 'Deleted retailer: ' . $name);
        return response()->json(null, 204);
    }

    public function publicProfile($msisdn)
    {
        $retailer = Retailer::where('msisdn', $msisdn)->firstOrFail();

        $drops = \App\Models\AirtelDrop::where('retailer_id', $retailer->id)
            ->orderByDesc('refill_date')
            ->orderByDesc('created_at')
            ->get();

        $recoveries = \App\Models\AirtelRecovery::where('retailer_id', $retailer->id)
            ->orderByDesc('recovered_at')
            ->orderByDesc('created_at')
            ->get();

        $totalDropAmt = (float)$retailer->drops()->sum('amount');
        $totalRecAmt = (float)$retailer->recoveries()->sum('amount');
        $openingBalance = (float)$retailer->balance;

        $stats = [
            'opening_balance' => $openingBalance,
            'total_dropped' => $totalDropAmt,
            'total_recovered' => $totalRecAmt,
            'total_pending' => ($openingBalance + $totalDropAmt) - $totalRecAmt,
        ];

        return response()->json([
            'retailer' => [
                'name' => $retailer->name,
                'msisdn' => $retailer->msisdn,
                'address' => $retailer->address,
            ],
            'drops' => $drops,
            'recoveries' => $recoveries,
            'stats' => $stats
        ]);
    }
}
