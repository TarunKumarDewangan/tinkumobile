<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('category_id')->constrained('categories');
            $table->string('name', 200);
            $table->string('sku', 100)->unique();
            $table->string('imei', 20)->unique()->nullable();
            $table->decimal('purchase_price', 10, 2);
            $table->decimal('selling_price', 10, 2);
            $table->enum('condition', ['new', 'used'])->default('new');
            $table->json('attributes')->nullable();
            $table->string('location', 200)->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('inventory', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shop_id')->constrained('shops')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->integer('stock')->default(0);
            $table->timestamps();
            $table->unique(['shop_id', 'product_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory');
        Schema::dropIfExists('products');
    }
};
