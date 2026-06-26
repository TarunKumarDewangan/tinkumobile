<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SaleGiftItem extends Model
{
    public $timestamps = false;
    protected $fillable = ['sale_invoice_id', 'gift_product_id', 'quantity'];

    public function saleInvoice(): BelongsTo { return $this->belongsTo(SaleInvoice::class); }
    public function giftProduct(): BelongsTo { return $this->belongsTo(GiftProduct::class); }
}
