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
            // How much of exchange_paid on this invoice was drawn from the
            // customer's reserved exchange_credit_balance wallet (vs already
            // covered by their pre-existing negative ledger balance) — needed
            // to correctly refund the wallet if this invoice is later edited.
            $table->decimal('wallet_credit_used', 12, 2)->default(0)->after('exchange_paid');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sale_invoices', function (Blueprint $table) {
            $table->dropColumn('wallet_credit_used');
        });
    }
};
