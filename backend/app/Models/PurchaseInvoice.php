<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Traits\RecordsTransactions;

use App\Traits\PostsToLedger;

class PurchaseInvoice extends Model
{
    use PostsToLedger;
    use SoftDeletes, RecordsTransactions;

    protected function getLedgerData(): ?array
    {
        $supplier = $this->supplier;
        if (!$supplier) return null;
        
        $entity = \App\Models\Entity::where('name', $supplier->name)->first();
        if (!$entity) return null;

        // Credit Purchase = Credit the Supplier (we owe them)
        return [
            'entity_id' => $entity->id,
            'date' => $this->purchase_date,
            'voucher_type' => 'PURCHASE',
            'particulars' => 'Purchase Invoice: #' . $this->invoice_no,
            'debit' => 0,
            'credit' => $this->grand_total,
            'user_id' => $this->user_id,
            'shop_id' => $this->shop_id,
        ];
    }

    protected $fillable = [
        'invoice_no', 'bill_type', 'shop_id', 'supplier_id', 'user_id', 'purchase_date', 'expected_delivery_date',
        'status', 'received_at',
        'total_amount', 'grand_total', 'total_paid', 'payment_status', 'cgst_rate', 'sgst_rate', 
        'cgst_amount', 'sgst_amount', 'calculate_gst', 'cash_discount', 'is_cash_discount_on_bill',
        'payment_method', 'rounding_mode', 'round_off', 'notes', 'accounting_entity_id'
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

    public function getSupplierNameAttribute()
    {
        return $this->supplier?->name;
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
