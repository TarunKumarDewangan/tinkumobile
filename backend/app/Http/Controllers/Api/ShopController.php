<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Shop;
use Illuminate\Http\Request;

class ShopController extends Controller
{
    public function index()
    {
        return response()->json(Shop::all());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:150',
            'address' => 'required|string',
            'phone' => 'required|string|max:20',
            'email' => 'nullable|email|max:100',
            'is_main' => 'boolean',
        ]);
        return response()->json(Shop::create($data), 201);
    }

    public function show(Shop $shop)
    {
        return response()->json($shop->load('users'));
    }

    public function update(Request $request, Shop $shop)
    {
        $data = $request->validate([
            'name' => 'sometimes|string|max:150',
            'address' => 'sometimes|string',
            'phone' => 'sometimes|string|max:20',
            'email' => 'nullable|email|max:100',
            'is_main' => 'boolean',
        ]);
        $shop->update($data);
        return response()->json($shop);
    }

    public function destroy(Shop $shop)
    {
        $shop->delete();
        return response()->json(['message' => 'Shop deleted']);
    }
}
