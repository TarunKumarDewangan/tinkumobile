<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('old_mobile_purchases', function (Blueprint $table) {
            // Only meaningful when is_exchange is true: how much of
            // purchase_price is credited to the customer's wallet — the rest
            // (purchase_price - exchange_credit_amount) is paid as cash now.
            // Null/blank means "the full purchase_price", so every existing
            // full-exchange purchase keeps working unchanged.
            $table->decimal('exchange_credit_amount', 12, 2)->nullable()->after('exchange_credit_mode');
        });
    }

    public function down(): void
    {
        Schema::table('old_mobile_purchases', function (Blueprint $table) {
            $table->dropColumn('exchange_credit_amount');
        });
    }
};
