<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

use App\Traits\RecordsTransactions;

class OldMobilePurchase extends Model
{
    use RecordsTransactions;
    protected $fillable = [
        'shop_id', 'customer_id', 'model_name', 'imei', 'purchase_price', 'condition_note', 'purchase_date', 'user_id'
    ];

    public function shop(): BelongsTo { return $this->belongsTo(Shop::class); }
    public function customer(): BelongsTo { return $this->belongsTo(Customer::class); }
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
}
