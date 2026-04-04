<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

use App\Models\AirtelDrop;
use App\Models\Retailer;
use Carbon\Carbon;

class AirtelDropController extends Controller
{
    public function index(Request $request)
    {
        $request->validate([
            'from_date' => 'nullable|date',
            'to_date' => 'nullable|date',
            'date' => 'nullable|date'
        ]);

        // 1. Start with Retailers that have at least one drop matching the filters
        $query = Retailer::whereHas('drops', function($q) use ($request) {
            if ($request->from_date && $request->to_date) {
                $q->whereBetween('refill_date', [$request->from_date . ' 00:00:00', $request->to_date . ' 23:59:59']);
            } elseif ($request->date) {
                $q->whereDate('refill_date', $request->date);
            }
            if ($request->min_amount) $q->where('amount', '>=', $request->min_amount);
            if ($request->max_amount) $q->where('amount', '<=', $request->max_amount);
            if ($request->follow_up) $q->where(function($qf) { $qf->whereNotNull('reason')->orWhereNotNull('next_recovery_date'); });
        });

        // 2. Search by name or MSISDN
        if ($request->retailer_name) {
            $query->where(function($q) use ($request) {
                $q->where('name', 'like', '%' . $request->retailer_name . '%')
                  ->orWhere('msisdn', 'like', '%' . $request->retailer_name . '%');
            });
        }

        // 3. Apply status filters at the retailer level (using grouping subquery)
        if ($request->status && in_array($request->status, ['pending_only', 'recovered_only'])) {
            $query->whereIn('id', function($sub) use ($request) {
                $sub->select('retailer_id')->from('airtel_drops')->groupBy('retailer_id');
                // We use a subquery to compare total drops vs total recoveries for these retailers
                if ($request->status === 'pending_only') {
                    $sub->havingRaw("(SUM(amount) + (SELECT balance FROM retailers WHERE retailers.id = airtel_drops.retailer_id)) > (SELECT COALESCE(SUM(amount), 0) FROM airtel_recoveries WHERE airtel_recoveries.retailer_id = airtel_drops.retailer_id)");
                } elseif ($request->status === 'recovered_only') {
                    $sub->havingRaw("(SUM(amount) + (SELECT balance FROM retailers WHERE retailers.id = airtel_drops.retailer_id)) <= (SELECT COALESCE(SUM(amount), 0) FROM airtel_recoveries WHERE airtel_recoveries.retailer_id = airtel_drops.retailer_id)");
                }
            });
        }

        // 4. Eager load only the matching drops for these retailers, 
        // PLUS use withSum to get global totals for status calculation
        $query->withSum('drops', 'amount');
        $query->with(['drops' => function($q) use ($request) {
            if ($request->from_date && $request->to_date) {
                $q->whereBetween('refill_date', [$request->from_date . ' 00:00:00', $request->to_date . ' 23:59:59']);
            } elseif ($request->date) {
                $q->whereDate('refill_date', $request->date);
            }
            if ($request->status && in_array($request->status, ['pending', 'recovered'])) {
                $q->where('status', $request->status);
            }
            $q->orderByDesc('refill_date');
        }]);

        // 5. Paginate the RETAILERS (High limit for 'full list' view)
        $retailers = $query->paginate(1000);

        // 6. Transform into a flat structure that the frontend expects
        $retailers->getCollection()->transform(function($r) {
            $filtered_drops = 0;
            $dates = [];
            $latest_reason = null;
            $latest_follow_up = null;

            foreach ($r->drops as $d) {
                $filtered_drops += (float)$d->amount;
                
                $dStr = $d->refill_date->format('d m Y');
                if (!in_array($dStr, $dates)) $dates[] = $dStr;
                
                if ($d->next_recovery_date && (!$latest_follow_up || $d->next_recovery_date > $latest_follow_up)) {
                    $latest_follow_up = $d->next_recovery_date;
                    $latest_reason = $d->reason;
                }
            }

            $total_recovered = (float)\App\Models\AirtelRecovery::where('retailer_id', $r->id)->sum('amount');
            $opening_bal = (float)$r->balance;
            $grand_total_debt = (float)$r->drops_sum_amount + $opening_bal;
            $grand_pending = $grand_total_debt - $total_recovered;

            return [
                'id' => $r->drops->first()?->id,
                'retailer_id' => $r->id,
                'retailer_name' => $r->name,
                'msisdn' => $r->msisdn,
                'total_amount' => $filtered_drops + $opening_bal, // Total is Drops + Opening
                'opening_balance' => $opening_bal,
                'paid_sum' => $total_recovered,
                'has_pending' => $grand_pending > 0,
                'grand_pending' => $grand_pending,
                'dates' => implode(', ', $dates),
                'latest_reason' => $latest_reason,
                'latest_follow_up' => $latest_follow_up ? $latest_follow_up->toDateString() : null
            ];
        });

        return $retailers;
    }

    public function import(Request $request)
    {
        $validated = $request->validate([
            'drops' => 'required|array',
            'drops.*.msisdn' => 'required|string',
            'drops.*.amount' => 'required|numeric',
            'drops.*.refill_date' => 'required|date',
        ]);

        $success = 0;
        $failed = 0;
        $errors = [];

        foreach ($validated['drops'] as $dropData) {
            $retailer = Retailer::where('msisdn', $dropData['msisdn'])->first();
            
            if (!$retailer) {
                $failed++;
                $errors[] = "MSISDN: " . $dropData['msisdn'] . " not found.";
                continue;
            }

            AirtelDrop::create([
                'retailer_id' => $retailer->id,
                'amount' => $dropData['amount'],
                'refill_date' => $dropData['refill_date'],
                'status' => 'pending'
            ]);

            $success++;
        }

        return response()->json([
            'success' => $success,
            'failed' => $failed,
            'errors' => $errors,
            'message' => "Processed $success drops successfully. $failed failed."
        ]);
    }

    public function markAsRecovered(Request $request)
    {
        $validated = $request->validate([
            'recoveries' => 'required|array',
            'recoveries.*.id' => 'required|exists:airtel_drops,id',
            'recoveries.*.amount' => 'required|numeric'
        ]);

        foreach ($validated['recoveries'] as $rec) {
            $drop = AirtelDrop::find($rec['id']);
            if (!$drop || $drop->status === 'recovered') continue;

            $amount = (float)$rec['amount'];
            
            // Create a recovery record in the ledger
            \App\Models\AirtelRecovery::create([
                'retailer_id' => $drop->retailer_id,
                'amount' => $amount,
                'recovered_at' => now(),
                'recovery_user_id' => $request->user()->id,
                'notes' => 'Bulk recover from Dashboard'
            ]);

            // Update the drop status (Simplified: if amount matches, mark recovered)
            if ($amount >= (float)$drop->amount) {
                $drop->update([
                    'status' => 'recovered',
                    'recovered_at' => now(),
                    'recovery_user_id' => $request->user()->id
                ]);
            }
        }

        return response()->json(['message' => 'Recoveries recorded successfully']);
    }

    public function summary(Request $request)
    {
        $query = AirtelDrop::query();

        if ($request->retailer_name) {
            $query->whereHas('retailer', function($q) use ($request) {
                $q->where('name', 'like', '%' . $request->retailer_name . '%')
                  ->orWhere('msisdn', 'like', '%' . $request->retailer_name . '%');
            });
        }

        if ($request->from_date && $request->to_date) {
            $query->whereBetween('refill_date', [$request->from_date . ' 00:00:00', $request->to_date . ' 23:59:59']);
        } elseif ($request->date) {
            $query->whereDate('refill_date', $request->date);
        }

        if ($request->min_amount) {
            $query->where('amount', '>=', $request->min_amount);
        }

        if ($request->max_amount) {
            $query->where('amount', '<=', $request->max_amount);
        }

        if ($request->retailer_id) {
            $query->where('retailer_id', $request->retailer_id);
        }

        // Apply status filters in SQL using retailer-level grouping for the specified period
        if ($request->status && in_array($request->status, ['pending_only', 'recovered_only'])) {
            $query->whereIn('retailer_id', function($sub) use ($request) {
                $sub->select('retailer_id')->from('airtel_drops')->groupBy('retailer_id');
                if ($request->status === 'pending_only') {
                    $sub->havingRaw("(SUM(amount) + (SELECT balance FROM retailers WHERE retailers.id = airtel_drops.retailer_id)) > (SELECT COALESCE(SUM(amount), 0) FROM airtel_recoveries WHERE airtel_recoveries.retailer_id = airtel_drops.retailer_id)");
                } elseif ($request->status === 'recovered_only') {
                    $sub->havingRaw("(SUM(amount) + (SELECT balance FROM retailers WHERE retailers.id = airtel_drops.retailer_id)) <= (SELECT COALESCE(SUM(amount), 0) FROM airtel_recoveries WHERE airtel_recoveries.retailer_id = airtel_drops.retailer_id)");
                }
            });
        }

        // Filtered Opening Balance: sum of 'balance' for retailers who have drops in this query
        $retailerIds = (clone $query)->distinct()->pluck('retailer_id');
        $opening_balance = (float)\App\Models\Retailer::whereIn('id', $retailerIds)->sum('balance');

        $total_recovered_ledger = (float)\App\Models\AirtelRecovery::whereIn('retailer_id', $retailerIds)
            ->when($request->from_date && $request->to_date, function($q) use ($request) {
                $q->whereBetween('recovered_at', [$request->from_date . ' 00:00:00', $request->to_date . ' 23:59:59']);
            })
            ->when($request->date, function($q) use ($request) {
                $q->whereDate('recovered_at', $request->date);
            })
            ->sum('amount');

        $total_dropped = (float)$query->sum('amount');
        
        // Stats reflect the *filtered* query
        return response()->json([
            'total_dropped' => $total_dropped + $opening_balance,
            'total_recovered' => $total_recovered_ledger, 
            'opening_balance' => $opening_balance,
            'pending_recovery' => ($total_dropped + $opening_balance) - $total_recovered_ledger,
            'grand_total_pending' => (float)AirtelDrop::sum('amount') + (float)\App\Models\Retailer::sum('balance') - (float)\App\Models\AirtelRecovery::sum('amount'),
        ]);
    }

    public function bulkDeleteByDate(Request $request)
    {
        if ($request->from_date && $request->to_date) {
            AirtelDrop::whereBetween('refill_date', [$request->from_date . ' 00:00:00', $request->to_date . ' 23:59:59'])->delete();
        } else {
            $request->validate(['date' => 'required|date']);
            AirtelDrop::whereDate('refill_date', $request->date)->delete();
        }

        return response()->json(['message' => 'Selected drops have been cleared']);
    }

    public function destroy(AirtelDrop $drop)
    {
        if ($drop->status === 'recovered') {
            return response()->json(['message' => 'Cannot delete recovered drops'], 422);
        }
        $drop->delete();
        return response()->json(null, 204);
    }

    public function updateFollowUp(Request $request)
    {
        $validated = $request->validate([
            'drop_ids' => 'required|array',
            'drop_ids.*' => 'exists:airtel_drops,id',
            'reason' => 'required|string|max:191',
            'next_recovery_date' => 'required|date'
        ]);

        AirtelDrop::whereIn('id', $validated['drop_ids'])
            ->where('status', 'pending')
            ->update([
                'reason' => $validated['reason'],
                'next_recovery_date' => $validated['next_recovery_date']
            ]);

        return response()->json(['message' => 'Follow-up recorded successfully']);
    }

    public function report(Request $request)
    {
        $request->validate([
            'from_date' => 'nullable|date',
            'to_date' => 'nullable|date'
        ]);

        $from = $request->from_date ?: \Carbon\Carbon::now()->startOfMonth()->toDateString();
        $to = $request->to_date ?: \Carbon\Carbon::now()->toDateString();

        // 1. Daily Performance (Drop-Centric)
        // Shows the status of all drops made between these dates
        $reportQuery = AirtelDrop::selectRaw("
                DATE(refill_date) as date, 
                SUM(amount) as total_dropped,
                SUM(paid_amount) as total_recovered
            ")
            ->whereBetween('refill_date', [$from . ' 00:00:00', $to . ' 23:59:59'])
            ->groupBy('date')
            ->orderBy('date', 'DESC');

        $report = $reportQuery->get();

        // Calculate Global Opening Balance Stats for the top row
        $totalOpeningBal = (float)\App\Models\Retailer::sum('balance');
        // Correctly calculate how much recovery went to opening balances across all retailers
        $openingRecovered = 0;
        $retailersWithBal = \App\Models\Retailer::where('balance', '>', 0)->get();
        foreach ($retailersWithBal as $ret) {
            $retRec = (float)\App\Models\AirtelRecovery::where('retailer_id', $ret->id)->sum('amount');
            $openingRecovered += min((float)$ret->balance, $retRec);
        }

        if ($totalOpeningBal > 0) {
            $report->prepend((object)[
                'date' => 'OPENING',
                'total_dropped' => $totalOpeningBal,
                'total_recovered' => $openingRecovered
            ]);
        }

        // 2. Collections Received (Cash-Flow Centric)
        // Fixed: Use AirtelRecovery model to ensure every rupee received is counted
        $collections = \App\Models\AirtelRecovery::selectRaw("
                DATE(recovered_at) as collection_date, 
                SUM(amount) as amount_collected
            ")
            ->whereBetween('recovered_at', [$from . ' 00:00:00', $to . ' 23:59:59'])
            ->groupBy('collection_date')
            ->orderBy('collection_date', 'DESC')
            ->get();

        // 3. Retailer Pending Summary (Aggregated)
        // Syncs with the dashboard grouping logic for 100% accuracy
        $retailerSummary = Retailer::whereHas('drops', function($q) {
            $q->where('status', 'pending');
        })->orWhere('balance', '>', 0)
        ->get()
        ->map(function($r) {
            $totalDropped = (float)$r->balance + \App\Models\AirtelDrop::where('retailer_id', $r->id)->sum('amount');
            $totalRecovered = \App\Models\AirtelRecovery::where('retailer_id', $r->id)->sum('amount');
            $r->pending_amount = $totalDropped - $totalRecovered;
            return $r;
        })
        ->filter(fn($r) => $r->pending_amount > 0)
        ->sortByDesc('pending_amount')
        ->take(100)
        ->values();

        return response()->json([
            'daily_report' => $report,
            'collections_received' => $collections,
            'retailer_summary' => $retailerSummary
        ]);
    }
}
