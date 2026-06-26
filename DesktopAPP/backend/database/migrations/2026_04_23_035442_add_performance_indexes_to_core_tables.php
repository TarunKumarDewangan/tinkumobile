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
        Schema::table('transactions', function (Blueprint $table) {
            $table->index(['shop_id', 'transaction_date']);
            $table->index(['entity_type', 'entity_id']);
        });

        Schema::table('repair_requests', function (Blueprint $table) {
            $table->index(['shop_id', 'status']);
            $table->index('customer_name');
            $table->index('forwarded_to');
        });

        Schema::table('sale_invoices', function (Blueprint $table) {
            $table->index(['shop_id', 'sale_date']);
            $table->index('bill_type');
        });
        
        Schema::table('purchase_invoices', function (Blueprint $table) {
            $table->index(['shop_id', 'purchase_date']);
        });

        Schema::table('inventories', function (Blueprint $table) {
            if (Schema::hasColumn('inventories', 'quantity')) {
                $table->index(['shop_id', 'quantity']);
            }
        });
    }

    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->dropIndex(['shop_id', 'transaction_date']);
            $table->dropIndex(['entity_type', 'entity_id']);
        });
        Schema::table('repair_requests', function (Blueprint $table) {
            $table->dropIndex(['shop_id', 'status']);
            $table->dropIndex(['customer_name']);
            $table->dropIndex(['forwarded_to']);
        });
        Schema::table('sale_invoices', function (Blueprint $table) {
            $table->dropIndex(['shop_id', 'sale_date']);
            $table->dropIndex(['bill_type']);
        });
        Schema::table('purchase_invoices', function (Blueprint $table) {
            $table->dropIndex(['shop_id', 'purchase_date']);
        });
        Schema::table('inventories', function (Blueprint $table) {
            $table->dropIndex(['shop_id', 'stock']);
        });
    }
};
