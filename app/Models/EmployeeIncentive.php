<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmployeeIncentive extends Model
{
    protected $fillable = [
        'user_id', 'sale_item_id', 'product_id', 'incentive_amount', 'paid_status', 'payment_date', 'notes'
    ];

    protected $casts = ['paid_status' => 'boolean'];

    public function user(): BelongsTo { return $this->belongsTo(User::class); }
    public function saleItem(): BelongsTo { return $this->belongsTo(SaleItem::class); }
    public function product(): BelongsTo { return $this->belongsTo(Product::class); }
}
