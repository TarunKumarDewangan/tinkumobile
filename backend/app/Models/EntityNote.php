<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EntityNote extends Model
{
    protected $fillable = [
        'entity_id',
        'name',
        'phone',
        'category',
        'promise_date',
        'note',
        'balance_at_time',
        'shop_id',
        'created_by',
    ];

    protected $casts = [
        'promise_date' => 'date:Y-m-d',
        'balance_at_time' => 'float',
    ];

    public function entity()
    {
        return $this->belongsTo(Entity::class);
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
