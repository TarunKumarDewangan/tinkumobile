<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\OldMobilePurchase;
use Illuminate\Http\Request;

class OldMobileController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $query = OldMobilePurchase::with('customer', 'user');
        if (! $user->hasFullAccess()) $query->where('shop_id', $user->shop_id);
        return response()->json($query->latest()->get());
    }

    public function store(Request $request)
    {
        $user = $request->user();
        $data = $request->validate([
            'customer_id'    => 'required|exists:customers,id',
            'model_name'     => 'required|string|max:150',
            'imei'           => 'nullable|string|max:20',
            'purchase_price' => 'required|numeric|min:0',
            'condition_note' => 'nullable|string',
            'purchase_date'  => 'required|date',
        ]);
        $data['shop_id'] = $user->hasFullAccess() ? $request->shop_id : $user->shop_id;
        $data['user_id'] = $user->id;
        return response()->json(OldMobilePurchase::create($data), 201);
    }

    public function show(Request $request, OldMobilePurchase $oldMobilePurchase)
    {
        $user = $request->user();
        if (! $user->hasFullAccess() && $oldMobilePurchase->shop_id !== $user->shop_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        return response()->json($oldMobilePurchase->load('customer', 'user'));
    }
}
