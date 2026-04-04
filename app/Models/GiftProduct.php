<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class GiftProduct extends Model
{
    protected $fillable = ['name', 'sku', 'purchase_price'];

    public function inventory(): HasMany { return $this->hasMany(GiftInventory::class); }
    public function saleItems(): HasMany { return $this->hasMany(SaleGiftItem::class); }
}
