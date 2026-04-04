<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('loans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->constrained('customers');
            $table->decimal('principal', 12, 2);
            $table->decimal('interest_rate', 5, 2);
            $table->integer('total_months');
            $table->decimal('monthly_installment', 10, 2);
            $table->date('start_date');
            $table->enum('status', ['active', 'closed', 'defaulted'])->default('active');
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('loan_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('loan_id')->constrained('loans')->cascadeOnDelete();
            $table->date('due_date');
            $table->date('paid_date')->nullable();
            $table->decimal('amount', 10, 2);
            $table->decimal('penalty', 10, 2)->default(0);
            $table->enum('status', ['pending', 'paid', 'late'])->default('pending');
            $table->text('notes')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('loan_payments');
        Schema::dropIfExists('loans');
    }
};
