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
        if ($request->status && in_array($request->status, ['pending_only', 'recovered_only', 'partial_only'])) {
            $query->whereIn('id', function($sub) use ($request) {
                $sub->select('retailer_id')->from('airtel_drops')->groupBy('retailer_id');
                
                if ($request->from_date && $request->to_date) {
                    $sub->whereBetween('refill_date', [$request->from_date . ' 00:00:00', $request->to_date . ' 23:59:59']);
                } elseif ($request->date) {
                    $sub->whereDate('refill_date', $request->date);
                }
                if ($request->min_amount) $sub->where('amount', '>=', $request->min_amount);
                if ($request->max_amount) $sub->where('amount', '<=', $request->max_amount);

                if ($request->status === 'pending_only') {
                    $sub->havingRaw("SUM(CASE WHEN status='recovered' THEN 1 ELSE 0 END) = 0");
                } elseif ($request->status === 'recovered_only') {
                    $sub->havingRaw("SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) = 0");
                } elseif ($request->status === 'partial_only') {
                    $sub->havingRaw("SUM(CASE WHEN status='recovered' THEN 1 ELSE 0 END) > 0 AND SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) > 0");
                }
            });
        }

        // 4. Eager load only the matching drops for these retailers
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
            $total = 0;
            $paid = 0;
            $has_pending = false;
            $dates = [];
            $latest_reason = null;
            $latest_follow_up = null;

            foreach ($r->drops as $d) {
                $amt = (float)$d->amount;
                $total += $amt;
                if ($d->status === 'recovered') $paid += $amt;
                if ($d->status === 'pending') $has_pending = true;
                
                $dStr = $d->refill_date->format('d m Y');
                if (!in_array($dStr, $dates)) $dates[] = $dStr;
                
                if ($d->next_recovery_date && (!$latest_follow_up || $d->next_recovery_date > $latest_follow_up)) {
                    $latest_follow_up = $d->next_recovery_date;
                    $latest_reason = $d->reason;
                }
            }

            return [
                'id' => $r->drops->first()?->id,
                'retailer_id' => $r->id,
                'retailer_name' => $r->name,
                'msisdn' => $r->msisdn,
                'total_amount' => (float)$total,
                'paid_sum' => (float)$paid,
                'has_pending' => $has_pending,
                'dates' => implode(', ', $dates),
                'latest_reason' => $latest_reason,
                'latest_follow_up' => $latest_follow_up ? $latest_follow_up->toDateString() : null
            ];
        });

        return $retailers;
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
        if ($request->status && in_array($request->status, ['pending_only', 'recovered_only', 'partial_only'])) {
            $query->whereIn('retailer_id', function($sub) use ($request) {
                $sub->select('retailer_id')->from('airtel_drops')->groupBy('retailer_id');
                
                if ($request->from_date && $request->to_date) {
                    $sub->whereBetween('refill_date', [$request->from_date . ' 00:00:00', $request->to_date . ' 23:59:59']);
                } elseif ($request->date) {
                    $sub->whereDate('refill_date', $request->date);
                }
                if ($request->min_amount) $sub->where('amount', '>=', $request->min_amount);
                if ($request->max_amount) $sub->where('amount', '<=', $request->max_amount);

                if ($request->status === 'pending_only') {
                    $sub->havingRaw("SUM(CASE WHEN status='recovered' THEN 1 ELSE 0 END) = 0");
                } elseif ($request->status === 'recovered_only') {
                    $sub->havingRaw("SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) = 0");
                } elseif ($request->status === 'partial_only') {
                    $sub->havingRaw("SUM(CASE WHEN status='recovered' THEN 1 ELSE 0 END) > 0 AND SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) > 0");
                }
            });
        }

        // Stats reflect the *filtered* query
        return response()->json([
            'total_dropped' => (float)$query->sum('amount'),
            'total_recovered' => (float)(clone $query)->where('status', 'recovered')->sum('amount'),
            'pending_recovery' => (float)(clone $query)->where('status', 'pending')->sum('amount'),
            'grand_total_pending' => (float)AirtelDrop::where('status', 'pending')->sum('amount'),
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
        $report = AirtelDrop::selectRaw("
                DATE(refill_date) as date, 
                SUM(amount) as total_dropped,
                SUM(CASE WHEN status = 'recovered' THEN amount ELSE 0 END) as total_recovered
            ")
            ->whereBetween('refill_date', [$from . ' 00:00:00', $to . ' 23:59:59'])
            ->groupBy('date')
            ->orderBy('date', 'DESC')
            ->get();

        // 2. Collections Received (Cash-Flow Centric)
        // Shows how much cash was actually collected on each day between these dates
        $collections = AirtelDrop::selectRaw("
                DATE(recovered_at) as collection_date, 
                SUM(amount) as amount_collected
            ")
            ->where('status', 'recovered')
            ->whereBetween('recovered_at', [$from . ' 00:00:00', $to . ' 23:59:59'])
            ->groupBy('collection_date')
            ->orderBy('collection_date', 'DESC')
            ->get();

        // 3. Retailer Pending Summary (Aggregated)
        // Syncs with the dashboard grouping logic for 100% accuracy
        $retailerSummary = Retailer::whereHas('drops', function($q) {
            $q->where('status', 'pending');
        })
        ->withSum(['drops as pending_amount' => function($q) {
            $q->where('status', 'pending');
        }], 'amount')
        ->orderByDesc('pending_amount')
        ->limit(100) // Show top 100 debtors in summary
        ->get();

        return response()->json([
            'daily_report' => $report,
            'collections_received' => $collections,
            'retailer_summary' => $retailerSummary
        ]);
    }
}
