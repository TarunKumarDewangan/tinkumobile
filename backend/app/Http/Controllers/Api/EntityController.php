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
        $entity->load('relation');
        $result = $entity->toArray();
        if ($entity->relation instanceof \App\Models\Customer) {
            $entity->relation->load('events');
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
            'address' => 'nullable|string|max:255',
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
                    'address' => $data['address'] ?? null,
                    'category' => 'REGULAR',
                    'gst_no' => $data['gst_number'] ?? null,
                    'voucher_code' => $data['voucher_code'] ?? null
                ]);
            } elseif ($data['type'] === 'SHOP_CUSTOMER') {
                $model = \App\Models\Customer::create([
                    'name' => $data['name'],
                    'phone' => $data['phone'] ?? '',
                    'email' => $data['email'],
                    'address' => $data['address'] ?? null,
                    'category' => 'SHOP',
                    'gst_no' => $data['gst_number'] ?? null,
                    'voucher_code' => $data['voucher_code'] ?? null
                ]);
            } elseif ($data['type'] === 'SUPPLIER') {
                $model = \App\Models\Supplier::create([
                    'name' => $data['name'],
                    'phone' => $data['phone'] ?? '',
                    'address' => $data['address'] ?? null,
                    'gst_no' => $data['gst_number'],
                ]);
            } elseif ($data['type'] === 'SHOP') {
                $model = \App\Models\Shop::create([
                    'name' => $data['name'],
                    'phone' => $data['phone'] ?? '',
                    'address' => $data['address'] ?? null,
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
            'address' => 'nullable|string|max:255',
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
                
                // suppliers.address and shops.address are NOT NULL at the DB level (unlike
                // entities.address, which is nullable). Entities created before the address
                // field existed on this table never got backfilled, so entity->address can
                // still be empty even when the linked Supplier/Shop already has a real one.
                // Never let a blank entity address overwrite (and crash on, for Supplier/Shop)
                // an existing real address — only push it down when something was actually
                // entered.
                $addressToSync = $entity->address ?: $relation->address;

                if ($relation instanceof \App\Models\Customer) {
                    $relationData['category'] = in_array($data['type'], ['SHOP_CUSTOMER']) ? 'SHOP' : 'REGULAR';
                    $relationData['email'] = $entity->email;
                    $relationData['address'] = $addressToSync;
                    $relationData['gst_no'] = $entity->gst_number;
                    $relationData['voucher_code'] = $data['voucher_code'] ?? null;

                    // Use saveQuietly to prevent SyncsWithMasterEntity from firing and
                    // overwriting the entity type we just explicitly set above.
                    $relation->fill($relationData)->saveQuietly();

                    $relation->events()->delete();
                    if (!empty($data['events'])) {
                        foreach ($data['events'] as $evt) {
                            $relation->events()->create($evt);
                        }
                    }
                } elseif ($relation instanceof \App\Models\Supplier) {
                    $relationData['address'] = $addressToSync;
                    $relationData['gst_no'] = $entity->gst_number;
                    $relation->fill($relationData)->saveQuietly();
                } elseif ($relation instanceof \App\Models\Shop) {
                    $relationData['address'] = $addressToSync;
                    $relationData['email'] = $entity->email;
                    $relationData['gstin'] = $entity->gst_number;
                    $relation->fill($relationData)->saveQuietly();
                }
            }
            
            return response()->json($entity);
        });
    }

    public function destroy(Request $request, Entity $entity)
    {
        if (!$request->user()->hasFullAccess()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        return DB::transaction(function() use ($entity) {
            $relation = $entity->relation;

            // entities.name is unique, so a soft delete here permanently blocks that name
            // from ever being reused. Customer/Supplier hard deletes are already guarded
            // by real (non-cascading) FK constraints on sale/purchase invoices, so try a
            // genuine hard delete first and only fall back to the safe soft delete if the
            // relation still has real history. Shops are never force-deleted here — many
            // tables (products, retailers, employees, tasks...) cascade on shop_id.
            if (!$relation || !($relation instanceof \App\Models\Shop)) {
                try {
                    if ($relation) {
                        $relation->forceDelete();
                    }
                    $entity->forceDelete();
                    return response()->json(['message' => 'Entity deleted']);
                } catch (\Illuminate\Database\QueryException $e) {
                    // Still referenced somewhere real — fall through to soft delete. Must
                    // re-fetch a fresh instance: forceDelete() only resets its internal
                    // "forceDeleting" flag on success, so a failed attempt leaves it stuck
                    // true on $relation, which would silently turn the fallback ->delete()
                    // below into another real hard delete that fails the same way.
                    if ($relation) {
                        $relation = $relation->fresh();
                    }
                    $entity = $entity->fresh();
                }
            }

            if ($relation) {
                $relation->delete();
            }
            $entity->delete();
            return response()->json(['message' => 'Entity deleted']);
        });
    }

    /**
     * Completely purge an entity AND all its transaction history.
     * Matches transactions by both entity ID and entity name for full coverage.
     */
    public function destroyWithHistory(Request $request, Entity $entity)
    {
        if (!$request->user()->hasFullAccess()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        \App\Models\ActivityLog::log('ENTITY_DELETED_WITH_HISTORY', $entity,
            "⚠️ Entity \"{$entity->name}\" and all transaction history permanently deleted by {$request->user()->name}"
        );

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

            // 3. Delete the related morph model and the entity itself. This method
            // promises a *permanent* purge, so actually hard-delete both (not just soft
            // delete) — Customer/Supplier hard deletes are safely guarded by real FK
            // constraints on sale/purchase invoices. Shops are never force-deleted: many
            // tables cascade on shop_id, so a Shop relation still just gets soft-deleted.
            // Both must land in the SAME state (both erased or both merely soft-deleted)
            // — otherwise the entity could vanish while its customer/supplier record is
            // left behind soft-deleted with a now-dangling relation, or vice versa.
            $relation = $entity->relation;
            $fullyErased = false;

            if (!$relation || !($relation instanceof \App\Models\Shop)) {
                try {
                    if ($relation) {
                        $relation->forceDelete();
                    }
                    $entity->forceDelete();
                    $fullyErased = true;
                } catch (\Illuminate\Database\QueryException $e) {
                    // Still referenced somewhere real — fall through to soft delete below.
                    // forceDelete() only clears its internal "forceDeleting" flag on
                    // success, so re-fetch fresh instances or the fallback ->delete() would
                    // silently attempt another real hard delete and fail the same way.
                }
            }

            if (!$fullyErased) {
                if ($relation) {
                    $relation->fresh()?->delete();
                }
                $entity->fresh()->delete();
            }

            return response()->json([
                'message' => $fullyErased
                    ? "\"$name\" and all its transaction history have been permanently deleted."
                    : "\"$name\"'s transaction history was permanently deleted, but the record itself is still referenced elsewhere — it was moved to Trash instead of being fully erased."
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
    public function hardReset(Request $request)
    {
        if (!$request->user()->hasFullAccess()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        \App\Models\ActivityLog::log('ENTITY_HARD_RESET', null,
            "⚠️ DANGER: Full entity/ledger system reset performed by {$request->user()->name}"
        );

        // 1. Clear caches and entities
        DB::statement('SET FOREIGN_KEY_CHECKS=0;');
        DB::table('entity_balances')->truncate();
        DB::table('entities')->truncate();
        DB::statement('SET FOREIGN_KEY_CHECKS=1;');

        // 2. Re-sync from all sources
        $this->autoSync();

        // 3. Re-align cached accounting_entity_id in all transactional tables
        // Since entities were truncated, the old cached IDs are stale and must be mapped to the new entity IDs.
        
        // Purchase Invoices
        \App\Models\PurchaseInvoice::chunkById(100, function ($invoices) {
            foreach ($invoices as $inv) {
                $supplier = $inv->supplier;
                if ($supplier) {
                    $entity = Entity::where('relation_type', \App\Models\Supplier::class)
                        ->where('relation_id', $supplier->id)
                        ->first();
                    if ($entity && $inv->accounting_entity_id !== $entity->id) {
                        $inv->accounting_entity_id = $entity->id;
                        $inv->saveQuietly();
                    }
                }
            }
        });

        // Sale Invoices
        \App\Models\SaleInvoice::chunkById(100, function ($invoices) {
            foreach ($invoices as $inv) {
                $customer = $inv->customer;
                if ($customer) {
                    $entity = Entity::where('relation_type', \App\Models\Customer::class)
                        ->where('relation_id', $customer->id)
                        ->first();
                    if ($entity && $inv->accounting_entity_id !== $entity->id) {
                        $inv->accounting_entity_id = $entity->id;
                        $inv->saveQuietly();
                    }
                }
            }
        });

        // Repair Requests
        \App\Models\RepairRequest::chunkById(100, function ($repairs) {
            foreach ($repairs as $rep) {
                $customer = $rep->customer;
                if ($customer) {
                    $entity = Entity::where('relation_type', \App\Models\Customer::class)
                        ->where('relation_id', $customer->id)
                        ->first();
                    if ($entity && $rep->accounting_entity_id !== $entity->id) {
                        $rep->accounting_entity_id = $entity->id;
                        $rep->saveQuietly();
                    }
                }
            }
        });

        // Loans
        \App\Models\Loan::chunkById(100, function ($loans) {
            foreach ($loans as $loan) {
                $customer = $loan->customer;
                if ($customer) {
                    $entity = Entity::where('relation_type', \App\Models\Customer::class)
                        ->where('relation_id', $customer->id)
                        ->first();
                    if ($entity && $loan->accounting_entity_id !== $entity->id) {
                        $loan->accounting_entity_id = $entity->id;
                        $loan->saveQuietly();
                    }
                }
            }
        });

        // Transactions
        \App\Models\Transaction::chunkById(100, function ($transactions) {
            foreach ($transactions as $tx) {
                $entityId = null;
                if ($tx->entity_type && $tx->entity_id) {
                    $entity = Entity::where('relation_type', $tx->entity_type)
                        ->where('relation_id', $tx->entity_id)
                        ->first();
                    if ($entity) $entityId = $entity->id;
                }
                if (!$entityId && $tx->entity_name) {
                    $entity = Entity::where('name', $tx->entity_name)->first();
                    if (!$entity) {
                        $cleanName = preg_replace('/\s*\(.*?\)\s*/', '', $tx->entity_name);
                        $entity = Entity::where('name', $cleanName)
                            ->orWhere('name', 'like', $cleanName . ' %')
                            ->first();
                    }
                    if ($entity) $entityId = $entity->id;
                }
                if ($entityId && $tx->accounting_entity_id !== $entityId) {
                    $tx->accounting_entity_id = $entityId;
                    $tx->saveQuietly();
                }
            }
        });

        // 4. Truncate ledgers table
        DB::statement('SET FOREIGN_KEY_CHECKS=0;');
        \App\Models\Ledger::truncate();
        DB::statement('SET FOREIGN_KEY_CHECKS=1;');

        // 5. Rebuild unified ledger from all source records
        \App\Models\AirtelDrop::chunk(100, function ($drops) {
            foreach ($drops as $drop) $drop->postToLedger();
        });

        \App\Models\RepairRequest::chunk(100, function ($repairs) {
            foreach ($repairs as $repair) $repair->postToLedger();
        });

        \App\Models\SaleInvoice::chunk(100, function ($sales) {
            foreach ($sales as $sale) $sale->postToLedger();
        });

        \App\Models\PurchaseInvoice::chunk(100, function ($purchases) {
            foreach ($purchases as $purchase) $purchase->postToLedger();
        });

        \App\Models\Transaction::chunk(100, function ($transactions) {
            foreach ($transactions as $transaction) $transaction->postToLedger();
        });

        // 6. Recalculate all balances
        $service = app(\App\Services\EntityService::class);
        $service->syncAll();

        return response()->json(['message' => 'Account system successfully recreated, database entities aligned, and all balances/ledgers rebuilt.']);
    }
}
