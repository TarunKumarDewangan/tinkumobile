<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Entity;
use App\Models\Customer;
use App\Models\Shop;
use App\Models\Supplier;
use App\Models\Retailer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class EntityController extends Controller
{
    public function index(Request $request)
    {
        $query = Entity::query();
        if ($request->type) $query->where('type', $request->type);
        if ($request->search) $query->where('name', 'like', "%{$request->search}%");
        
        return response()->json($query->orderBy('name')->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|unique:entities,name',
            'type' => 'required|string',
            'phone' => 'nullable|string',
            'email' => 'nullable|string',
            'opening_balance' => 'numeric',
            'balance_type' => 'required|in:RECEIVABLE,PAYABLE',
            'description' => 'nullable|string'
        ]);

        return response()->json(Entity::create($data), 201);
    }

    public function update(Request $request, Entity $entity)
    {
        $data = $request->validate([
            'name' => 'required|string|unique:entities,name,' . $entity->id,
            'type' => 'required|string',
            'phone' => 'nullable|string',
            'email' => 'nullable|string',
            'opening_balance' => 'numeric',
            'balance_type' => 'required|in:RECEIVABLE,PAYABLE',
            'description' => 'nullable|string'
        ]);

        $entity->update($data);
        return response()->json($entity);
    }

    public function destroy(Entity $entity)
    {
        $entity->delete();
        return response()->json(['message' => 'Entity deleted']);
    }

    /**
     * Auto-sync entities from other tables.
     */
    public function autoSync()
    {
        $count = 0;

        // Sync Customers
        Customer::all()->each(function($c) use (&$count) {
            $e = Entity::firstOrNew(['name' => $c->name]);
            if (!$e->exists) {
                $e->fill([
                    'type' => 'CUSTOMER',
                    'relation_type' => Customer::class,
                    'relation_id' => $c->id,
                    'phone' => $c->phone,
                    'email' => $c->email,
                ]);
                $e->save();
                $count++;
            }
        });

        // Sync Shops (Forwarding partners)
        Shop::all()->each(function($s) use (&$count) {
            $e = Entity::firstOrNew(['name' => $s->name]);
             if (!$e->exists) {
                $e->fill([
                    'type' => 'SHOP',
                    'relation_type' => Shop::class,
                    'relation_id' => $s->id,
                    'phone' => $s->phone,
                ]);
                $e->save();
                $count++;
            }
        });

        // Sync Suppliers
        Supplier::all()->each(function($s) use (&$count) {
            $e = Entity::firstOrNew(['name' => $s->name]);
             if (!$e->exists) {
                $e->fill([
                    'type' => 'SUPPLIER',
                    'relation_type' => Supplier::class,
                    'relation_id' => $s->id,
                    'phone' => $s->phone,
                    'email' => $s->email,
                ]);
                $e->save();
                $count++;
            }
        });

        // Sync Retailers (Airtel)
        Retailer::all()->each(function($r) use (&$count) {
            $e = Entity::firstOrNew(['name' => $r->name]);
             if (!$e->exists) {
                $e->fill([
                    'type' => 'RETAILER',
                    'relation_type' => Retailer::class,
                    'relation_id' => $r->id,
                    'phone' => $r->msisdn,
                ]);
                $e->save();
                $count++;
            }
        });

        return response()->json(['message' => "Synced $count new entities."]);
    }
}
