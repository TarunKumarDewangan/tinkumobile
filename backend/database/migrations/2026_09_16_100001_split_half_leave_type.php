<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Splits the old 'half' leave type into 'half_front' (leave for the first
 * part of the day — came in late) and 'half_later' (leave for the second
 * part — left early). Existing 'half' rows are migrated to 'half_front' as
 * a reasonable default rather than left in a now-invalid state.
 *
 * No renameColumn() here (needs doctrine/dbal, not installed) — add a temp
 * column, populate it, drop the old one, add the real one, copy over.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            Schema::table('attendance_leaves', fn (Blueprint $t) => $t->string('type_tmp')->nullable());
            DB::table('attendance_leaves')->update(['type_tmp' => DB::raw("CASE WHEN type = 'half' THEN 'half_front' ELSE type END")]);
            Schema::table('attendance_leaves', fn (Blueprint $t) => $t->dropColumn('type'));
            Schema::table('attendance_leaves', fn (Blueprint $t) => $t->enum('type', ['full', 'half_front', 'half_later'])->default('full'));
            DB::statement('UPDATE attendance_leaves SET type = type_tmp');
            Schema::table('attendance_leaves', fn (Blueprint $t) => $t->dropColumn('type_tmp'));
            return;
        }

        DB::statement("ALTER TABLE attendance_leaves MODIFY type ENUM('full', 'half', 'half_front', 'half_later') NOT NULL");
        DB::statement("UPDATE attendance_leaves SET type = 'half_front' WHERE type = 'half'");
        DB::statement("ALTER TABLE attendance_leaves MODIFY type ENUM('full', 'half_front', 'half_later') NOT NULL");
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            Schema::table('attendance_leaves', fn (Blueprint $t) => $t->string('type_tmp')->nullable());
            DB::table('attendance_leaves')->update(['type_tmp' => DB::raw("CASE WHEN type IN ('half_front','half_later') THEN 'half' ELSE type END")]);
            Schema::table('attendance_leaves', fn (Blueprint $t) => $t->dropColumn('type'));
            Schema::table('attendance_leaves', fn (Blueprint $t) => $t->enum('type', ['full', 'half'])->default('full'));
            DB::statement('UPDATE attendance_leaves SET type = type_tmp');
            Schema::table('attendance_leaves', fn (Blueprint $t) => $t->dropColumn('type_tmp'));
            return;
        }

        DB::statement("ALTER TABLE attendance_leaves MODIFY type ENUM('full', 'half', 'half_front', 'half_later') NOT NULL");
        DB::statement("UPDATE attendance_leaves SET type = 'half' WHERE type IN ('half_front', 'half_later')");
        DB::statement("ALTER TABLE attendance_leaves MODIFY type ENUM('full', 'half') NOT NULL");
    }
};
