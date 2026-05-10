<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

use App\Models\AirtelDrop;
use App\Models\Retailer;
use App\Models\ActivityLog;
use Carbon\Carbon;

class AirtelDropController extends Controller
{
    protected $transactionService;

    public function __construct(\App\Services\TransactionService $transactionService)
    {
        $this->transactionService = $transactionService;
    }

    public function index(Request $request)
    {
        // 1. Start with Retailers that have at least one drop matching the filters OR have a non-zero balance
        $sortBy = $request->get('sort_by', 'name');
        $order = $request->get('order', 'asc');

        $query = Retailer::query()
            ->select('retailers.*')
            ->selectRaw('(COALESCE(retailers.balance, 0) + 
                COALESCE((SELECT SUM(amount) FROM airtel_drops WHERE retailer_id = retailers.id AND deleted_at IS NULL), 0) - 
                COALESCE((SELECT SUM(amount) FROM airtel_recoveries WHERE retailer_id = retailers.id AND deleted_at IS NULL), 0)) as grand_pending_calculated')
            ->where(function($q) use ($request) {
                $q->whereHas('drops', function($sq) use ($request) {
                    if ($request->from_date && $request->to_date) {
                        $sq->whereBetween('refill_date', [$request->from_date . ' 00:00:00', $request->to_date . ' 23:59:59']);
                    } elseif ($request->date) {
                        $sq->whereDate('refill_date', $request->date);
                    }
                    if ($request->min_amount) $sq->where('amount', '>=', $request->min_amount);
                    if ($request->max_amount) $sq->where('amount', '<=', $request->max_amount);
                    if ($request->follow_up) $sq->where(function($qf) { $qf->whereNotNull('reason')->orWhereNotNull('next_recovery_date'); });
                })
                ->orWhere('balance', '>', 0);
            });

        // 2. Search by name or MSISDN
        if ($request->retailer_name) {
            $query->where(function($q) use ($request) {
                $q->where('name', 'like', '%' . $request->retailer_name . '%')
                  ->orWhere('msisdn', 'like', '%' . $request->retailer_name . '%');
            });
        }

        // Apply Sorting
        if ($sortBy === 'pending') {
            $query->orderBy('grand_pending_calculated', $order);
        } else {
            $query->orderBy('name', $order);
        }

        // 3. Apply status filters at the retailer level (using grouping subquery)
        // 3. Apply status filters at the retailer level
        if ($request->status && in_array($request->status, ['pending_only', 'recovered_only'])) {
            $query->where(function($q) use ($request) {
                $debtSql = "(SELECT COALESCE(SUM(amount), 0) FROM airtel_drops WHERE airtel_drops.retailer_id = retailers.id AND airtel_drops.deleted_at IS NULL) + retailers.balance";
                $paidSql = "(SELECT COALESCE(SUM(amount), 0) FROM airtel_recoveries WHERE airtel_recoveries.retailer_id = retailers.id AND airtel_recoveries.deleted_at IS NULL)";
                if ($request->status === 'pending_only') {
                    $q->whereRaw("$debtSql > $paidSql");
                } else {
                    $q->whereRaw("$debtSql <= $paidSql");
                }
            });
        }

        // 4. Filter by Payment Mode (Search in notes)
        if ($request->payment_mode) {
            $query->whereHas('recoveries', function($q) use ($request) {
                $q->where('notes', 'like', $request->payment_mode . '%');
            });
        }

        // 5. Eager load only the matching drops for these retailers, 
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
        $retailers = $query->withSum('recoveries as total_recovered', 'amount')->paginate(1000);

        // 6. Transform into a flat structure that the frontend expects
        $retailers->getCollection()->transform(function($r) {
            $filtered_drops = 0;
            $dates = [];
            $latest_reason = null;
            $latest_follow_up = null;

            // Sort drops by date desc to get latest first
            $sorted_drops = $r->drops->sortByDesc('refill_date');

            foreach ($sorted_drops as $d) {
                $filtered_drops += (float)$d->amount;
                
                $dStr = $d->refill_date->format('d m Y');
                if (count($dates) < 2 && !in_array($dStr, $dates)) $dates[] = $dStr;
                
                if ($d->next_recovery_date && (!$latest_follow_up || $d->next_recovery_date > $latest_follow_up)) {
                    $latest_follow_up = $d->next_recovery_date;
                    $latest_reason = $d->reason;
                }
            }

            $total_recovered_all = (float)($r->total_recovered ?? 0);
            
            $opening_bal = (float)$r->balance;
            $grand_total_debt = (float)$r->drops_sum_amount + $opening_bal;
            $grand_pending = $grand_total_debt - $total_recovered_all;
            
            // Generate breakdown - Filtered by the SAME range as the report
            // Note: This still hits the DB for breakdown, but the heavy sum is now eager loaded.
            $breakdown = $r->recoveries()
                ->when(request('from_date') && request('to_date'), function($q) {
                     $q->whereBetween('recovered_at', [request('from_date') . ' 00:00:00', request('to_date') . ' 23:59:59']);
                })
                ->when(request('date'), function($q) {
                     $q->whereDate('recovered_at', request('date'));
                })
                ->selectRaw('notes, SUM(amount) as total')
                ->groupBy('notes')
                ->get()
                ->map(function($rc) {
                    $mode = explode(' - ', $rc->notes)[0]; 
                    return "$mode: " . number_format($rc->total);
                })
                ->unique() 
                ->implode(', ');

            return [
                'id' => $r->drops->first()?->id,
                'retailer_id' => $r->id,
                'retailer_name' => $r->name,
                'msisdn' => $r->msisdn,
                'filtered_drops' => $filtered_drops,
                'opening_balance' => $opening_bal,
                'total_amount' => $filtered_drops + $opening_bal, 
                'paid_sum' => $total_recovered_all, // Changed to overall total for consistency
                'has_pending' => $grand_pending > 0.01, // Use epsilon for float safety
                'grand_pending' => $grand_pending,
                'dates' => implode(', ', $dates),
                'latest_reason' => $latest_reason,
                'recovery_breakdown' => $breakdown,
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
        $duplicates = 0;
        $errors = [];

        foreach ($validated['drops'] as $dropData) {
            $retailer = Retailer::where('msisdn', $dropData['msisdn'])->first();
            
            if (!$retailer) {
                $failed++;
                $errors[] = "MSISDN: " . $dropData['msisdn'] . " not found.";
                continue;
            }

            // Duplicate Check: Same retailer, same amount, same exact refill_date
            $exists = AirtelDrop::where('retailer_id', $retailer->id)
                ->where('amount', $dropData['amount'])
                ->where('refill_date', $dropData['refill_date'])
                ->exists();

            if ($exists) {
                $duplicates++;
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
            'duplicates' => $duplicates,
            'errors' => $errors,
            'message' => "Successfully imported $success new drops. $duplicates duplicates skipped. $failed failed."
        ]);
    }

    public function importUpi(Request $request)
    {
        $validated = $request->validate([
            'payments' => 'required|array',
            'payments.*.msisdn' => 'required|string',
            'payments.*.amount' => 'required|numeric',
            'payments.*.recovered_at' => 'required|date',
        ]);

        $success = 0;
        $failed = 0;
        $duplicates = 0;
        $errors = [];

        // To run FIFO efficiently, group by retailer
        $retailersToProcess = [];

        foreach ($validated['payments'] as $payment) {
            $retailer = Retailer::where('msisdn', $payment['msisdn'])->first();
            
            if (!$retailer) {
                $failed++;
                $errors[] = "MSISDN: " . $payment['msisdn'] . " not found.";
                continue;
            }

            // Duplicate Check
            $recoveredAt = \Carbon\Carbon::parse($payment['recovered_at']);
            $exists = \App\Models\AirtelRecovery::where('retailer_id', $retailer->id)
                ->where('amount', $payment['amount'])
                ->where('recovered_at', $recoveredAt)
                ->where('notes', 'like', 'DIGITAL%')
                ->exists();

            if ($exists) {
                $duplicates++;
                continue;
            }

            // Create recovery record
            $recovery = \App\Models\AirtelRecovery::create([
                'retailer_id' => $retailer->id,
                'amount' => $payment['amount'],
                'recovered_at' => \Carbon\Carbon::parse($payment['recovered_at']),
                'recovery_user_id' => $request->user()->id,
                'notes' => 'DIGITAL - UPI Direct to Airtel'
            ]);

            // Record Transaction using Service
            $this->transactionService->recordForModel($recovery, [
                'type'             => 'IN',
                'category'         => 'AIRTEL_RECOVERY',
                'amount'           => $recovery->amount,
                'payment_mode'     => 'DIGITAL',
                'description'      => "Direct UPI Payment from {$retailer->name} (MSISDN: {$retailer->msisdn})",
                'entity_name'      => $retailer->name,
                'transaction_date' => $recovery->recovered_at->toDateString(),
                'shop_id'          => $retailer->shop_id,
            ]);

            $retailersToProcess[$retailer->id] = $retailer;
            $success++;
        }

        foreach ($retailersToProcess as $retailer) {
            $entity = \App\Models\Entity::where('name', $retailer->name)->first();
            if ($entity) {
                app(\App\Services\EntityService::class)->syncBalance($entity);
            }
        }

        return response()->json([
            'success' => $success,
            'failed' => $failed,
            'duplicates' => $duplicates,
            'errors' => array_values(array_unique($errors)),
            'message' => "Successfully imported $success UPI payments. $duplicates duplicates skipped. $failed failed."
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
            $recovery = \App\Models\AirtelRecovery::create([
                'retailer_id' => $drop->retailer_id,
                'amount' => $amount,
                'recovered_at' => now(),
                'recovery_user_id' => $request->user()->id,
                'notes' => 'Bulk recover from Dashboard'
            ]);

            // Record Transaction using Service
            $this->transactionService->recordForModel($recovery, [
                'type'             => 'IN',
                'category'         => 'AIRTEL_RECOVERY',
                'amount'           => $recovery->amount,
                'payment_mode'     => 'CASH',
                'description'      => "Bulk recovery from Dashboard for {$drop->retailer->name}",
                'entity_name'      => $drop->retailer->name,
                'shop_id'          => $drop->retailer->shop_id,
            ]);

            // Drop status is no longer updated as we use global ledger
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

        // Payment mode filter is handled at the retailer/recovery level below for summary stats

        // Apply status filters at the retailer level for the summary
        if ($request->status && in_array($request->status, ['pending_only', 'recovered_only'])) {
            $query->whereIn('retailer_id', function($sub) use ($request) {
                $sub->select('id')->from('retailers');
                $debtSql = "(SELECT COALESCE(SUM(amount), 0) FROM airtel_drops WHERE airtel_drops.retailer_id = retailers.id AND airtel_drops.deleted_at IS NULL) + retailers.balance";
                $paidSql = "(SELECT COALESCE(SUM(amount), 0) FROM airtel_recoveries WHERE airtel_recoveries.retailer_id = retailers.id AND airtel_recoveries.deleted_at IS NULL)";
                if ($request->status === 'pending_only') {
                    $sub->whereRaw("$debtSql > $paidSql");
                } else {
                    $sub->whereRaw("$debtSql <= $paidSql");
                }
            });
        }

        // Filtered Opening Balance: sum of 'balance' for retailers who match the filters
        $retailerIdsByDrops = AirtelDrop::query()
            ->when($request->from_date && $request->to_date, function($q) use ($request) {
                $q->whereBetween('refill_date', [$request->from_date . ' 00:00:00', $request->to_date . ' 23:59:59']);
            })
            ->when($request->date, function($q) use ($request) {
                $q->whereDate('refill_date', $request->date);
            })
            ->distinct()
            ->pluck('retailer_id');

        $retailerQuery = \App\Models\Retailer::query();
        if ($request->retailer_name) {
            $retailerQuery->where(function($q) use ($request) {
                $q->where('name', 'like', '%' . $request->retailer_name . '%')
                  ->orWhere('msisdn', 'like', '%' . $request->retailer_name . '%');
            });
        }

        if ($request->payment_mode) {
            $retailerQuery->whereHas('recoveries', function($q) use ($request) {
                $q->where('notes', 'like', $request->payment_mode . '%');
            });
        }

        // Get union of IDs: those with drops in range + those with balance > 0
        $allMatchingRetailerIds = $retailerQuery->where(function($q) use ($retailerIdsByDrops) {
            $q->whereIn('id', $retailerIdsByDrops)->orWhere('balance', '>', 0);
        })->pluck('id');

        $opening_balance = (float)\App\Models\Retailer::whereIn('id', $allMatchingRetailerIds)->sum('balance');
        $retailerIds = $allMatchingRetailerIds;

        $total_recovered_filtered = (float)\App\Models\AirtelRecovery::query()
            ->when($request->retailer_id, function($q) use ($request) {
                $q->where('retailer_id', $request->retailer_id);
            })
            ->when($request->from_date && $request->to_date, function($q) use ($request) {
                $q->whereBetween('recovered_at', [$request->from_date . ' 00:00:00', $request->to_date . ' 23:59:59']);
            })
            ->when($request->date, function($q) use ($request) {
                $q->whereDate('recovered_at', $request->date);
            })
            ->when($request->payment_mode, function($q) use ($request) {
                $q->where('notes', 'like', $request->payment_mode . '%');
            })
            ->sum('amount');

        $total_recovered_all = (float)\App\Models\AirtelRecovery::whereIn('retailer_id', $retailerIds)
            ->when($request->from_date && $request->to_date, function($q) use ($request) {
                $q->whereBetween('recovered_at', [$request->from_date . ' 00:00:00', $request->to_date . ' 23:59:59']);
            })
            ->when($request->date, function($q) use ($request) {
                $q->whereDate('recovered_at', $request->date);
            })
            ->sum('amount');

        // Period-specific summary stats for the dashboard header
        $total_dropped = (float)$query->sum('amount');
        
        $total_recovered_period = (float)\App\Models\AirtelRecovery::query()
            ->when($request->retailer_id, function($q) use ($request) {
                $q->where('retailer_id', $request->retailer_id);
            })
            ->when($request->from_date && $request->to_date, function($q) use ($request) {
                $q->whereBetween('recovered_at', [$request->from_date . ' 00:00:00', $request->to_date . ' 23:59:59']);
            })
            ->when($request->date, function($q) use ($request) {
                $q->whereDate('recovered_at', $request->date);
            })
            ->when($request->payment_mode, function($q) use ($request) {
                $q->where('notes', 'like', $request->payment_mode . '%');
            })
            ->sum('amount');

        // Global Pending (Still needed for the dashboard side panel/summary)
        $global_dropped = (float)AirtelDrop::sum('amount');
        $global_opening = (float)\App\Models\Retailer::sum('balance');
        $global_recovered = (float)\App\Models\AirtelRecovery::sum('amount');
        $grand_total_pending = ($global_dropped + $global_opening) - $global_recovered;
        
        return response()->json([
            'total_dropped' => $total_dropped, 
            'total_receivable' => $total_dropped + $opening_balance, 
            'total_recovered' => $total_recovered_period, 
            'opening_balance' => $opening_balance,
            'pending_recovery' => ($total_dropped + $opening_balance) - $total_recovered_period, // Corrected for filtered view
            'grand_total_pending' => $grand_total_pending,
        ]);
    }

    public function bulkDeleteByDate(Request $request)
    {
        if (!$request->user()->canManage('manage_airtel_recovery')) {
            return response()->json(['message' => 'Unauthorized to delete drops'], 403);
        }

        if ($request->from_date && $request->to_date) {
            AirtelDrop::whereBetween('refill_date', [$request->from_date . ' 00:00:00', $request->to_date . ' 23:59:59'])->delete();
            ActivityLog::log('BULK_DELETE_DROPS', null, 'Deleted drops from ' . $request->from_date . ' to ' . $request->to_date);
        } else {
            $request->validate(['date' => 'required|date']);
            AirtelDrop::whereDate('refill_date', $request->date)->delete();
            ActivityLog::log('BULK_DELETE_DROPS', null, 'Deleted drops for date: ' . $request->date);
        }

        return response()->json(['message' => 'Selected drops have been cleared']);
    }

    public function destroy(Request $request, AirtelDrop $drop)
    {
        if (!$request->user()->canManage('manage_airtel_recovery')) {
            return response()->json(['message' => 'Unauthorized to delete drops'], 403);
        }

        if ($drop->status === 'recovered') {
            return response()->json(['message' => 'Cannot delete recovered drops'], 422);
        }
        $retailer = $drop->retailer;
        $amount = $drop->amount;
        $drop->delete();
        ActivityLog::log('DELETE_DROP', $retailer, 'Deleted drop of ₹' . number_format($amount) . ' for ' . ($retailer->name ?? 'Unknown'));
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
        if (!$request->user()->canManage('view_reports')) {
            return response()->json(['message' => 'Unauthorized to view reports'], 403);
        }

        $request->validate([
            'from_date' => 'nullable|date',
            'to_date' => 'nullable|date'
        ]);

        $from = $request->from_date ?: \Carbon\Carbon::now()->startOfMonth()->toDateString();
        $to = $request->to_date ?: \Carbon\Carbon::now()->toDateString();

        // 1. Daily Performance (Drop-Centric)
        $reportQuery = AirtelDrop::selectRaw("
                DATE(refill_date) as date, 
                SUM(amount) as total_dropped,
                SUM(paid_amount) as total_recovered
            ")
            ->whereBetween('refill_date', [$from . ' 00:00:00', $to . ' 23:59:59'])
            ->groupBy('date')
            ->orderBy('date', 'DESC');

        $report = $reportQuery->get()->map(function($item) {
            return (object)[
                'date' => $item->date,
                'total_dropped' => (float)$item->total_dropped,
                'total_recovered' => (float)$item->total_recovered
            ];
        });

        // 2. Collections Received (Cash-Flow Centric)
        $recoveries = \App\Models\AirtelRecovery::with(['retailer', 'recoveryUser'])
            ->whereBetween('recovered_at', [$from . ' 00:00:00', $to . ' 23:59:59'])
            ->orderBy('recovered_at', 'DESC')
            ->get();
            
        $collectionsByDay = $recoveries->groupBy(function($item) {
                return $item->recovered_at->toDateString();
            });

        $collections = $collectionsByDay->map(function($dayRecoveries, $date) {
            $modes = $dayRecoveries->groupBy(function($item) {
                $parts = explode(' - ', $item->notes);
                $mode = strtoupper(trim($parts[0]));
                return $mode ?: 'OTHER';
            })->map(function($modeRecoveries) {
                return $modeRecoveries->sum('amount');
            });

            return [
                'collection_date' => $date,
                'amount_collected' => $dayRecoveries->sum('amount'),
                'modes' => $modes
            ];
        })->values();

        // 3. Retailer Pending Summary
        $retailerSummary = Retailer::where(function($q) use ($from, $to) {
            $q->whereHas('drops', function($sq) use ($from, $to) {
                $sq->whereBetween('refill_date', [$from . ' 00:00:00', $to . ' 23:59:59']);
            })
            ->orWhere('balance', '>', 0)
            ->orWhereHas('recoveries', function($sq) use ($from, $to) {
                $sq->whereBetween('recovered_at', [$from . ' 00:00:00', $to . ' 23:59:59']);
            });
        })
        ->withSum(['drops as history_airdrop' => function($q) use ($from) {
            $q->where('refill_date', '<', $from . ' 00:00:00');
        }], 'amount')
        ->withSum(['recoveries as history_received' => function($q) use ($from) {
            $q->where('recovered_at', '<', $from . ' 00:00:00');
        }], 'amount')
        ->withSum(['drops as period_airdrop' => function($q) use ($from, $to) {
            $q->whereBetween('refill_date', [$from . ' 00:00:00', $to . ' 23:59:59']);
        }], 'amount')
        ->withSum(['recoveries as period_received' => function($q) use ($from, $to) {
            $q->whereBetween('recovered_at', [$from . ' 00:00:00', $to . ' 23:59:59']);
        }], 'amount')
        ->get()
        ->map(function($r) {
            $r->opening_bal = ((float)$r->balance + (float)($r->history_airdrop ?? 0)) - (float)($r->history_received ?? 0);
            $r->airdrop_total = (float)($r->period_airdrop ?? 0);
            $r->received_total = (float)($r->period_received ?? 0);
            $r->pending_total = ($r->opening_bal + $r->airdrop_total) - $r->received_total;
            return $r;
        })
        ->sort(function($a, $b) {
            if (abs($a->pending_total - $b->pending_total) > 0.01) {
                return $b->pending_total <=> $a->pending_total;
            }
            return $b->received_total <=> $a->received_total;
        })
        ->take(1000)
        ->values();

        // High precision summary totals
        $totalAirdrop = (float)\App\Models\AirtelDrop::whereBetween('refill_date', [$from . ' 00:00:00', $to . ' 23:59:59'])->sum('amount');
        $totalReceived = (float)\App\Models\AirtelRecovery::whereBetween('recovered_at', [$from . ' 00:00:00', $to . ' 23:59:59'])->sum('amount');
        
        $allRetailersOpening = (float)\App\Models\Retailer::sum('balance');
        $allDropsHistory = (float)\App\Models\AirtelDrop::where('refill_date', '<', $from . ' 00:00:00')->sum('amount');
        $allRecHistory = (float)\App\Models\AirtelRecovery::where('recovered_at', '<', $from . ' 00:00:00')->sum('amount');
        $openingAtStart = ($allRetailersOpening + $allDropsHistory) - $allRecHistory;

        $summaryTotals = [
            'count' => count($retailerSummary),
            'opening_bal' => $openingAtStart,
            'airdrop' => $totalAirdrop,
            'received' => $totalReceived,
            'pending' => ($openingAtStart + $totalAirdrop) - $totalReceived
        ];

        return response()->json([
            'daily_report' => $report,
            'collections_received' => $collections,
            'retailer_summary' => $retailerSummary,
            'summary_aggregate' => $summaryTotals,
            'detailed_recoveries' => $recoveries // Added for frontend table display
        ]);
    }

    public function exportRecoveryLog(Request $request)
    {
        if (!$request->user()->isOwner()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $from = $request->from_date ?: now()->toDateString();
        $to = $request->to_date ?: now()->toDateString();

        $recoveries = \App\Models\AirtelRecovery::with(['retailer', 'recoveryUser'])
            ->whereBetween('recovered_at', [$from . ' 00:00:00', $to . ' 23:59:59'])
            ->orderBy('recovered_at', 'DESC')
            ->get();

        $filename = "airtel_recovery_report_" . $from . "_to_" . $to . ".csv";
        
        $headers = [
            "Content-type" => "text/csv",
            "Content-Disposition" => "attachment; filename=$filename",
            "Pragma" => "no-cache",
            "Cache-Control" => "must-revalidate, post-check=0, pre-check=0",
            "Expires" => "0"
        ];

        $columns = ['DATE', 'TIME', 'RETAILER NAME', 'MSISDN', 'AMOUNT', 'MODE/NOTES', 'RECOVERY BY'];

        $callback = function() use($recoveries, $columns) {
            $file = fopen('php://output', 'w');
            fputcsv($file, $columns);

            foreach ($recoveries as $rec) {
                fputcsv($file, [
                    $rec->recovered_at->format('d-m-Y'),
                    $rec->recovered_at->format('h:i A'),
                    $rec->retailer->name ?? 'Unknown',
                    $rec->retailer->msisdn ?? 'N/A',
                    $rec->amount,
                    $rec->notes,
                    $rec->recoveryUser->name ?? 'System'
                ]);
            }

            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }
}
