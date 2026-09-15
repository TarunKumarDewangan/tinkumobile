<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Shop;
use Illuminate\Http\Request;

class ShopController extends Controller
{
    // Shops – owner only. Every non-read action mutates or exposes cross-shop
    // data, so all writes (and the index list) require full access.
    public function index(Request $request)
    {
        if (!$request->user()->hasFullAccess()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        return response()->json(Shop::all());
    }

    public function store(Request $request)
    {
        if (!$request->user()->hasFullAccess()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        $data = $request->validate([
            'name' => 'required|string|max:150',
            'address' => 'required|string',
            'phone' => 'required|string|max:20',
            'alt_phone' => 'nullable|string|max:20',
            'email' => 'nullable|email|max:100',
            'gstin' => 'nullable|string|max:50',
            'is_main' => 'boolean',
            'latitude' => 'nullable|numeric|between:-90,90',
            'longitude' => 'nullable|numeric|between:-180,180',
            'attendance_radius_meters' => 'nullable|integer|min:5|max:1000',
            'shift_start_time' => 'nullable|date_format:H:i',
            'shift_end_time' => 'nullable|date_format:H:i',
            'monthly_leave_limit' => 'nullable|integer|min:0|max:31',
        ]);
        return response()->json(Shop::create($data), 201);
    }

    public function show(Request $request, Shop $shop)
    {
        if (!$request->user()->hasFullAccess() && $request->user()->shop_id !== $shop->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        return response()->json($shop->load('users'));
    }

    public function update(Request $request, Shop $shop)
    {
        if (!$request->user()->hasFullAccess()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        $data = $request->validate([
            'name' => 'sometimes|string|max:150',
            'address' => 'sometimes|string',
            'phone' => 'sometimes|string|max:20',
            'alt_phone' => 'nullable|string|max:20',
            'email' => 'nullable|email|max:100',
            'gstin' => 'nullable|string|max:50',
            'is_main' => 'boolean',
            'latitude' => 'nullable|numeric|between:-90,90',
            'longitude' => 'nullable|numeric|between:-180,180',
            'attendance_radius_meters' => 'nullable|integer|min:5|max:1000',
            'shift_start_time' => 'nullable|date_format:H:i',
            'shift_end_time' => 'nullable|date_format:H:i',
            'monthly_leave_limit' => 'nullable|integer|min:0|max:31',
        ]);
        $shop->update($data);
        return response()->json($shop);
    }

    public function destroy(Request $request, Shop $shop)
    {
        if (!$request->user()->hasFullAccess()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        $shop->delete();
        return response()->json(['message' => 'Shop deleted']);
    }
}
