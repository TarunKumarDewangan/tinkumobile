<?php

namespace App\Models;

use App\Traits\UppercaseStrings;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Retailer extends Model
{
    use SoftDeletes, UppercaseStrings;

    protected $fillable = ['name', 'msisdn', 'shop_id', 'balance', 'status'];

    public function shop()
    {
        return $this->belongsTo(Shop::class);
    }

    public function drops()
    {
        return $this->hasMany(AirtelDrop::class);
    }

    public function recoveries()
    {
        return $this->hasMany(AirtelRecovery::class);
    }
}
