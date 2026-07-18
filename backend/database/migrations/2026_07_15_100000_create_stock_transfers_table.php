<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stock_transfers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('from_shop_id')->constrained('shops');
            $table->foreignId('to_shop_id')->constrained('shops');
            $table->foreignId('product_id')->constrained('products');
            // TEXT not varchar(255) — a bulk transfer's comma-separated IMEI list can
            // exceed 255 chars, same lesson already learned on purchase_items.imei.
            $table->text('imei')->nullable();
            $table->integer('quantity');
            $table->enum('status', ['PENDING', 'RECEIVED', 'CANCELLED'])->default('PENDING');
            $table->foreignId('initiated_by')->constrained('users');
            $table->foreignId('received_by')->nullable()->constrained('users')->nullOnDelete();
            $table->date('transfer_date');
            $table->timestamp('received_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['from_shop_id', 'status']);
            $table->index(['to_shop_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_transfers');
    }
};
