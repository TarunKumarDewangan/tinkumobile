<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            // Mirror rows auto-posted against a Bank/Card/UPI entity so its balance
            // reflects real money flow — excluded from cash/bank collection totals
            // (Daily Summary, Transactions report) to avoid double-counting the
            // same money on both sides of the dual-posting.
            $table->boolean('is_internal_transfer')->default(false)->after('accounting_entity_id');
        });
    }

    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->dropColumn('is_internal_transfer');
        });
    }
};
