<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

use App\Traits\RecordsTransactions;

class OldMobilePurchase extends Model
{
    use RecordsTransactions, \App\Traits\MirrorsToSupabase;
    protected $fillable = [
        'shop_id', 'customer_id', 'product_id', 'model_name', 'imei', 'ram', 'storage', 'color', 'purchase_price', 'selling_price', 'is_exchange', 'pay_later', 'condition_note', 'purchase_date', 'user_id', 'batch_id'
    ];

    protected $casts = [
        'is_exchange' => 'boolean',
        'pay_later' => 'boolean',
        'purchase_price' => 'decimal:2',
        'selling_price' => 'decimal:2',
    ];

    public function shop(): BelongsTo { return $this->belongsTo(Shop::class); }
    public function customer(): BelongsTo { return $this->belongsTo(Customer::class); }
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
    public function product(): BelongsTo { return $this->belongsTo(Product::class); }
}
