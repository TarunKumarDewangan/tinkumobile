<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Traits\UppercaseStrings;

class Entity extends Model
{
    use UppercaseStrings;
    use SoftDeletes;
    protected $fillable = [
        'name',
        'type',
        'relation_type',
        'relation_id',
        'phone',
        'address',
        'email',
        'gst_number',
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
     * Refactored calculateBalances to use the service (always live, no stale cache).
     * Keeps the method signature for compatibility.
     */
    public static function calculateBalances($entities)
    {
        if ($entities->isEmpty()) return $entities;
        
        $service = app(\App\Services\EntityService::class);
        
        // Always recalculate live — never read from potentially stale cache
        $calculated = $service->calculateBalances($entities);
        
        return $calculated->map(function ($entity) {
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
