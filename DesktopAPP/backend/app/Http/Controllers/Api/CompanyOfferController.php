<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CompanyOffer;
use App\Models\OfferFulfillment;
use App\Models\SaleItem;
use Illuminate\Http\Request;

class CompanyOfferController extends Controller
{
    public function index(Request $request)
    {
        return response()->json(CompanyOffer::with('product')->latest()->get()->map(function ($offer) {
            // Update actual_sold dynamically
            $sold = SaleItem::where('product_id', $offer->product_id)
                ->whereHas('invoice', fn($q) =>
                    $q->whereBetween('sale_date', [$offer->start_date, $offer->end_date])
                      ->where('is_cancelled', false)
                )->sum('quantity');
            $offer->actual_sold = $sold;
            return $offer;
        }));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name'            => 'required|string|max:200',
            'product_id'      => 'nullable|exists:products,id',
            'start_date'      => 'required|date',
            'end_date'        => 'required|date|after:start_date',
            'target_quantity' => 'required|integer|min:1',
            'reward_details'  => 'required|string',
        ]);
        return response()->json(CompanyOffer::create($data), 201);
    }

    public function update(Request $request, CompanyOffer $companyOffer)
    {
        $data = $request->validate([
            'name'           => 'sometimes|string',
            'is_fulfilled'   => 'boolean',
            'reward_details' => 'sometimes|string',
        ]);
        $companyOffer->update($data);

        if ($data['is_fulfilled'] ?? false) {
            OfferFulfillment::create([
                'offer_id'       => $companyOffer->id,
                'fulfilled_date' => now()->toDateString(),
                'notes'          => $request->notes,
            ]);
        }

        return response()->json($companyOffer->fresh());
    }
}
