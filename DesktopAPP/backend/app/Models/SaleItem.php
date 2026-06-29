<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SaleItem extends Model
{
    public $timestamps = false;
    protected $fillable = [
        'sale_invoice_id', 'product_id', 'imei', 'ram', 'storage', 'color', 'description', 
        'quantity', 'unit_price', 'total', 'apply_gst'
    ];

    protected $casts = [
        'apply_gst' => 'boolean',
    ];

    protected static function boot()
    {
        parent::boot();

        $sanitize = function ($model) {
            $clean = function ($str) {
                if (is_null($str)) return null;
                $str = preg_replace('/[\x{00A0}\x{200B}\s]+/u', ' ', $str);
                return trim($str);
            };

            if (isset($model->color)) $model->color = $clean($model->color);
            if (isset($model->ram)) $model->ram = $clean($model->ram);
            if (isset($model->storage)) $model->storage = $clean($model->storage);
            if (isset($model->imei)) {
                $model->imei = implode(',', array_filter(array_map($clean, explode(',', $model->imei))));
            }
        };

        static::creating($sanitize);
        static::updating($sanitize);
    }

    public function invoice(): BelongsTo { return $this->belongsTo(SaleInvoice::class, 'sale_invoice_id'); }
    public function product(): BelongsTo { return $this->belongsTo(Product::class); }
    public function incentive() { return $this->hasOne(EmployeeIncentive::class); }
}
