<?php

namespace App\Models;

use App\Traits\UppercaseStrings;
use App\Traits\RecordsTransactions;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

use App\Traits\PostsToLedger;

class RepairRequest extends Model
{
    use PostsToLedger;
    use UppercaseStrings, RecordsTransactions;

    protected function getLedgerData(): ?array
    {
        $entity = null;
        if ($this->customer_name) {
            $entity = \App\Models\Entity::where('name', $this->customer_name)->first();
        }
        if (!$entity) return null;

        // Repair Service = Debit the Customer (they owe us)
        return [
            'entity_id' => $entity->id,
            'date' => $this->submitted_date,
            'voucher_type' => 'REPAIR',
            'particulars' => 'Repair Service: #' . $this->id,
            'debit' => $this->quoted_amount,
            'credit' => 0,
            'user_id' => $this->staff_id ?? 1,
            'shop_id' => $this->shop_id,
        ];
    }

    protected $fillable = [
        'shop_id', 'customer_id', 'customer_name', 'customer_phone', 'customer_email', 'customer_address', 'submitted_date',
        'device_model', 'quoted_amount', 'is_pay_later', 'service_center_cost', 'advance_amount', 'advance_payment_mode',
        'issue_description', 'status', 'assigned_to',
        'is_forwarded', 'forwarded_to', 'forwarded_phone', 'external_expected_delivery',
        'estimated_delivery_date', 'actual_delivery_date', 'created_by', 'staff_id',
        'balance_amount_received', 'balance_payment_mode', 'balance_received_at',
        'is_cost_paid', 'cost_paid_at'
    ];

    protected $casts = [
        'issue_description' => 'array',
        'is_forwarded' => 'boolean',
        'is_pay_later' => 'boolean',
        'quoted_amount' => 'decimal:2',
        'service_center_cost' => 'decimal:2',
        'advance_amount' => 'decimal:2',
        'balance_amount_received' => 'decimal:2',
        'balance_received_at' => 'datetime',
        'is_cost_paid' => 'boolean',
        'cost_paid_at' => 'datetime',
    ];

    public function shop(): BelongsTo { return $this->belongsTo(Shop::class); }
    public function assignedTo(): BelongsTo { return $this->belongsTo(User::class, 'assigned_to'); }
    public function staff(): BelongsTo { return $this->belongsTo(User::class, 'staff_id'); }
}
