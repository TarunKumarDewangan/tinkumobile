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
            // Only meaningful when is_exchange is true: 'adjust' (default, posts
            // straight to the ledger) or 'reserve' (held in the customer's
            // exchange_credit_balance wallet until applied to a future sale).
            $table->string('exchange_credit_mode', 20)->nullable()->after('is_exchange');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('old_mobile_purchases', function (Blueprint $table) {
            $table->dropColumn('exchange_credit_mode');
        });
    }
};
