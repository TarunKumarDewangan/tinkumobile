<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employee_incentives', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users');
            $table->foreignId('sale_item_id')->constrained('sale_items')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products');
            $table->decimal('incentive_amount', 10, 2);
            $table->boolean('paid_status')->default(false);
            $table->date('payment_date')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('company_offers', function (Blueprint $table) {
            $table->id();
            $table->string('name', 200);
            $table->foreignId('product_id')->nullable()->constrained('products')->nullOnDelete();
            $table->date('start_date');
            $table->date('end_date');
            $table->integer('target_quantity');
            $table->text('reward_details');
            $table->boolean('is_fulfilled')->default(false);
            $table->integer('actual_sold')->default(0);
            $table->timestamps();
        });

        Schema::create('offer_fulfillments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('offer_id')->constrained('company_offers');
            $table->date('fulfilled_date');
            $table->text('notes')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('offer_fulfillments');
        Schema::dropIfExists('company_offers');
        Schema::dropIfExists('employee_incentives');
    }
};
