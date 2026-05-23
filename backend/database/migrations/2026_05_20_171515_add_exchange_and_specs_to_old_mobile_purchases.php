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
        Schema::table('old_mobile_purchases', function (Blueprint $table) {
            $table->boolean('is_exchange')->default(false)->after('purchase_price');
            $table->foreignId('product_id')->nullable()->after('customer_id')->constrained('products')->nullOnDelete();
            $table->string('ram', 50)->nullable()->after('imei');
            $table->string('storage', 50)->nullable()->after('ram');
            $table->string('color', 100)->nullable()->after('storage');
            $table->decimal('selling_price', 10, 2)->default(0)->after('purchase_price');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('old_mobile_purchases', function (Blueprint $table) {
            $table->dropForeign(['product_id']);
            $table->dropColumn(['is_exchange', 'product_id', 'ram', 'storage', 'color', 'selling_price']);
        });
    }
};
