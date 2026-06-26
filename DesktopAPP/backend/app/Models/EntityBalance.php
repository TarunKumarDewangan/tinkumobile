<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EntityBalance extends Model
{
    protected $fillable = [
        'entity_id',
        'in_worth',
        'out_worth',
        'unrealized',
        'net_balance',
        'repair_dues'
    ];

    public function entity()
    {
        return $this->belongsTo(Entity::class);
    }
}
