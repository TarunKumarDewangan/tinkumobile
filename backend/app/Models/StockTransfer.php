<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class StockTransfer extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'from_shop_id', 'to_shop_id', 'product_id', 'imei', 'quantity',
        'status', 'initiated_by', 'received_by',
        'transfer_date', 'received_at', 'notes', 'source_breakdown',
    ];

    protected $casts = [
        'quantity'         => 'integer',
        'transfer_date'    => 'date',
        'received_at'      => 'datetime',
        'source_breakdown' => 'array',
    ];

    public function fromShop(): BelongsTo   { return $this->belongsTo(Shop::class, 'from_shop_id'); }
    public function toShop(): BelongsTo     { return $this->belongsTo(Shop::class, 'to_shop_id'); }
    public function product(): BelongsTo    { return $this->belongsTo(Product::class); }
    public function initiator(): BelongsTo  { return $this->belongsTo(User::class, 'initiated_by'); }
    public function receiver(): BelongsTo   { return $this->belongsTo(User::class, 'received_by'); }
}
