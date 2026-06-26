<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // repair_requests — composite index for shop/status filtering
        Schema::table('repair_requests', function (Blueprint $table) {
            try { $table->index(['shop_id', 'status'], 'repairs_shop_status_idx'); } catch (\Exception $e) {}
            try { $table->index('customer_phone', 'repairs_customer_phone_idx'); } catch (\Exception $e) {}
            try { $table->index('submitted_date', 'repairs_submitted_date_idx'); } catch (\Exception $e) {}
        });

        // sale_items — product_id and imei lookups
        Schema::table('sale_items', function (Blueprint $table) {
            try { $table->index('product_id', 'sale_items_product_id_idx'); } catch (\Exception $e) {}
            try { $table->index('imei', 'sale_items_imei_idx'); } catch (\Exception $e) {}
        });

        // transactions — polymorphic lookup
        Schema::table('transactions', function (Blueprint $table) {
            try { $table->index(['entity_type', 'entity_id', 'category'], 'transactions_entity_cat_idx'); } catch (\Exception $e) {}
        });

        // loans — entity/status
        try {
            if (Schema::hasColumn('loans', 'customer_id') && Schema::hasColumn('loans', 'status')) {
                Schema::table('loans', function (Blueprint $table) {
                    $table->index(['customer_id', 'status'], 'loans_customer_status_idx');
                });
            }
        } catch (\Exception $e) {}

        // activity_logs — user timeline
        Schema::table('activity_logs', function (Blueprint $table) {
            try { $table->index(['user_id', 'created_at'], 'activity_logs_user_created_idx'); } catch (\Exception $e) {}
        });

        // customers — name search
        Schema::table('customers', function (Blueprint $table) {
            try { $table->index('name', 'customers_name_idx'); } catch (\Exception $e) {}
        });
    }

    public function down(): void
    {
        Schema::table('repair_requests', function (Blueprint $table) {
            try { $table->dropIndex('repairs_shop_status_idx'); } catch (\Exception $e) {}
            try { $table->dropIndex('repairs_customer_phone_idx'); } catch (\Exception $e) {}
            try { $table->dropIndex('repairs_submitted_date_idx'); } catch (\Exception $e) {}
        });
        Schema::table('sale_items', function (Blueprint $table) {
            try { $table->dropIndex('sale_items_product_id_idx'); } catch (\Exception $e) {}
            try { $table->dropIndex('sale_items_imei_idx'); } catch (\Exception $e) {}
        });
        Schema::table('transactions', function (Blueprint $table) {
            try { $table->dropIndex('transactions_entity_cat_idx'); } catch (\Exception $e) {}
        });
        Schema::table('loans', function (Blueprint $table) {
            try { $table->dropIndex('loans_customer_status_idx'); } catch (\Exception $e) {}
        });
        Schema::table('activity_logs', function (Blueprint $table) {
            try { $table->dropIndex('activity_logs_user_created_idx'); } catch (\Exception $e) {}
        });
        Schema::table('customers', function (Blueprint $table) {
            try { $table->dropIndex('customers_name_idx'); } catch (\Exception $e) {}
        });
    }
};
