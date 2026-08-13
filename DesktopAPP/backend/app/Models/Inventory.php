<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\DB;

class Inventory extends Model
{
    use \App\Traits\MirrorsToSupabase;

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

    /**
     * Decrease stock with negative-balance guard.
     * Throws \RuntimeException if insufficient stock.
     */
    public static function removeStock(int $shopId, int $productId, int $qty): void
    {
        if ($qty <= 0) {
            throw new \InvalidArgumentException('Quantity must be positive.');
        }

        DB::transaction(function () use ($shopId, $productId, $qty) {
            $inventory = self::where('shop_id', $shopId)
                ->where('product_id', $productId)
                ->lockForUpdate()
                ->first();

            if (!$inventory) {
                $product = Product::find($productId);
                $productName = $product ? $product->name : "ID:{$productId}";
                throw new \RuntimeException("Insufficient stock for product: {$productName}. Available: 0, requested: {$qty}");
            }

            if ($inventory->stock < $qty) {
                $product = Product::find($productId);
                $productName = $product ? $product->name : "ID:{$productId}";
                throw new \RuntimeException("Insufficient stock for product: {$productName}. Available: {$inventory->stock}, requested: {$qty}");
            }

            $inventory->decrement('stock', $qty);
        });
    }
}
