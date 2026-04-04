<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RepairRequest extends Model
{
    protected $fillable = [
        'shop_id', 'customer_name', 'customer_phone', 'customer_email',
        'device_model', 'issue_description', 'status', 'assigned_to',
        'estimated_delivery_date', 'actual_delivery_date', 'created_by', 'staff_id'
    ];

    public function shop(): BelongsTo { return $this->belongsTo(Shop::class); }
    public function assignedTo(): BelongsTo { return $this->belongsTo(User::class, 'assigned_to'); }
    public function staff(): BelongsTo { return $this->belongsTo(User::class, 'staff_id'); }
}
