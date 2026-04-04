<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SaleItem extends Model
{
    public $timestamps = false;
    protected $fillable = [
        'sale_invoice_id', 'product_id', 'imei', 'ram', 'storage', 'color', 
        'quantity', 'unit_price', 'total'
    ];

    public function invoice(): BelongsTo { return $this->belongsTo(SaleInvoice::class, 'sale_invoice_id'); }
    public function product(): BelongsTo { return $this->belongsTo(Product::class); }
    public function incentive() { return $this->hasOne(EmployeeIncentive::class); }
}
