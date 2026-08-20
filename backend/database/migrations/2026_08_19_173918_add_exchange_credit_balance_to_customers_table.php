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
        Schema::table('customers', function (Blueprint $table) {
            // Reserved old-mobile exchange credit not yet posted to the ledger —
            // held here until actually applied to a future sale, so it can't be
            // silently absorbed by unrelated dues in the meantime. Starts at 0
            // for every existing customer; past exchange credits already netted
            // into their ledger balance are not retroactively moved here.
            $table->decimal('exchange_credit_balance', 12, 2)->default(0)->after('category');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->dropColumn('exchange_credit_balance');
        });
    }
};
