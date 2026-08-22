<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sale_finance_plans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sale_invoice_id')->constrained('sale_invoices')->onDelete('cascade');
            $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $table->enum('type', ['PERSONAL', 'FAVOR', 'PROCESSING_FEE']);

            $table->decimal('down_payment', 12, 2)->default(0);
            $table->decimal('principal', 12, 2)->default(0);       // financed amount (total − down)

            // PERSONAL EMI only
            $table->decimal('interest_rate', 5, 2)->nullable();    // % per annum
            $table->unsignedInteger('tenure_months')->nullable();
            $table->decimal('monthly_emi', 12, 2)->nullable();
            $table->date('emi_start_date')->nullable();             // first EMI due date
            $table->decimal('total_payable', 12, 2)->default(0);   // principal + total interest

            // Tracking
            $table->decimal('total_paid', 12, 2)->default(0);
            $table->enum('status', ['ACTIVE', 'SETTLED', 'OVERDUE'])->default('ACTIVE');
            $table->timestamp('settled_at')->nullable();

            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sale_finance_plans');
    }
};
