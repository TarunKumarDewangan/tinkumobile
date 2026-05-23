<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Models\Category;
use App\Models\Product;
use App\Models\OldMobilePurchase;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Fix existing old mobile products with null category_id
        $category = Category::where('slug', 'MOBILE-OLD')->first();
        if ($category) {
            $productIds = OldMobilePurchase::pluck('product_id')->filter()->toArray();
            if (!empty($productIds)) {
                Product::whereIn('id', $productIds)
                    ->whereNull('category_id')
                    ->update(['category_id' => $category->id]);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No rollback needed for data fix
    }
};
