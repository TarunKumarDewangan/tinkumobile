<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Inventory extends Model
{
    protected $table = 'inventory';
    protected $fillable = ['shop_id', 'product_id', 'stock'];

    public function shop(): BelongsTo { return $this->belongsTo(Shop::class); }
    public function product(): BelongsTo { return $this->belongsTo(Product::class); }

    /** Increase stock, creates row if missing */
    public static function addStock(int $shopId, int $productId, int $qty): void
    {
        self::firstOrCreate(
            ['shop_id' => $shopId, 'product_id' => $productId],
            ['stock' => 0]
        )->increment('stock', $qty);
    }

    /** Decrease stock */
    public static function removeStock(int $shopId, int $productId, int $qty): void
    {
        self::firstOrCreate(
            ['shop_id' => $shopId, 'product_id' => $productId],
            ['stock' => 0]
        )->decrement('stock', $qty);
    }
}
