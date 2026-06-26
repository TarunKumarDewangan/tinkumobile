<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('expense_categories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shop_id')->nullable()->constrained()->onDelete('cascade');
            $table->string('name');
            $table->string('description')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shop_id')->constrained()->onDelete('cascade');
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            
            $table->enum('type', ['IN', 'OUT']);
            $table->string('category')->index(); // SALE, PURCHASE, AIRTEL, EXPENSE, etc.
            $table->decimal('amount', 15, 2);
            $table->string('payment_mode')->nullable(); // CASH, DIGITAL, etc.
            
            // Entity Polymorphism (Customer, Supplier, etc.)
            $table->string('entity_type')->nullable()->index();
            $table->unsignedBigInteger('entity_id')->nullable()->index();
            
            $table->text('description')->nullable();
            $table->unsignedBigInteger('ref_id')->nullable()->index(); // ID of Sale, Purchase, etc.
            
            $table->date('transaction_date');
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('transactions');
        Schema::dropIfExists('expense_categories');
    }
};
