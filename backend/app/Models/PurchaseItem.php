<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PurchaseItem extends Model
{
    public $timestamps = false;
    protected $fillable = ['purchase_invoice_id', 'product_id', 'current_shop_id', 'imei', 'ram', 'storage', 'color', 'quantity', 'received_quantity', 'damaged_quantity', 'unit_price', 'selling_price', 'wholeseller_price', 'min_selling_price', 'max_selling_price', 'incentive_amount', 'total', 'trade_disc_pct', 'cash_disc_pct', 'calc_gst_rate', 'apply_gst'];

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

        // Every item starts out "currently at" the shop that bought it. Only a
        // Stock Transfer ever changes this afterward — every other creation path
        // (regular purchases, opening stock, etc.) gets this for free without
        // having to be touched.
        static::creating(function ($model) {
            if (!$model->current_shop_id && $model->purchase_invoice_id) {
                $model->current_shop_id = PurchaseInvoice::find($model->purchase_invoice_id)?->shop_id;
            }
        });
    }

    public function invoice(): BelongsTo { return $this->belongsTo(PurchaseInvoice::class, 'purchase_invoice_id'); }
    public function product(): BelongsTo { return $this->belongsTo(Product::class); }
    public function currentShop(): BelongsTo { return $this->belongsTo(Shop::class, 'current_shop_id'); }
}
