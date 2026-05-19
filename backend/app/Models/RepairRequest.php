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

    public static function boot()
    {
        parent::boot();

        static::saving(function ($model) {
            if ($model->customer_name && !$model->accounting_entity_id) {
                $entity = \App\Models\Entity::where('name', $model->customer_name)->first();
                if ($entity) {
                    $model->accounting_entity_id = $entity->id;
                }
            }
        });
    }

    protected function getLedgerData(): ?array
    {
        $entries = [];

        // 1. Customer Ledger Entry
        if ($this->customer_name) {
            $customerEntity = \App\Models\Entity::where('name', $this->customer_name)->first();
            if ($customerEntity) {
                $entries[] = [
                    'entity_id' => $customerEntity->id,
                    'date' => $this->submitted_date,
                    'voucher_type' => 'REPAIR',
                    'particulars' => 'Repair Service: #' . $this->id . ' (' . ($this->device_model ?? 'Device') . ')',
                    'debit' => $this->quoted_amount,
                    'credit' => 0,
                    'user_id' => $this->staff_id ?? 1,
                    'shop_id' => $this->shop_id,
                ];
            }
        }

        // 2. Forwarded Shop Ledger Entry
        if ($this->is_forwarded && $this->forwarded_to) {
            $shopEntity = \App\Models\Entity::firstOrCreate(
                ['name' => $this->forwarded_to],
                [
                    'phone' => $this->forwarded_phone,
                    'group' => 'SUNDRY_CREDITORS',
                    'balance_type' => 'PAYABLE',
                    'opening_balance' => 0
                ]
            );

            // Forwarding to a shop = Credit the Shop (we owe them money for the repair cost)
            $entries[] = [
                'entity_id' => $shopEntity->id,
                'date' => $this->submitted_date,
                'voucher_type' => 'REPAIR',
                'particulars' => 'Forwarded Repair Cost: #' . $this->id . ' (' . ($this->device_model ?? 'Device') . ')',
                'debit' => 0,
                'credit' => $this->service_center_cost ?? 0,
                'user_id' => $this->staff_id ?? 1,
                'shop_id' => $this->shop_id,
            ];
        }

        return empty($entries) ? null : $entries;
    }

    protected $fillable = [
        'accounting_entity_id',
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
