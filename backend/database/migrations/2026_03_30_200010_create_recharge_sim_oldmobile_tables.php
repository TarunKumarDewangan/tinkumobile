<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('recharge_purchases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shop_id')->constrained('shops');
            $table->foreignId('supplier_id')->constrained('suppliers');
            $table->string('operator', 50);
            $table->decimal('amount', 10, 2);
            $table->decimal('cost_price', 10, 2);
            $table->date('purchase_date');
            $table->foreignId('user_id')->constrained('users');
            $table->timestamps();
        });

        Schema::create('recharge_sales', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shop_id')->constrained('shops');
            $table->foreignId('customer_id')->constrained('customers');
            $table->string('mobile_number', 15);
            $table->string('operator', 50);
            $table->decimal('amount', 10, 2);
            $table->decimal('selling_price', 10, 2);
            $table->date('sale_date');
            $table->foreignId('user_id')->constrained('users');
            $table->timestamps();
        });

        Schema::create('sim_cards', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shop_id')->constrained('shops');
            $table->string('sim_number', 20)->unique();
            $table->string('mobile_number', 15)->nullable();
            $table->string('operator', 50);
            $table->decimal('purchase_price', 10, 2);
            $table->decimal('selling_price', 10, 2);
            $table->enum('status', ['in_stock', 'sold'])->default('in_stock');
            $table->foreignId('purchased_from')->constrained('suppliers');
            $table->foreignId('sold_to')->nullable()->constrained('customers')->nullOnDelete();
            $table->date('purchase_date');
            $table->date('sale_date')->nullable();
            $table->foreignId('user_id_purchase')->constrained('users');
            $table->foreignId('user_id_sale')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('old_mobile_purchases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shop_id')->constrained('shops');
            $table->foreignId('customer_id')->constrained('customers');
            $table->string('model_name', 150);
            $table->string('imei', 20)->nullable();
            $table->decimal('purchase_price', 10, 2);
            $table->text('condition_note')->nullable();
            $table->date('purchase_date');
            $table->foreignId('user_id')->constrained('users');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('old_mobile_purchases');
        Schema::dropIfExists('sim_cards');
        Schema::dropIfExists('recharge_sales');
        Schema::dropIfExists('recharge_purchases');
    }
};
