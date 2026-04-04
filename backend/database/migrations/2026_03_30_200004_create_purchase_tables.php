<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('purchase_invoices', function (Blueprint $table) {
            $table->id();
            $table->string('invoice_no', 50)->unique();
            $table->enum('bill_type', ['kaccha', 'pakka'])->default('kaccha');
            $table->foreignId('shop_id')->constrained('shops');
            $table->foreignId('supplier_id')->constrained('suppliers');
            $table->foreignId('user_id')->constrained('users');
            $table->date('purchase_date');
            $table->date('expected_delivery_date')->nullable();
            $table->decimal('total_amount', 12, 2);
            $table->decimal('cgst_rate', 5, 2)->default(9);
            $table->decimal('sgst_rate', 5, 2)->default(9);
            $table->decimal('cgst_amount', 12, 2)->default(0);
            $table->decimal('sgst_amount', 12, 2)->default(0);
            $table->decimal('discount', 10, 2)->default(0);
            $table->decimal('grand_total', 12, 2);
            $table->decimal('total_paid', 15, 2)->default(0);
            $table->string('payment_status')->default('unpaid'); // unpaid, partial, paid
            $table->string('rounding_mode')->default('auto');
            $table->text('notes')->nullable();
            $table->enum('status', ['ordered', 'received'])->default('ordered');
            $table->dateTime('received_at')->nullable();
            $table->timestamps();
        });

        Schema::create('purchase_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('purchase_invoice_id')->constrained('purchase_invoices')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products');
            $table->text('imei')->nullable();
            $table->string('ram')->nullable();
            $table->string('storage')->nullable();
            $table->string('color')->nullable();
            $table->integer('quantity');
            $table->integer('received_quantity')->default(0);
            $table->integer('damaged_quantity')->default(0);
            $table->decimal('unit_price', 10, 2);
            $table->decimal('selling_price', 12, 2)->nullable();
            $table->string('location', 200)->nullable();
            $table->decimal('total', 12, 2);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('purchase_items');
        Schema::dropIfExists('purchase_invoices');
    }
};
