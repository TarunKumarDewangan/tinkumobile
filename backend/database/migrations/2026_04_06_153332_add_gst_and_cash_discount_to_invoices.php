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
        Schema::table('sale_invoices', function (Blueprint $table) {
            $table->boolean('calculate_gst')->default(true)->after('sgst_amount');
            $table->decimal('cash_discount', 15, 2)->default(0)->after('discount');
            $table->boolean('is_cash_discount_on_bill')->default(true)->after('cash_discount');
        });

        Schema::table('purchase_invoices', function (Blueprint $table) {
            $table->boolean('calculate_gst')->default(true)->after('sgst_amount');
            $table->decimal('cash_discount', 15, 2)->default(0)->after('discount');
            $table->boolean('is_cash_discount_on_bill')->default(true)->after('cash_discount');
        });
    }

    public function down(): void
    {
        Schema::table('sale_invoices', function (Blueprint $table) {
            $table->dropColumn(['calculate_gst', 'cash_discount', 'is_cash_discount_on_bill']);
        });
        Schema::table('purchase_invoices', function (Blueprint $table) {
            $table->dropColumn(['calculate_gst', 'cash_discount', 'is_cash_discount_on_bill']);
        });
    }
};
