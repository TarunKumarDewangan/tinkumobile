<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SimStockEntry extends Model
{
    protected $fillable = [
        'shop_id', 'type', 'distributor_id', 'operator', 'quantity',
        'price_per_sim', 'total_price', 'remarks', 'entry_date', 'user_id',
    ];

    protected $casts = [
        'entry_date' => 'date',
        'price_per_sim' => 'decimal:2',
        'total_price' => 'decimal:2',
    ];

    public function shop(): BelongsTo { return $this->belongsTo(Shop::class); }
    public function distributor(): BelongsTo { return $this->belongsTo(Entity::class, 'distributor_id'); }
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
}
