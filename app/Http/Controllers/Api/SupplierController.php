<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Supplier;
use Illuminate\Http\Request;

class SupplierController extends Controller
{
    public function index() { return response()->json(Supplier::all()); }
    public function store(Request $request) {
        $data = $request->validate([
            'name' => 'required|string|max:150',
            'phone' => 'required|string',
            'address' => 'required|string',
            'is_online_shop' => 'sometimes|boolean'
        ]);
        return response()->json(Supplier::create($data), 201);
    }
    public function show(Supplier $supplier) { return response()->json($supplier); }
    public function update(Request $request, Supplier $supplier) {
        $supplier->update($request->validate([
            'name' => 'sometimes|string',
            'phone' => 'sometimes|string',
            'address' => 'sometimes|string',
            'is_online_shop' => 'sometimes|boolean'
        ]));
        return response()->json($supplier);
    }
    public function destroy(Supplier $supplier) { $supplier->delete(); return response()->json(['message' => 'Deleted']); }
}
