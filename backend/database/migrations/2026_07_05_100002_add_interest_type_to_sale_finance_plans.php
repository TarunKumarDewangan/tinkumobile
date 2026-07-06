<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Lets a Personal EMI plan use flat-rate interest (simple interest on the
 * original principal, common for informal shop financing) instead of only
 * the reducing-balance formula that was previously hardcoded. Defaults
 * existing rows to REDUCING since that's the formula they were actually
 * created with.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sale_finance_plans', function (Blueprint $table) {
            $table->enum('interest_type', ['FLAT', 'REDUCING'])->default('REDUCING')->after('interest_rate');
        });
    }

    public function down(): void
    {
        Schema::table('sale_finance_plans', function (Blueprint $table) {
            $table->dropColumn('interest_type');
        });
    }
};
