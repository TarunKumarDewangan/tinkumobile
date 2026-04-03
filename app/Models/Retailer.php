<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Retailer extends Model
{
    protected $fillable = ['msisdn', 'name', 'address', 'balance', 'shop_id'];

    public function shop()
    {
        return $this->belongsTo(Shop::class);
    }

    public function drops()
    {
        return $this->hasMany(AirtelDrop::class);
    }
}
