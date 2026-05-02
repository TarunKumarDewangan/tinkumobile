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
        $defaultShopId = DB::table('shops')->first()?->id ?? 1;

        Schema::table('loans', function (Blueprint $table) use ($defaultShopId) {
            $table->foreignId('shop_id')->after('id')->nullable()->constrained('shops')->cascadeOnDelete();
        });

        // Set default shop_id for existing loans
        DB::table('loans')->whereNull('shop_id')->update(['shop_id' => $defaultShopId]);

        Schema::table('loans', function (Blueprint $table) {
            $table->foreignId('shop_id')->nullable(false)->change();
        });

        Schema::table('loan_payments', function (Blueprint $table) use ($defaultShopId) {
            $table->foreignId('shop_id')->after('id')->nullable()->constrained('shops')->cascadeOnDelete();
        });

        // Set default shop_id for existing payments
        DB::table('loan_payments')->whereNull('shop_id')->update(['shop_id' => $defaultShopId]);

        Schema::table('loan_payments', function (Blueprint $table) {
            $table->foreignId('shop_id')->nullable(false)->change();
        });
    }

    public function down(): void
    {
        Schema::table('loan_payments', function (Blueprint $table) {
            $table->dropForeign(['shop_id']);
            $table->dropColumn('shop_id');
        });

        Schema::table('loans', function (Blueprint $table) {
            $table->dropForeign(['shop_id']);
            $table->dropColumn('shop_id');
        });
    }
};
