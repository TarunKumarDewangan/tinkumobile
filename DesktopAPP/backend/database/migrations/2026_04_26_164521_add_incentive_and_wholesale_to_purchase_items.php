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
        Schema::table('products', function (Blueprint $table) {
            $table->decimal('incentive_amount', 12, 2)->nullable()->after('max_selling_price');
        });

        Schema::table('purchase_items', function (Blueprint $table) {
            $table->decimal('wholeseller_price', 12, 2)->nullable()->after('selling_price');
            $table->decimal('incentive_amount', 12, 2)->nullable()->after('max_selling_price');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('incentive_amount');
        });

        Schema::table('purchase_items', function (Blueprint $table) {
            $table->dropColumn(['wholeseller_price', 'incentive_amount']);
        });
    }
};
