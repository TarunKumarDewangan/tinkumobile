<?php

namespace App\Console\Commands;

use App\Models\Category;
use App\Models\Product;
use App\Models\SaleItem;
use App\Models\StockAdjustment;
use App\Models\User;
use Illuminate\Console\Command;

class BackfillOldToNewConversionAdjustments extends Command
{
    /**
     * Fixes historical sales converted from Old Mobile -> New Mobile
     * (SaleInvoiceController::convertToNewSale) that predate the fix adding a
     * StockAdjustment at conversion time. Without it, the New Mobile Daily
     * Ledger counts the sale but has no matching purchase to offset it,
     * showing impossible negative stock for that product.
     */
    protected $signature = 'stock:backfill-old-to-new-conversion-adjustments {--dry-run}';

    protected $description = 'Backfill missing stock adjustments for sales converted from Old Mobile to New Mobile before the fix';

    public function handle()
    {
        $dryRun = $this->option('dry-run');
        $newMobileCatId = Category::mobileNewId();

        if (!$newMobileCatId) {
            $this->error('New mobile category not found.');
            return 1;
        }

        // A New Mobile product with zero PurchaseItem history could only have
        // gotten its stock from a conversion (or a data-entry mistake) — either
        // way, if it also has sales, those sales need a matching adjustment.
        $candidateProducts = Product::where('category_id', $newMobileCatId)
            ->doesntHave('purchaseItems')
            ->whereHas('saleItems')
            ->get();

        $ownerId = User::where('email', 'owner@tinkumobile.in')->value('id') ?? User::where('is_owner', true)->value('id');
        if (!$ownerId) {
            $this->error('No owner user found to attribute the adjustment to.');
            return 1;
        }

        $posted = 0;
        $skipped = 0;

        foreach ($candidateProducts as $product) {
            $saleItems = SaleItem::where('product_id', $product->id)
                ->whereHas('invoice', fn($q) => $q->where('is_cancelled', false))
                ->with('invoice:id,shop_id,sale_date')
                ->get();

            foreach ($saleItems as $item) {
                $exists = StockAdjustment::where('product_id', $product->id)
                    ->where('reason', 'converted_from_old_mobile')
                    ->where('notes', 'like', "sale_item:{$item->id}%")
                    ->exists();

                if ($exists) {
                    $skipped++;
                    continue;
                }

                $this->line("Product #{$product->id} ({$product->name}): +{$item->quantity} on {$item->invoice->sale_date}");

                if (!$dryRun) {
                    StockAdjustment::create([
                        'shop_id'         => $item->invoice->shop_id,
                        'product_id'      => $product->id,
                        'user_id'         => $ownerId,
                        'type'            => 'add',
                        'quantity'        => $item->quantity,
                        'reason'          => 'converted_from_old_mobile',
                        'adjustment_date' => $item->invoice->sale_date,
                        // Same "sale_item:{id}" reference convertToNewSale() uses, so
                        // convertToOldSale() (the reverse action) can find and remove
                        // exactly this adjustment if the sale is later reverted.
                        'notes'           => "sale_item:{$item->id} (backfilled)",
                    ]);
                }
                $posted++;
            }
        }

        $this->info(($dryRun ? '[DRY RUN] ' : '') . "Posted: {$posted}, Skipped (already present): {$skipped}");
        return 0;
    }
}
