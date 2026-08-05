<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FollowUp extends Model
{
    protected $fillable = [
        'customer_id', 'shop_id', 'created_by',
        'interested_product_ids', 'address', 'follow_up_date', 'notes', 'status', 'completed_at',
    ];

    protected $casts = ['interested_product_ids' => 'array'];

    public function customer(): BelongsTo  { return $this->belongsTo(Customer::class); }
    public function shop(): BelongsTo      { return $this->belongsTo(\App\Models\Shop::class); }
    public function createdBy(): BelongsTo { return $this->belongsTo(\App\Models\User::class, 'created_by'); }
}
