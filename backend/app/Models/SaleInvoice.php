<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class SaleInvoice extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'invoice_no', 'shop_id', 'customer_id', 'user_id', 'sale_date',
        'total_amount', 'discount', 'grand_total', 'total_paid', 'payment_status',
        'cgst_rate', 'sgst_rate', 'cgst_amount', 'sgst_amount', 'rounding_mode', 'round_off',
        'payment_method', 'bill_type', 'parent_bill_id', 'is_cancelled', 'notes'
    ];

    protected $casts = [
        'is_cancelled' => 'boolean',
        'total_amount' => 'decimal:2',
        'discount'     => 'decimal:2',
        'cgst_amount'  => 'decimal:2',
        'sgst_amount'  => 'decimal:2',
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
    public function items(): HasMany { return $this->hasMany(SaleItem::class); }
    public function giftItems(): HasMany { return $this->hasMany(SaleGiftItem::class); }
    public function parentBill(): BelongsTo { return $this->belongsTo(SaleInvoice::class, 'parent_bill_id'); }
    public function childBills(): HasMany { return $this->hasMany(SaleInvoice::class, 'parent_bill_id'); }
}
