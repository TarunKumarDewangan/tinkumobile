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
        if ($request->type) {
            $query->where('type', $request->type);
        } else {
            $query->where('type', '!=', 'RETAILER');
        }
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

    public function show(Entity $entity)
    {
        $entity->load('relation.events');
        $result = $entity->toArray();
        if ($entity->relation instanceof \App\Models\Customer) {
            $result['voucher_code'] = $entity->relation->voucher_code;
            $result['events'] = $entity->relation->events;
        } else {
            $result['voucher_code'] = '';
            $result['events'] = [];
        }
        return response()->json($result);
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
            'description' => 'nullable|string',
            'voucher_code' => 'nullable|string',
            'events' => 'nullable|array',
            'events.*.type' => 'required|string',
            'events.*.name' => 'nullable|string',
            'events.*.date' => 'required|date'
        ]);

        if (in_array($data['type'], ['CUSTOMER', 'SHOP_CUSTOMER']) && !empty($data['phone'])) {
            $exists = \App\Models\Customer::where('phone', $data['phone'])->exists();
            if ($exists) {
                return response()->json(['message' => 'A customer with this phone number already exists.'], 422);
            }
        }

        return DB::transaction(function() use ($data) {
            $model = null;
            if ($data['type'] === 'CUSTOMER') {
                $model = \App\Models\Customer::create([
                    'name' => $data['name'],
                    'phone' => $data['phone'] ?? '',
                    'email' => $data['email'],
                    'address' => $data['description'],
                    'category' => 'REGULAR',
                    'voucher_code' => $data['voucher_code'] ?? null
                ]);
            } elseif ($data['type'] === 'SHOP_CUSTOMER') {
                $model = \App\Models\Customer::create([
                    'name' => $data['name'],
                    'phone' => $data['phone'] ?? '',
                    'email' => $data['email'],
                    'address' => $data['description'],
                    'category' => 'SHOP',
                    'voucher_code' => $data['voucher_code'] ?? null
                ]);
            } elseif ($data['type'] === 'SUPPLIER') {
                $model = \App\Models\Supplier::create([
                    'name' => $data['name'],
                    'phone' => $data['phone'] ?? '',
                    'address' => $data['description'],
                    'gst_no' => $data['gst_number'],
                ]);
            } elseif ($data['type'] === 'SHOP') {
                $model = \App\Models\Shop::create([
                    'name' => $data['name'],
                    'phone' => $data['phone'] ?? '',
                    'address' => $data['description'],
                    'email' => $data['email'],
                    'gstin' => $data['gst_number'],
                ]);
            }

            if ($model) {
                if (!empty($data['events'])) {
                    foreach ($data['events'] as $evt) {
                        $model->events()->create($evt);
                    }
                }
                $entity = Entity::where('relation_type', get_class($model))
                    ->where('relation_id', $model->id)
                    ->first();
            } else {
                $entity = new Entity();
            }

            $entity->fill($data);
            if ($model) {
                $entity->relation_type = get_class($model);
                $entity->relation_id = $model->id;
            }
            $entity->save();

            return response()->json($entity, 201);
        });
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
            'description' => 'nullable|string',
            'voucher_code' => 'nullable|string',
            'events' => 'nullable|array',
            'events.*.type' => 'required|string',
            'events.*.name' => 'nullable|string',
            'events.*.date' => 'required|date'
        ]);

        if (in_array($data['type'], ['CUSTOMER', 'SHOP_CUSTOMER']) && !empty($data['phone'])) {
            $exists = \App\Models\Customer::where('phone', $data['phone'])->where('id', '!=', $entity->relation_id)->exists();
            if ($exists) {
                return response()->json(['message' => 'A customer with this phone number already exists.'], 422);
            }
        }

        return DB::transaction(function() use ($entity, $data) {
            $entity->update($data);
            
            if ($entity->relation) {
                $relation = $entity->relation;
                $relationData = [
                    'name' => $entity->name,
                    'phone' => $entity->phone ?? '',
                ];
                
                if ($relation instanceof \App\Models\Customer) {
                    $relationData['category'] = $entity->type === 'SHOP_CUSTOMER' ? 'SHOP' : 'REGULAR';
                    $relationData['email'] = $entity->email;
                    $relationData['address'] = $entity->description;
                    $relationData['voucher_code'] = $data['voucher_code'] ?? null;
                    
                    $relation->update($relationData);
                    
                    $relation->events()->delete();
                    if (!empty($data['events'])) {
                        foreach ($data['events'] as $evt) {
                            $relation->events()->create($evt);
                        }
                    }
                } elseif ($relation instanceof \App\Models\Supplier) {
                    $relationData['address'] = $entity->description;
                    $relationData['gst_no'] = $entity->gst_number;
                    $relation->update($relationData);
                } elseif ($relation instanceof \App\Models\Shop) {
                    $relationData['address'] = $entity->description;
                    $relationData['email'] = $entity->email;
                    $relationData['gstin'] = $entity->gst_number;
                    $relation->update($relationData);
                }
            }
            
            return response()->json($entity);
        });
    }

    public function destroy(Entity $entity)
    {
        $entity->delete();
        return response()->json(['message' => 'Entity deleted']);
    }

    /**
     * Completely purge an entity AND all its transaction history.
     * Matches transactions by both entity ID and entity name for full coverage.
     */
    public function destroyWithHistory(Entity $entity)
    {
        return DB::transaction(function () use ($entity) {
            $name = $entity->name;
            $id   = $entity->id;

            // 1. Delete all transactions linked to this entity (by ID or by name)
            \App\Models\Transaction::where(function ($q) use ($id, $name) {
                $q->where('accounting_entity_id', $id)
                  ->orWhere('entity_name', $name);
            })->forceDelete();

            // 2. Remove cached balance row
            DB::table('entity_balances')->where('entity_id', $id)->delete();

            // 3. Delete the entity itself
            $entity->delete();

            return response()->json([
                'message' => "\"$name\" and all its transaction history have been permanently deleted."
            ]);
        });
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
