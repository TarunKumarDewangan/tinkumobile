<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * No doctrine/dbal in this project, so the enum column is widened with raw
 * SQL on MySQL. SQLite (used by the test suite) enforces enum() as a CHECK
 * constraint that can't be ALTERed in place either — drop + re-add instead,
 * which is fine there since it's always a throwaway test database.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            Schema::table('attendance_logs', function (Blueprint $table) {
                $table->dropColumn('type');
            });
            Schema::table('attendance_logs', function (Blueprint $table) {
                $table->enum('type', ['IN', 'OUT', 'LUNCH_OUT', 'LUNCH_IN'])->after('shop_id');
            });
            return;
        }
        DB::statement("ALTER TABLE attendance_logs MODIFY type ENUM('IN', 'OUT', 'LUNCH_OUT', 'LUNCH_IN') NOT NULL");
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            Schema::table('attendance_logs', function (Blueprint $table) {
                $table->dropColumn('type');
            });
            Schema::table('attendance_logs', function (Blueprint $table) {
                $table->enum('type', ['IN', 'OUT'])->after('shop_id');
            });
            return;
        }
        DB::statement("ALTER TABLE attendance_logs MODIFY type ENUM('IN', 'OUT') NOT NULL");
    }
};
