<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

use App\Traits\SyncsBalances;

class Transaction extends Model
{
    use SyncsBalances;
    use SoftDeletes;

    protected $fillable = [
        'shop_id', 
        'user_id', 
        'type', 
        'category', 
        'amount', 
        'payment_mode', 
        'entity_type', 
        'entity_id', 
        'accounting_entity_id',
        'description', 
        'entity_name',
        'ref_id', 
        'transaction_date'
    ];

    protected $casts = [
        'transaction_date' => 'date',
        'amount' => 'float',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function shop()
    {
        return $this->belongsTo(Shop::class);
    }

    public function entity()
    {
        return $this->morphTo();
    }
}
