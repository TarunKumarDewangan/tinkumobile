<?php

namespace App\Models;

use App\Traits\UppercaseStrings;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SimCard extends Model
{
    use UppercaseStrings;
    protected $fillable = [
        'shop_id', 'sim_number', 'mobile_number', 'operator',
        'purchase_price', 'selling_price', 'status', 'purchased_from', 'sold_to',
        'purchase_date', 'sale_date', 'user_id_purchase', 'user_id_sale'
    ];

    public function shop(): BelongsTo { return $this->belongsTo(Shop::class); }
    public function supplier(): BelongsTo { return $this->belongsTo(Supplier::class, 'purchased_from'); }
    public function customer(): BelongsTo { return $this->belongsTo(Customer::class, 'sold_to'); }
    public function purchaseUser(): BelongsTo { return $this->belongsTo(User::class, 'user_id_purchase'); }
    public function saleUser(): BelongsTo { return $this->belongsTo(User::class, 'user_id_sale'); }
}
