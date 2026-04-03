<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use Illuminate\Http\Request;

class CustomerController extends Controller
{
    public function index(Request $request) {
        $query = Customer::query();
        if ($request->search) $query->where('name','like',"%{$request->search}%")->orWhere('phone','like',"%{$request->search}%");
        return response()->json($query->latest()->get());
    }
    public function store(Request $request) {
        $data = $request->validate(['name'=>'required|string|max:150','phone'=>'required|string|unique:customers,phone','email'=>'nullable|email','address'=>'nullable|string']);
        return response()->json(Customer::create($data), 201);
    }
    public function show(Customer $customer) { return response()->json($customer); }
    public function update(Request $request, Customer $customer) {
        $data = $request->validate(['name'=>'sometimes|string|max:150','phone'=>'sometimes|string|unique:customers,phone,'.$customer->id,'email'=>'nullable|email','address'=>'nullable|string']);
        $customer->update($data);
        return response()->json($customer);
    }
    public function destroy(Customer $customer) { $customer->delete(); return response()->json(['message' => 'Deleted']); }
}
