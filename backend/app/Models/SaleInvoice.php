<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Traits\RecordsTransactions;

use App\Traits\PostsToLedger;

class SaleInvoice extends Model
{
    use PostsToLedger;
    use SoftDeletes, RecordsTransactions;

    public static function boot()
    {
        parent::boot();

        static::saving(function ($model) {
            if ($model->isDirty('customer_id') || !$model->accounting_entity_id) {
                // Prefer existing FK if already set
                $entity = null;
                if ($model->accounting_entity_id) {
                    $entity = \App\Models\Entity::find($model->accounting_entity_id);
                }
                // Fall back to name lookup only if FK is null
                if (!$entity && $model->customer_id) {
                    $customer = \App\Models\Customer::find($model->customer_id);
                    if ($customer) {
                        $entity = \App\Models\Entity::where('name', $customer->name)->first();
                        if ($entity) {
                            $model->accounting_entity_id = $entity->id;
                        }
                    }
                }
            }
        });
    }

    protected function getLedgerData(): ?array
    {
        if ($this->is_cancelled) return null;

        $customer = $this->customer;
        if (!$customer) return null;

        // Use accounting_entity_id FK first, fall back to name lookup
        $entity = null;
        if ($this->accounting_entity_id) {
            $entity = \App\Models\Entity::find($this->accounting_entity_id);
        }
        if (!$entity) {
            $entity = \App\Models\Entity::where('name', $customer->name)->first();
        }
        if (!$entity) {
            // No entity found — log warning and skip to avoid ledger corruption
            \Illuminate\Support\Facades\Log::warning("No entity found for customer '{$customer->name}' on Sale Invoice #{$this->invoice_no}. Ledger entry skipped.");
            return null;
        }

        $entries = [];

        // 1. Credit Sale = Debit the Customer for Grand Total (they owe us the full amount initially)
        $entries[] = [
            'entity_id'    => $entity->id,
            'date'         => $this->sale_date,
            'voucher_type' => 'SALE',
            'particulars'  => 'Sale Invoice: #' . $this->invoice_no,
            'debit'        => $this->grand_total,
            'credit'       => 0,
            'user_id'      => $this->user_id,
            'shop_id'      => $this->shop_id,
        ];

        // If there is a finance portion, adjust the customer and finance company accounts
        if ($this->finance_amount > 0 && $this->financer_id) {
            $financer = \App\Models\Entity::find($this->financer_id);
            $financerName = $financer ? $financer->name : 'Finance Company';

            // 2. Credit the Customer for the Finance amount (offset customer's debt because financer takes it over)
            $entries[] = [
                'entity_id'    => $entity->id,
                'date'         => $this->sale_date,
                'voucher_type' => 'SALE_FINANCE',
                'particulars'  => "Finance by {$financerName} for Invoice #{$this->invoice_no}",
                'debit'        => 0,
                'credit'       => $this->finance_amount,
                'user_id'      => $this->user_id,
                'shop_id'      => $this->shop_id,
            ];

            // 3. Debit the Finance Company for the Finance amount (Receivable from them)
            $entries[] = [
                'entity_id'    => $this->financer_id,
                'date'         => $this->sale_date,
                'voucher_type' => 'FINANCE_PENDING',
                'particulars'  => "Finance Receivable from {$financerName} for Invoice #{$this->invoice_no}",
                'debit'        => $this->finance_amount,
                'credit'       => 0,
                'user_id'      => $this->user_id,
                'shop_id'      => $this->shop_id,
            ];
        }

        return $entries;
    }

    protected $fillable = [
        'invoice_no', 'shop_id', 'customer_id', 'user_id', 'sold_by_id', 'sale_date',
        'total_amount', 'discount', 'grand_total', 'total_paid', 'exchange_paid', 'payment_status',
        'cgst_rate', 'sgst_rate', 'cgst_amount', 'sgst_amount', 'rounding_mode', 'round_off',
        'calculate_gst', 'cash_discount', 'is_cash_discount_on_bill',
        'payment_method', 'bill_type', 'parent_bill_id', 'is_cancelled', 'notes', 'accounting_entity_id',
        'financer_id', 'down_payment', 'finance_amount', 'finance_payment_status',
    ];

    protected $casts = [
        'is_cancelled' => 'boolean',
        'total_amount' => 'decimal:2',
        'discount'     => 'decimal:2',
        'cgst_amount'  => 'decimal:2',
        'sgst_amount'  => 'decimal:2',
        'cash_discount' => 'decimal:2',
        'calculate_gst' => 'boolean',
        'is_cash_discount_on_bill' => 'boolean',
        'total_paid'   => 'decimal:2',
        'exchange_paid'=> 'decimal:2',
        'grand_total'  => 'decimal:2',
        'round_off'    => 'decimal:2',
    ];
    
    public function getCustomerNameAttribute()
    {
        return $this->customer?->name;
    }
    
    public function getCustomerPhoneAttribute()
    {
        return $this->customer?->phone;
    }

    public function updatePaymentStatus()
    {
        $paid = (float) $this->total_paid + (float) $this->exchange_paid;
        // Finance amount counts as "paid" if the status is RECEIVED; if PENDING it's still outstanding from financer
        if ($this->finance_payment_status === 'RECEIVED') {
            $paid += (float) $this->finance_amount;
        }
        $total = (float) $this->grand_total;

        if ($paid >= $total) {
            $this->payment_status = 'paid';
        } elseif ($paid > 0) {
            $this->payment_status = 'partial';
        } else {
            $this->payment_status = 'unpaid';
        }
        $this->save();
    }

    public function shop(): BelongsTo { return $this->belongsTo(Shop::class); }
    public function customer(): BelongsTo { return $this->belongsTo(Customer::class); }
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
    public function soldBy(): BelongsTo { return $this->belongsTo(User::class, 'sold_by_id'); }
    public function items(): HasMany { return $this->hasMany(SaleItem::class); }
    public function giftItems(): HasMany { return $this->hasMany(SaleGiftItem::class); }
    public function parentBill(): BelongsTo { return $this->belongsTo(SaleInvoice::class, 'parent_bill_id'); }
    public function childBills(): HasMany { return $this->hasMany(SaleInvoice::class, 'parent_bill_id'); }
    public function financer(): BelongsTo { return $this->belongsTo(\App\Models\Entity::class, 'financer_id'); }
    public function financePlan(): HasOne { return $this->hasOne(SaleFinancePlan::class); }
}

