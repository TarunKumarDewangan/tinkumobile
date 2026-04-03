<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PurchaseItem extends Model
{
    public $timestamps = false;
    protected $fillable = ['purchase_invoice_id', 'product_id', 'imei', 'ram', 'storage', 'color', 'quantity', 'received_quantity', 'damaged_quantity', 'unit_price', 'selling_price', 'total'];

    public function invoice(): BelongsTo { return $this->belongsTo(PurchaseInvoice::class, 'purchase_invoice_id'); }
    public function product(): BelongsTo { return $this->belongsTo(Product::class); }
}
