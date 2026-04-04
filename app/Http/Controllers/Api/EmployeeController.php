<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use Illuminate\Http\Request;

class EmployeeController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $query = Employee::with('shop');

        if (!$user->hasFullAccess()) {
            $query->where('shop_id', $user->shop_id);
        } elseif ($request->shop_id) {
            $query->where('shop_id', $request->shop_id);
        }

        if ($request->search) {
            $s = $request->search;
            $query->where(function($q) use ($s) {
                $q->where('name', 'like', "%$s%")
                  ->orWhere('phone', 'like', "%$s%")
                  ->orWhere('designation', 'like', "%$s%");
            });
        }

        return response()->json($query->latest()->get());
    }

    public function store(Request $request)
    {
        $user = $request->user();
        $shopId = $user->hasFullAccess() ? $request->shop_id : $user->shop_id;

        $data = $request->validate([
            'shop_id'     => $user->hasFullAccess() ? 'required|exists:shops,id' : 'nullable',
            'name'        => 'required|string|max:255',
            'phone'       => 'nullable|string|max:20',
            'email'       => 'nullable|email|max:255',
            'address'     => 'nullable|string',
            'join_date'   => 'nullable|date',
            'base_salary' => 'nullable|numeric|min:0',
            'designation' => 'nullable|string|max:100',
            'is_active'   => 'nullable|boolean',
        ]);

        $employee = Employee::create(array_merge($data, ['shop_id' => $shopId]));

        return response()->json($employee, 201);
    }

    public function show(Request $request, Employee $employee)
    {
        $user = $request->user();
        if (!$user->hasFullAccess() && $employee->shop_id !== $user->shop_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        return response()->json($employee->load('shop'));
    }

    public function update(Request $request, Employee $employee)
    {
        $user = $request->user();
        if (!$user->hasFullAccess() && $employee->shop_id !== $user->shop_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $data = $request->validate([
            'shop_id'     => $user->hasFullAccess() ? 'required|exists:shops,id' : 'nullable',
            'name'        => 'required|string|max:255',
            'phone'       => 'nullable|string|max:20',
            'email'       => 'nullable|email|max:255',
            'address'     => 'nullable|string',
            'join_date'   => 'nullable|date',
            'base_salary' => 'nullable|numeric|min:0',
            'designation' => 'nullable|string|max:100',
            'is_active'   => 'nullable|boolean',
        ]);

        $employee->update($data);

        return response()->json($employee);
    }

    public function destroy(Request $request, Employee $employee)
    {
        $user = $request->user();
        if (!$user->hasFullAccess() && $employee->shop_id !== $user->shop_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $employee->delete();
        return response()->json(['message' => 'Employee deleted successfully']);
    }
}
