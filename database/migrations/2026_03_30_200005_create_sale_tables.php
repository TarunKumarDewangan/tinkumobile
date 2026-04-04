<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sale_invoices', function (Blueprint $table) {
            $table->id();
            $table->string('invoice_no', 50)->unique();
            $table->foreignId('shop_id')->constrained('shops');
            $table->foreignId('customer_id')->constrained('customers');
            $table->foreignId('user_id')->constrained('users');
            $table->date('sale_date');
            $table->decimal('total_amount', 12, 2);
            $table->decimal('cgst_rate', 5, 2)->default(9);
            $table->decimal('sgst_rate', 5, 2)->default(9);
            $table->decimal('cgst_amount', 12, 2)->default(0);
            $table->decimal('sgst_amount', 12, 2)->default(0);
            $table->decimal('discount', 10, 2)->default(0);
            $table->decimal('grand_total', 12, 2);
            $table->decimal('total_paid', 12, 2)->default(0);
            $table->enum('payment_status', ['unpaid', 'partial', 'paid'])->default('unpaid');
            $table->enum('payment_method', ['cash', 'card', 'mobile'])->default('cash');
            $table->enum('bill_type', ['kaccha', 'pakka'])->default('kaccha');
            $table->enum('rounding_mode', ['auto', 'up', 'down'])->default('auto');
            $table->decimal('round_off', 5, 2)->default(0);
            $table->foreignId('parent_bill_id')->nullable()->constrained('sale_invoices')->nullOnDelete();
            $table->boolean('is_cancelled')->default(false);
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('sale_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sale_invoice_id')->constrained('sale_invoices')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products');
            $table->string('imei', 255)->nullable();
            $table->string('ram', 50)->nullable();
            $table->string('storage', 50)->nullable();
            $table->string('color', 50)->nullable();
            $table->integer('quantity');
            $table->decimal('unit_price', 10, 2);
            $table->decimal('total', 12, 2);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sale_items');
        Schema::dropIfExists('sale_invoices');
    }
};
