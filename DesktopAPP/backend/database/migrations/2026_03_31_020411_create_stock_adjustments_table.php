<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stock_adjustments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shop_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->enum('type', ['add', 'remove']);
            $table->unsignedInteger('quantity');
            $table->string('reason', 100);   // opening_stock, previous_purchase, correction, damage, etc.
            $table->decimal('purchase_price', 12, 2)->nullable(); // cost at time of entry
            $table->text('notes')->nullable();
            $table->date('adjustment_date');
            $table->timestamps();

            $table->index(['shop_id', 'product_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_adjustments');
    }
};
