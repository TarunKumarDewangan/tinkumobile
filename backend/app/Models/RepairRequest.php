<?php

namespace App\Models;

use App\Traits\UppercaseStrings;
use App\Traits\RecordsTransactions;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RepairRequest extends Model
{
    use UppercaseStrings, RecordsTransactions;
    protected $fillable = [
        'shop_id', 'customer_id', 'customer_name', 'customer_phone', 'customer_email', 'customer_address', 'submitted_date',
        'device_model', 'quoted_amount', 'service_center_cost', 'advance_amount',
        'issue_description', 'status', 'assigned_to',
        'is_forwarded', 'forwarded_to', 'forwarded_phone', 'external_expected_delivery',
        'estimated_delivery_date', 'actual_delivery_date', 'created_by', 'staff_id',
        'balance_amount_received', 'balance_received_at'
    ];

    protected $casts = [
        'issue_description' => 'array',
        'is_forwarded' => 'boolean',
        'quoted_amount' => 'decimal:2',
        'service_center_cost' => 'decimal:2',
        'advance_amount' => 'decimal:2',
        'balance_amount_received' => 'decimal:2',
        'balance_received_at' => 'datetime',
    ];

    public function shop(): BelongsTo { return $this->belongsTo(Shop::class); }
    public function assignedTo(): BelongsTo { return $this->belongsTo(User::class, 'assigned_to'); }
    public function staff(): BelongsTo { return $this->belongsTo(User::class, 'staff_id'); }
}
