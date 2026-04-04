<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RechargePurchase extends Model
{
    protected $fillable = ['shop_id', 'supplier_id', 'operator', 'amount', 'cost_price', 'purchase_date', 'user_id'];

    public function shop(): BelongsTo { return $this->belongsTo(Shop::class); }
    public function supplier(): BelongsTo { return $this->belongsTo(Supplier::class); }
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
}
