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
            $table->decimal('cgst_rate', 5, 2)->default(9)->after('total_amount');
            $table->decimal('sgst_rate', 5, 2)->default(9)->after('cgst_rate');
            $table->decimal('cgst_amount', 12, 2)->default(0)->after('sgst_rate');
            $table->decimal('sgst_amount', 12, 2)->default(0)->after('cgst_amount');
            $table->enum('rounding_mode', ['auto', 'up', 'down'])->default('auto')->after('sgst_amount');
        });

        Schema::table('sale_items', function (Blueprint $table) {
            $table->string('imei', 255)->nullable()->after('product_id');
            $table->string('ram', 50)->nullable()->after('imei');
            $table->string('storage', 50)->nullable()->after('ram');
            $table->string('color', 50)->nullable()->after('storage');
        });
    }

    public function down(): void
    {
        Schema::table('sale_items', function (Blueprint $table) {
            $table->dropColumn(['imei', 'ram', 'storage', 'color']);
        });

        Schema::table('sale_invoices', function (Blueprint $table) {
            $table->dropColumn(['cgst_rate', 'sgst_rate', 'cgst_amount', 'sgst_amount', 'rounding_mode']);
        });
    }
};
