<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

use App\Models\Retailer;
use App\Models\AirtelDrop;
use App\Models\AirtelRecovery;
use App\Models\User;
use App\Models\ActivityLog;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class AirtelRetailerController extends Controller
{

    public function index(Request $request)
    {
        $sortBy = $request->get('sort_by', 'name');
        $order = $request->get('order', 'asc');
        $perPage = $request->get('per_page', 20);

        $query = Retailer::query()
            ->select('retailers.*')
            ->selectRaw('(COALESCE(retailers.balance, 0) + 
                COALESCE((SELECT SUM(amount) FROM airtel_drops WHERE retailer_id = retailers.id AND deleted_at IS NULL), 0) - 
                COALESCE((SELECT SUM(amount) FROM airtel_recoveries WHERE retailer_id = retailers.id AND deleted_at IS NULL), 0)) as pending_balance_calculated');

        if ($request->search) {
            $query->where(function($q) use ($request) {
                $q->where('name', 'like', "%{$request->search}%")
                  ->orWhere('msisdn', 'like', "%{$request->search}%");
            });
        }

        if ($sortBy === 'balance') {
            $query->orderBy('pending_balance_calculated', $order);
        } else {
            $query->orderBy($sortBy === 'name' ? 'name' : 'name', $order);
        }

        if ($perPage === 'all') {
            $retailers = $query->get();
            $retailers->transform(function($r) {
                $r->pending_balance = $r->pending_balance_calculated;
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

        $retailers = $query->paginate((int)$perPage);
        
        $retailers->getCollection()->transform(function($r) {
            $r->pending_balance = $r->pending_balance_calculated;
            
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
        try {
            return DB::transaction(function () use ($request, $id) {
                $retailer = Retailer::findOrFail($id);
                $validated = $request->validate([
                    'amount' => 'required|numeric|min:0.01',
                    'recovered_at' => 'nullable|date',
                    'notes' => 'nullable|string|max:191'
                ]);

                $recoveredAtInput = $validated['recovered_at'] ?? now();
                $recoveredAt = Carbon::parse($recoveredAtInput);

                // Security: Block date modification for non-owners/managers
                $isPowerUser = $request->user()->isOwner() || $request->user()->isManager();
                if (!$isPowerUser) {
                    $recoveredAt = now();
                } elseif ($recoveredAt->isToday() && $recoveredAt->hour === 0 && $recoveredAt->minute === 0) {
                    $recoveredAt = now();
                }

                // Guard: prevent recovery when balance is zero or negative
                $totalDrops = \App\Models\AirtelDrop::where('retailer_id', $retailer->id)->sum('amount');
                $totalRecoveries = \App\Models\AirtelRecovery::where('retailer_id', $retailer->id)->sum('amount');
                $outstandingBalance = $totalDrops - $totalRecoveries;

                /* 
                if ($outstandingBalance <= 0) {
                    return response()->json([
                        'message' => 'No outstanding balance for this retailer. Current balance: ₹' . number_format($outstandingBalance, 2)
                    ], 422);
                }

                if ($validated['amount'] > $outstandingBalance) {
                    return response()->json([
                        'message' => 'Recovery ₹' . number_format($validated['amount'], 2) . ' exceeds outstanding balance ₹' . number_format($outstandingBalance, 2)
                    ], 422);
                }
                */

                $recovery = AirtelRecovery::create([
                    'retailer_id' => $retailer->id,
                    'amount' => $validated['amount'],
                    'recovered_at' => $recoveredAt,
                    'recovery_user_id' => $request->user()->id,
                    'notes' => $validated['notes'] ?? null
                ]);

                ActivityLog::log('RECORD_RECOVERY', $retailer, 'Recorded recovery of ₹' . number_format($validated['amount']) . ' for ' . $retailer->name);

                // Recalculate drop allocations
                app(\App\Services\AirtelSyncService::class)->syncRetailer($retailer->id);

                return response()->json($recovery, 201);
            });
        } catch (\Exception $e) {
            return $this->errorResponse($e, 'Sync error');
        }
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

    public function backup()
    {
        $retailers = Retailer::all();
        $drops = AirtelDrop::all();
        $recoveries = AirtelRecovery::all();

        $data = [
            'timestamp' => now()->toDateTimeString(),
            'retailers' => $retailers,
            'airtel_drops' => $drops,
            'airtel_recoveries' => $recoveries,
        ];

        $filename = "airtel_full_backup_" . date('Y-m-d_His') . ".json";
        
        return response()->json($data)
            ->header('Content-Disposition', "attachment; filename=$filename");
    }

    public function restoreBackup(Request $request)
    {
        if (!$request->user()->hasFullAccess()) {
            return response()->json(['message' => 'Only the owner or administrator can restore backups'], 403);
        }

        $request->validate([
            'backup_file' => 'required|file|mimetypes:application/json,text/plain'
        ]);

        $file = $request->file('backup_file');
        $jsonContent = file_get_contents($file->getRealPath());
        $data = json_decode($jsonContent, true);

        if (!$data || !isset($data['retailers']) || !isset($data['airtel_drops']) || !isset($data['airtel_recoveries'])) {
            return response()->json(['message' => 'Invalid backup file format.'], 422);
        }

        try {
            DB::beginTransaction();

            // Disable foreign key checks (database agnostic)
            \Illuminate\Support\Facades\Schema::disableForeignKeyConstraints();

            // Clear existing tables
            DB::table('airtel_recoveries')->delete();
            DB::table('airtel_drops')->delete();
            DB::table('retailers')->delete();

            // Helper to format ISO dates to MySQL DATETIME
            $formatDate = function($dateString) {
                if (!$dateString) return null;
                try {
                    return \Carbon\Carbon::parse($dateString)->format('Y-m-d H:i:s');
                } catch (\Exception $e) {
                    return null;
                }
            };

            // Format retailer dates
            if (!empty($data['retailers'])) {
                foreach ($data['retailers'] as &$item) {
                    $item['created_at'] = $formatDate($item['created_at']);
                    $item['updated_at'] = $formatDate($item['updated_at']);
                    $item['deleted_at'] = $formatDate($item['deleted_at'] ?? null);
                }
                foreach (array_chunk($data['retailers'], 500) as $chunk) {
                    DB::table('retailers')->insert($chunk);
                }
            }
            
            // Format drop dates
            if (!empty($data['airtel_drops'])) {
                foreach ($data['airtel_drops'] as &$item) {
                    $item['created_at'] = $formatDate($item['created_at']);
                    $item['updated_at'] = $formatDate($item['updated_at']);
                    $item['refill_date'] = $formatDate($item['refill_date'] ?? null);
                    $item['next_recovery_date'] = $formatDate($item['next_recovery_date'] ?? null);
                    $item['recovered_at'] = $formatDate($item['recovered_at'] ?? null);
                }
                foreach (array_chunk($data['airtel_drops'], 500) as $chunk) {
                    DB::table('airtel_drops')->insert($chunk);
                }
            }
            
            // Format recovery dates
            if (!empty($data['airtel_recoveries'])) {
                foreach ($data['airtel_recoveries'] as &$item) {
                    $item['created_at'] = $formatDate($item['created_at']);
                    $item['updated_at'] = $formatDate($item['updated_at']);
                    $item['deleted_at'] = $formatDate($item['deleted_at'] ?? null);
                    $item['recovered_at'] = $formatDate($item['recovered_at'] ?? null);
                }
                foreach (array_chunk($data['airtel_recoveries'], 500) as $chunk) {
                    DB::table('airtel_recoveries')->insert($chunk);
                }
            }

            // Re-enable foreign key checks
            \Illuminate\Support\Facades\Schema::enableForeignKeyConstraints();

            ActivityLog::log('RESTORE_BACKUP', null, 'Restored Airtel data from backup file.');

            DB::commit();

            return response()->json(['message' => 'Backup restored successfully']);
        } catch (\Exception $e) {
            DB::rollBack();
            \Illuminate\Support\Facades\Schema::enableForeignKeyConstraints(); // Ensure it's re-enabled on failure
            return $this->errorResponse($e, 'Restore failed');
        }
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

        // Recalculate drop allocations after deletion
        app(\App\Services\AirtelSyncService::class)->syncRetailer($retailerId);



        return response()->json(null, 204);
    }

    public function bulkDeleteRecoveries(Request $request)
    {
        if (!$request->user()->hasFullAccess()) {
            return response()->json(['message' => 'Only the owner or administrator can clear recovery records'], 403);
        }

        // Delete all recovery records
        \App\Models\AirtelRecovery::truncate();
        
        ActivityLog::log('BULK_DELETE_RECOVERIES', null, 'Cleared ALL recovery payments from the system');
        
        // Reset ALL drops to pending status via sync
        app(\App\Services\AirtelSyncService::class)->syncAllRetailers();

        return response()->json(['message' => 'All recovery records have been cleared system-wide.']);
    }

    public function bulkClearOpeningBalances(Request $request)
    {
        if (!$request->user()->hasFullAccess()) {
            return response()->json(['message' => 'Only the owner or administrator can clear opening balances'], 403);
        }

        Retailer::query()->update(['balance' => 0]);
        
        ActivityLog::log('BULK_CLEAR_OPENING_BALANCES', null, 'Cleared all retailer opening balances');

        // Recalculate drops now that opening balances are zero
        app(\App\Services\AirtelSyncService::class)->syncAllRetailers();

        return response()->json(['message' => 'All opening balances have been cleared']);
    }

    public function bulkFullReset(Request $request)
    {
        if (!$request->user()->hasFullAccess()) {
            return response()->json(['message' => 'Only the owner or administrator can perform a full reset'], 403);
        }

        // 1. Clear Opening Balances
        Retailer::query()->update(['balance' => 0]);

        // 2. Delete All Drops
        AirtelDrop::query()->delete();

        // 3. Delete All Recoveries
        \App\Models\AirtelRecovery::truncate();

        ActivityLog::log('BULK_FULL_RESET', null, 'Performed a FULL SYSTEM RESET of Airtel Daily Drops');

        return response()->json(['message' => 'System has been fully reset (Balances, Drops, and Payments cleared)']);
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
                'id' => $retailer->id,
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
