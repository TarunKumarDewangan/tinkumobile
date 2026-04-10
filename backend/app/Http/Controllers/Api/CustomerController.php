<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use Illuminate\Http\Request;

class CustomerController extends Controller
{
    public function index(Request $request) {
        $query = Customer::with('events');
        if ($request->search) $query->where('name','like',"%{$request->search}%")->orWhere('phone','like',"%{$request->search}%");
        return response()->json($query->latest()->get());
    }
    public function store(Request $request) {
        $data = $request->validate([
            'name'=>'required|string|max:150',
            'phone'=>'required|string|unique:customers,phone',
            'email'=>'nullable|email',
            'address'=>'nullable|string',
            'voucher_code'=>'nullable|string',
            'events'=>'nullable|array',
            'events.*.type'=>'required|string',
            'events.*.name'=>'nullable|string',
            'events.*.date'=>'required|date',
        ]);
        
        $customer = Customer::create($data);
        if ($request->events) {
            foreach ($request->events as $event) {
                $customer->events()->create($event);
            }
        }
        return response()->json($customer->load('events'), 201);
    }
    public function show(Customer $customer) { return response()->json($customer->load('events')); }
    public function update(Request $request, Customer $customer) {
        $data = $request->validate([
            'name'=>'sometimes|string|max:150',
            'phone'=>'sometimes|string|unique:customers,phone,'.$customer->id,
            'email'=>'nullable|email',
            'address'=>'nullable|string',
            'voucher_code'=>'nullable|string',
            'events'=>'nullable|array',
            'events.*.type'=>'required|string',
            'events.*.name'=>'nullable|string',
            'events.*.date'=>'required|date',
        ]);
        
        $customer->update($data);
        if (isset($data['events'])) {
            $customer->events()->delete();
            foreach ($data['events'] as $event) {
                $customer->events()->create($event);
            }
        }
        return response()->json($customer->load('events'));
    }
    public function destroy(Customer $customer) { $customer->delete(); return response()->json(['message' => 'Deleted']); }
}
