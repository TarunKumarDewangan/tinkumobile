<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SimStockEntry;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Simple bulk SIM stock ledger — tracks how many SIMs are in hand per
 * operator (optionally per distributor), not individual SIM serial numbers.
 * Deliberately separate from SimCardController/SimCard, which tracks
 * individually-serialed SIMs for activation — this is just a running
 * count, matching how the shop actually receives/sells SIM stock.
 */
class SimStockController extends Controller
{
    public function summary(Request $request)
    {
        $user = $request->user();
        $query = SimStockEntry::query();
        if (! $user->hasFullAccess()) $query->where('shop_id', $user->shop_id);

        $rows = $query->select('operator', 'type', DB::raw('SUM(quantity) as qty'))
            ->groupBy('operator', 'type')
            ->get();

        $summary = [];
        foreach ($rows as $row) {
            if (!isset($summary[$row->operator])) {
                $summary[$row->operator] = ['operator' => $row->operator, 'in' => 0, 'out' => 0];
            }
            $summary[$row->operator][$row->type === 'IN' ? 'in' : 'out'] += (int) $row->qty;
        }

        $result = array_values(array_map(function ($s) {
            $s['available'] = $s['in'] - $s['out'];
            return $s;
        }, $summary));

        return response()->json($result);
    }

    public function index(Request $request)
    {
        $user = $request->user();
        $query = SimStockEntry::with(['distributor', 'user'])->latest('entry_date')->latest('id');
        if (! $user->hasFullAccess()) $query->where('shop_id', $user->shop_id);
        if ($request->operator) $query->where('operator', $request->operator);
        if ($request->type) $query->where('type', $request->type);

        return response()->json($query->get());
    }

    public function store(Request $request)
    {
        $user = $request->user();
        $data = $request->validate([
            'distributor_id' => 'nullable|exists:entities,id',
            'operator'       => 'required|string|max:50',
            'quantity'       => 'required|integer|min:1',
            'price_per_sim'  => 'nullable|numeric|min:0',
            'remarks'        => 'nullable|string',
            'entry_date'     => 'required|date',
        ]);

        $pricePerSim = $data['price_per_sim'] ?? 10;

        $entry = SimStockEntry::create([
            'shop_id'        => $user->hasFullAccess() ? ($request->shop_id ?: $user->shop_id) : $user->shop_id,
            'type'           => 'IN',
            'distributor_id' => $data['distributor_id'] ?? null,
            'operator'       => strtoupper($data['operator']),
            'quantity'       => $data['quantity'],
            'price_per_sim'  => $pricePerSim,
            'total_price'    => $data['quantity'] * $pricePerSim,
            'remarks'        => $data['remarks'] ?? null,
            'entry_date'     => $data['entry_date'],
            'user_id'        => $user->id,
        ]);

        return response()->json($entry->load('distributor'), 201);
    }

    public function sell(Request $request)
    {
        $user = $request->user();
        $data = $request->validate([
            'operator'   => 'required|string|max:50',
            'quantity'   => 'required|integer|min:1',
            'remarks'    => 'nullable|string',
            'entry_date' => 'required|date',
        ]);

        $operator = strtoupper($data['operator']);
        $shopId = $user->hasFullAccess() ? ($request->shop_id ?: $user->shop_id) : $user->shop_id;

        return DB::transaction(function () use ($data, $operator, $shopId, $user) {
            $inQty = SimStockEntry::where('operator', $operator)
                ->when($shopId, fn($q) => $q->where('shop_id', $shopId))
                ->where('type', 'IN')->sum('quantity');
            $outQty = SimStockEntry::where('operator', $operator)
                ->when($shopId, fn($q) => $q->where('shop_id', $shopId))
                ->where('type', 'OUT')->sum('quantity');
            $available = $inQty - $outQty;

            if ($data['quantity'] > $available) {
                return response()->json(['message' => "Only {$available} {$operator} SIM(s) in stock."], 422);
            }

            // A price isn't asked for a sale here — this ledger tracks stock
            // count/cost, not sale revenue (that's the existing SimCard/recharge
            // sale flow); price_per_sim/total_price stay 0 for OUT entries.
            $entry = SimStockEntry::create([
                'shop_id'       => $shopId,
                'type'          => 'OUT',
                'operator'      => $operator,
                'quantity'      => $data['quantity'],
                'price_per_sim' => 0,
                'total_price'   => 0,
                'remarks'       => $data['remarks'] ?? null,
                'entry_date'    => $data['entry_date'],
                'user_id'       => $user->id,
            ]);

            return response()->json($entry, 201);
        });
    }
}
