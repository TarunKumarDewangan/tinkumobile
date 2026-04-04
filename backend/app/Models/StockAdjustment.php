<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockAdjustment extends Model
{
    protected $fillable = [
        'shop_id', 'product_id', 'user_id',
        'type',            // 'add' or 'remove'
        'quantity',
        'reason',          // opening_stock, previous_purchase, correction_add, etc.
        'purchase_price',  // optional cost price at time of entry
        'notes',
        'adjustment_date',
    ];

    protected $casts = [
        'quantity'       => 'integer',
        'purchase_price' => 'decimal:2',
        'adjustment_date' => 'date',
    ];

    public function shop(): BelongsTo    { return $this->belongsTo(Shop::class); }
    public function product(): BelongsTo { return $this->belongsTo(Product::class); }
    public function user(): BelongsTo    { return $this->belongsTo(User::class); }
}
