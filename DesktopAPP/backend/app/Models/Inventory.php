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

    /**
     * Same intent as removeStock(), for the one situation where the shared
     * per-product counter genuinely cannot be trusted: New Mobile items are
     * tracked individually by IMEI at sale time (SaleInvoiceController's
     * validateNewMobileImei() independently confirms the exact unit being
     * sold is a real, unsold purchase), but the counter itself is just one
     * running total shared across every purchase batch ever recorded under
     * that product_id. If an earlier batch's units get sold first, the
     * counter can hit 0 while a specific, already-verified unit from a
     * later batch is still genuinely sitting unsold — the counter is wrong,
     * not the sale. Only call this once the caller has already verified the
     * specific IMEI independently; it must never be used to bypass a real
     * "we don't have this in stock" check.
     */
    public static function removeStockVerifiedByImei(int $shopId, int $productId, int $qty): void
    {
        if ($qty <= 0) {
            throw new \InvalidArgumentException('Quantity must be positive.');
        }

        DB::transaction(function () use ($shopId, $productId, $qty) {
            $inventory = self::firstOrCreate(
                ['shop_id' => $shopId, 'product_id' => $productId],
                ['stock' => 0]
            );
            $inventory = self::where('id', $inventory->id)->lockForUpdate()->first();

            // Floor at 0 instead of throwing — the IMEI check already proved
            // this unit is real and unsold, so the counter going negative
            // would just be noise. Flooring (rather than letting it go
            // negative) keeps stock reports sane even though the counter is
            // known to be an undercount for this product right now.
            $inventory->stock = max(0, $inventory->stock - $qty);
            $inventory->save();
        });
    }
}
