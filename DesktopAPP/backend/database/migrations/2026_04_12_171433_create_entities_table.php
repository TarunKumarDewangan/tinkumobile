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
        Schema::create('entities', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->string('type')->default('OTHER'); // CUSTOMER, SHOP, SUPPLIER, RETAILER, OTHER
            $table->string('relation_type')->nullable(); // Class name if linked to model
            $table->unsignedBigInteger('relation_id')->nullable();
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->decimal('opening_balance', 15, 2)->default(0);
            $table->enum('balance_type', ['RECEIVABLE', 'PAYABLE'])->default('RECEIVABLE');
            $table->text('description')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('entities');
    }
};
