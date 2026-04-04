<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GiftInventory extends Model
{
    protected $fillable = ['shop_id', 'gift_product_id', 'stock'];

    public function shop(): BelongsTo { return $this->belongsTo(Shop::class); }
    public function giftProduct(): BelongsTo { return $this->belongsTo(GiftProduct::class); }
}
