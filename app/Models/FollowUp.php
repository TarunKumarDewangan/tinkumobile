<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FollowUp extends Model
{
    protected $fillable = [
        'customer_id', 'interested_product_ids', 'address', 'follow_up_date', 'notes', 'status', 'completed_at'
    ];

    protected $casts = ['interested_product_ids' => 'array'];

    public function customer(): BelongsTo { return $this->belongsTo(Customer::class); }
}
