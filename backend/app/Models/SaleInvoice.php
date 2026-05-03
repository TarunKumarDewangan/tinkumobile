<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Traits\RecordsTransactions;

use App\Traits\PostsToLedger;

class SaleInvoice extends Model
{
    use PostsToLedger;
    use SoftDeletes, RecordsTransactions;

    protected function getLedgerData(): ?array
    {
        $customer = $this->customer;
        if (!$customer) return null;
        
        $entity = \App\Models\Entity::where('name', $customer->name)->first();
        if (!$entity) return null;

        // Credit Sale = Debit the Customer (they owe us)
        // If it was paid by cash immediately, a Transaction (Receipt) will offset it.
        return [
            'entity_id' => $entity->id,
            'date' => $this->sale_date,
            'voucher_type' => 'SALE',
            'particulars' => 'Sale Invoice: #' . $this->invoice_no,
            'debit' => $this->grand_total,
            'credit' => 0,
            'user_id' => $this->user_id,
            'shop_id' => $this->shop_id,
        ];
    }

    protected $fillable = [
        'invoice_no', 'shop_id', 'customer_id', 'user_id', 'sold_by_id', 'sale_date',
        'total_amount', 'discount', 'grand_total', 'total_paid', 'payment_status',
        'cgst_rate', 'sgst_rate', 'cgst_amount', 'sgst_amount', 'rounding_mode', 'round_off',
        'calculate_gst', 'cash_discount', 'is_cash_discount_on_bill',
        'payment_method', 'bill_type', 'parent_bill_id', 'is_cancelled', 'notes'
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
        'grand_total'  => 'decimal:2',
        'round_off'    => 'decimal:2',
    ];

    public function updatePaymentStatus()
    {
        $paid = (float) $this->total_paid;
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
}
