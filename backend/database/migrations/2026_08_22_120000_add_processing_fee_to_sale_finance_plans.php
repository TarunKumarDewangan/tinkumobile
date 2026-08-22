<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sale_finance_plans', function (Blueprint $table) {
            $table->decimal('processing_fee', 12, 2)->nullable()->after('principal');
        });

        // The `type` enum was created with only PERSONAL/FAVOR — a fresh
        // install picks up PROCESSING_FEE from the (now updated) create-table
        // migration, but a live MySQL database needs the column altered
        // directly since doctrine/dbal isn't installed for Schema::change().
        // SQLite (used by the test suite) already has it from a full re-migrate.
        if (Schema::getConnection()->getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE sale_finance_plans MODIFY type ENUM('PERSONAL', 'FAVOR', 'PROCESSING_FEE') NOT NULL");
        }
    }

    public function down(): void
    {
        Schema::table('sale_finance_plans', function (Blueprint $table) {
            $table->dropColumn('processing_fee');
        });

        if (Schema::getConnection()->getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE sale_finance_plans MODIFY type ENUM('PERSONAL', 'FAVOR') NOT NULL");
        }
    }
};
