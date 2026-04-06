<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ExpenseCategory;
use Illuminate\Http\Request;

class ExpenseCategoryController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $query = ExpenseCategory::query();

        if (!$user->hasFullAccess()) {
            $query->where('shop_id', $user->shop_id);
        }

        return response()->json($query->orderBy('name')->get());
    }

    public function store(Request $request)
    {
        $user = $request->user();
        $data = $request->validate([
            'name'        => 'required|string|max:191',
            'description' => 'nullable|string',
            'shop_id'     => $user->hasFullAccess() ? 'nullable|exists:shops,id' : 'nullable'
        ]);

        if (!$user->hasFullAccess()) {
            $data['shop_id'] = $user->shop_id;
        }

        $category = ExpenseCategory::create($data);
        return response()->json($category, 201);
    }

    public function update(Request $request, ExpenseCategory $expenseCategory)
    {
        $user = $request->user();
        if (!$user->hasFullAccess() && $expenseCategory->shop_id !== $user->shop_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $data = $request->validate([
            'name'        => 'required|string|max:191',
            'description' => 'nullable|string'
        ]);

        $expenseCategory->update($data);
        return response()->json($expenseCategory);
    }

    public function destroy(Request $request, ExpenseCategory $expenseCategory)
    {
        $user = $request->user();
        if (!$user->hasFullAccess() && $expenseCategory->shop_id !== $user->shop_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $expenseCategory->delete();
        return response()->json(['message' => 'Category deleted']);
    }
}
