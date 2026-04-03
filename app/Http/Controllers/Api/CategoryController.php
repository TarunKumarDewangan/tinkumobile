<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Supplier;
use App\Models\Customer;
use App\Models\CompanyOffer;
use App\Models\OfferFulfillment;
use Illuminate\Http\Request;

class CategoryController extends Controller
{
    public function index() { return response()->json(Category::all()); }
    public function store(Request $request) {
        $data = $request->validate(['name' => 'required|string|max:100']);
        $data['slug'] = \Illuminate\Support\Str::slug($data['name']);
        return response()->json(Category::create($data), 201);
    }
    public function update(Request $request, Category $category) {
        $data = $request->validate(['name' => 'required|string|max:100']);
        $data['slug'] = \Illuminate\Support\Str::slug($data['name']);
        $category->update($data);
        return response()->json($category);
    }
    public function destroy(Category $category) { $category->delete(); return response()->json(['message' => 'Deleted']); }
}

// ═══════════════════════════════════════════════════════════════════════
// Note: Supplier and Customer controllers are in separate files below.
// This file only defines CategoryController.
