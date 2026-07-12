<?php

namespace App\Traits;

use App\Models\Entity;

trait SyncsWithMasterEntity
{
    public static function bootSyncsWithMasterEntity()
    {
        static::saved(function ($model) {
            $model->syncToMasterEntity();
        });
    }

    public function syncToMasterEntity()
    {
        $typeMap = [
            \App\Models\Customer::class => 'CUSTOMER',
            \App\Models\Supplier::class => 'SUPPLIER',
            \App\Models\Retailer::class => 'RETAILER',
            \App\Models\User::class     => 'STAFF',
            \App\Models\Shop::class     => 'SHOP',
        ];

        $type = $typeMap[get_class($this)] ?? 'OTHER';
        
        // Handle Customer Sub-types
        if (get_class($this) === \App\Models\Customer::class && ($this->category ?? '') === 'SHOP') {
            $type = 'SHOP_CUSTOMER';
        }

        $phoneField = get_class($this) === \App\Models\Retailer::class ? 'msisdn' : 'phone';

        // 1. Try finding by relation first
        $entity = Entity::where('relation_type', get_class($this))
            ->where('relation_id', $this->id)
            ->first();

        $targetName = $this->name;

        if (!$entity) {
            // Check if name is taken by someone else
            $exists = Entity::where('name', $targetName)->first();
            
            if ($exists) {
                if (!$exists->relation_id) {
                    // Claim this ghost entity (e.g. created by name in Repairs)
                    $entity = $exists;
                    $entity->relation_type = get_class($this);
                    $entity->relation_id   = $this->id;
                } else {
                    // Name taken by another record. Find a new unique name.
                    $targetName = $this->generateUniqueEntityName($this->name, $type);
                    $entity = new Entity([
                        'relation_type' => get_class($this),
                        'relation_id'   => $this->id,
                        'name'          => $targetName,
                    ]);
                }
            } else {
                // Completely new
                $entity = new Entity([
                    'relation_type' => get_class($this),
                    'relation_id'   => $this->id,
                    'name'          => $targetName,
                ]);
            }
        } else {
            // Existing relation. Check if name changed to something taken.
            if ($entity->name !== $this->name) {
                // If it's a simple name change and not a conflict with another relation, we can keep it.
                // But if the name is now taken by another RELATION, we need a suffix.
                if (Entity::where('name', $targetName)->where('id', '!=', $entity->id)->exists()) {
                    $targetName = $this->generateUniqueEntityName($this->name, $type, $entity->id);
                }
                $entity->name = $targetName;
            }
        }

        $gstField = isset($this->gstin) ? 'gstin' : 'gst_no';
        $entity->fill([
            'type'  => $type,
            'phone' => $this->$phoneField ?? null,
            'email' => $this->email ?? null,
            'gst_number' => $this->$gstField ?? null,
            'address' => $this->address ?? null,
            'opening_balance' => $this->balance ?? $this->opening_balance ?? request('opening_balance') ?? $entity->opening_balance ?? 0,
            'balance_type' => $this->balance_type ?? request('balance_type') ?? $entity->balance_type ?? 'RECEIVABLE',
        ]);

        $entity->save();
    }

    private function generateUniqueEntityName($baseName, $type, $excludeId = null)
    {
        $name = $baseName . " ($type)";
        $query = Entity::where('name', $name);
        if ($excludeId) $query->where('id', '!=', $excludeId);
        
        if (!$query->exists()) {
            return $name;
        }

        // Try increments
        $i = 1;
        while (true) {
            $name = $baseName . " ($type) " . $i;
            $query = Entity::where('name', $name);
            if ($excludeId) $query->where('id', '!=', $excludeId);
            
            if (!$query->exists()) {
                return $name;
            }
            $i++;
            if ($i > 100) break; // Safety break
        }
        return $name;
    }
}
