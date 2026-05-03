<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Ledger extends Model
{
    use \Illuminate\Database\Eloquent\SoftDeletes;

    protected $fillable = [
        'entity_id',
        'shop_id',
        'user_id',
        'date',
        'voucher_type',
        'voucher_id',
        'particulars',
        'debit',
        'credit'
    ];

    protected $casts = [
        'date' => 'date',
        'debit' => 'float',
        'credit' => 'float',
    ];

    public function entity()
    {
        return $this->belongsTo(Entity::class);
    }

    public function shop()
    {
        return $this->belongsTo(Shop::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
