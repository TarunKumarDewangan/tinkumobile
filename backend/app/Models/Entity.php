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
     * Get the related model instance (Customer, Shop, etc.)
     */
    public function relation()
    {
        return $this->morphTo();
    }
}
