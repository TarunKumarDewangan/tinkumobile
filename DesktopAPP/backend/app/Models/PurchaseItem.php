<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PurchaseItem extends Model
{
    public $timestamps = false;
    protected $fillable = ['purchase_invoice_id', 'product_id', 'imei', 'ram', 'storage', 'color', 'quantity', 'received_quantity', 'damaged_quantity', 'unit_price', 'selling_price', 'wholeseller_price', 'min_selling_price', 'max_selling_price', 'incentive_amount', 'total'];

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

    public function invoice(): BelongsTo { return $this->belongsTo(PurchaseInvoice::class, 'purchase_invoice_id'); }
    public function product(): BelongsTo { return $this->belongsTo(Product::class); }
}
