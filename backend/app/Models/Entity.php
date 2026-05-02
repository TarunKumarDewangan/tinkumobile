<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Entity extends Model
{
    protected $fillable = [
        'name',
        'type',
        'relation_type',
        'relation_id',
        'phone',
        'email',
        'opening_balance',
        'balance_type',
        'description'
    ];

    protected $casts = [
        'opening_balance' => 'float',
    ];

    /**
     * Get the cached balance record.
     */
    public function balance()
    {
        return $this->hasOne(EntityBalance::class);
    }

    /**
     * Accessor for net balance, fetching from cache or sync if missing.
     */
    public function getNetBalanceAttribute()
    {
        if (array_key_exists('net_balance', $this->attributes)) {
            return (float)$this->attributes['net_balance'];
        }
        return $this->balance ? $this->balance->net_balance : 0;
    }

    /**
     * Refactored calculateBalances to use the service.
     * Keeps the method signature for compatibility.
     */
    public static function calculateBalances($entities)
    {
        if ($entities->isEmpty()) return $entities;
        
        $service = app(\App\Services\EntityService::class);
        
        // Return entities with attributes loaded from cache or recalculation
        return $entities->map(function ($entity) use ($service) {
            $cached = $entity->balance;
            
            if (!$cached) {
                // If no cache exists, sync it now (fallback for new entities)
                $cached = $service->syncBalance($entity);
            }

            $entity->setAttribute('in_worth', (float)$cached->in_worth);
            $entity->setAttribute('out_worth', (float)$cached->out_worth);
            $entity->setAttribute('unrealized', (float)$cached->unrealized);
            $entity->setAttribute('net_balance', (float)$cached->net_balance);
            $entity->setAttribute('repair_dues', (float)$cached->repair_dues);
            $entity->setAttribute('entity_name', $entity->name);
            $entity->setAttribute('phone', $entity->phone);
            $entity->setAttribute('opening_balance', (float)$entity->opening_balance);

            return $entity;
        });
    }


    /**
     * Get the related model instance (Customer, Shop, etc.)
     */
    public function relation()
    {
        return $this->morphTo();
    }
}
