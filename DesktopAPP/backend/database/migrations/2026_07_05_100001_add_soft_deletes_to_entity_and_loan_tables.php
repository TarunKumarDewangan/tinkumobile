<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * entities is the ledger/accounting anchor and loans/loan_payments carry
 * financial history — none of the three could previously be soft-deleted,
 * so a hard delete anywhere in these tables permanently orphans ledger
 * postings with no way to restore via the existing Trash feature.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('entities', 'deleted_at')) {
            Schema::table('entities', function (Blueprint $table) {
                $table->softDeletes();
            });
        }

        if (!Schema::hasColumn('loans', 'deleted_at')) {
            Schema::table('loans', function (Blueprint $table) {
                $table->softDeletes();
            });
        }

        if (!Schema::hasColumn('loan_payments', 'deleted_at')) {
            Schema::table('loan_payments', function (Blueprint $table) {
                $table->softDeletes();
            });
        }
    }

    public function down(): void
    {
        Schema::table('entities', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });
        Schema::table('loans', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });
        Schema::table('loan_payments', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });
    }
};
