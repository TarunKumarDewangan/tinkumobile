<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('sim_stock_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shop_id')->nullable()->constrained()->nullOnDelete();
            $table->enum('type', ['IN', 'OUT']); // IN = new arrival, OUT = sold
            $table->foreignId('distributor_id')->nullable()->constrained('entities')->nullOnDelete();
            $table->string('operator', 50);
            $table->unsignedInteger('quantity');
            $table->decimal('price_per_sim', 10, 2)->default(10);
            $table->decimal('total_price', 12, 2);
            $table->text('remarks')->nullable();
            $table->date('entry_date');
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sim_stock_entries');
    }
};
