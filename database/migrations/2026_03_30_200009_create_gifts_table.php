<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('gift_products', function (Blueprint $table) {
            $table->id();
            $table->string('name', 200);
            $table->string('sku', 100)->unique();
            $table->decimal('purchase_price', 10, 2);
            $table->timestamps();
        });

        Schema::create('gift_inventory', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shop_id')->constrained('shops')->cascadeOnDelete();
            $table->foreignId('gift_product_id')->constrained('gift_products')->cascadeOnDelete();
            $table->integer('stock')->default(0);
            $table->timestamps();
            $table->unique(['shop_id', 'gift_product_id']);
        });

        Schema::create('sale_gift_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sale_invoice_id')->constrained('sale_invoices')->cascadeOnDelete();
            $table->foreignId('gift_product_id')->constrained('gift_products');
            $table->integer('quantity');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sale_gift_items');
        Schema::dropIfExists('gift_inventory');
        Schema::dropIfExists('gift_products');
    }
};
