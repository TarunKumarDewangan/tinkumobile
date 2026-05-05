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
        if ($request->search) {
            $query->where(function($q) use ($request) {
                $q->where('name', 'like', "%{$request->search}%")
                  ->orWhere('phone', 'like', "%{$request->search}%")
                  ->orWhere('type', 'like', "%{$request->search}%");
            });
        }
        
        $entities = $query->orderBy('name')->with('balance')->get();
        
        // If we have very few balances but many entities, suggest a sync or auto-detect
        $balanceCount = DB::table('entity_balances')->count();
        if ($balanceCount < $entities->count() * 0.1 && $entities->count() > 10) {
             // Automatic sync if cache is mostly empty
             $service = app(\App\Services\EntityService::class);
             $service->syncAll();
        }

        return response()->json(Entity::calculateBalances($entities));
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
            'gst_number' => 'nullable|string',
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
            'gst_number' => 'nullable|string',
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

        // Sync Models using the trait
        $models = [
            \App\Models\Customer::class,
            \App\Models\Supplier::class,
            \App\Models\Retailer::class,
            \App\Models\User::class,
            \App\Models\Shop::class, // Assuming Shop is also an entity source
        ];

        foreach ($models as $modelClass) {
            $modelClass::all()->each(function($model) use (&$count) {
                // The trait boot method doesn't run on manual iteration if not saved
                // but syncToMasterEntity() is public.
                if (method_exists($model, 'syncToMasterEntity')) {
                    $model->syncToMasterEntity();
                    $count++;
                }
            });
        }

        // Sync Forwarding Service Centers from Repairs (that are just names in repair_requests)
        DB::table('repair_requests')
            ->whereNotNull('forwarded_to')
            ->where('forwarded_to', '!=', '')
            ->distinct()
            ->pluck('forwarded_to')
            ->each(function($name) use (&$count) {
                $e = Entity::firstOrNew(['name' => $name]);
                if (!$e->exists) {
                    $e->fill([
                        'type' => 'SHOP',
                        'description' => 'Service Center from Repairs',
                    ]);
                    $e->save();
                    $count++;
                }
            });

        return response()->json(['message' => "Synced $count entities from all sources."]);
    }

    /**
     * Complete reset and rebuild of the entity system.
     * Use this when balances are corrupt or duplicated.
     */
    public function hardReset()
    {
        // 1. Clear caches and entities
        DB::statement('SET FOREIGN_KEY_CHECKS=0;');
        DB::table('entity_balances')->truncate();
        DB::table('entities')->truncate();
        DB::statement('SET FOREIGN_KEY_CHECKS=1;');

        // 2. Re-sync from all sources
        $this->autoSync();

        // 3. Recalculate all balances
        $service = app(\App\Services\EntityService::class);
        $service->syncAll();

        return response()->json(['message' => 'Account system successfully recreated and all balances recalculated.']);
    }
}
