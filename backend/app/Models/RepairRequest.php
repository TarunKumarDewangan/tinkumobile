<?php

namespace App\Models;

use App\Traits\UppercaseStrings;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RepairRequest extends Model
{
    use UppercaseStrings;
    protected $fillable = [
        'shop_id', 'customer_name', 'customer_phone', 'customer_email', 'submitted_date',
        'device_model', 'issue_description', 'status', 'assigned_to',
        'is_forwarded', 'forwarded_to', 'forwarded_phone', 'external_expected_delivery',
        'estimated_delivery_date', 'actual_delivery_date', 'created_by', 'staff_id'
    ];

    protected $casts = [
        'issue_description' => 'array',
        'is_forwarded' => 'boolean',
    ];

    public function shop(): BelongsTo { return $this->belongsTo(Shop::class); }
    public function assignedTo(): BelongsTo { return $this->belongsTo(User::class, 'assigned_to'); }
    public function staff(): BelongsTo { return $this->belongsTo(User::class, 'staff_id'); }
}
