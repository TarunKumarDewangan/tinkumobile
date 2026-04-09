<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Traits\RecordsTransactions;

class PurchaseInvoice extends Model
{
    use SoftDeletes, RecordsTransactions;

    protected $fillable = [
        'invoice_no', 'bill_type', 'shop_id', 'supplier_id', 'user_id', 'purchase_date', 'expected_delivery_date',
        'status', 'received_at',
        'total_amount', 'grand_total', 'total_paid', 'payment_status', 'cgst_rate', 'sgst_rate', 
        'cgst_amount', 'sgst_amount', 'calculate_gst', 'cash_discount', 'is_cash_discount_on_bill',
        'payment_method', 'rounding_mode', 'round_off', 'notes'
    ];

    public function updatePaymentStatus()
    {
        $grandTotal = (float) $this->grand_total;
        $totalPaid  = (float) $this->total_paid;

        if ($totalPaid <= 0) {
            $this->payment_status = 'unpaid';
        } elseif ($totalPaid >= $grandTotal) {
            $this->payment_status = 'paid';
        } else {
            $this->payment_status = 'partial';
        }
        $this->save();
    }
    protected $casts = [
        'expected_delivery_date' => 'date',
        'received_at' => 'datetime'
    ];

    public function shop(): BelongsTo { return $this->belongsTo(Shop::class); }
    public function supplier(): BelongsTo { return $this->belongsTo(Supplier::class); }
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
    public function items(): HasMany { return $this->hasMany(PurchaseItem::class); }
}
