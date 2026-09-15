<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('shops', function (Blueprint $table) {
            $table->time('shift_start_time')->default('10:30:00')->after('attendance_radius_meters');
            $table->time('shift_end_time')->default('20:30:00')->after('shift_start_time');
        });
    }

    public function down(): void
    {
        Schema::table('shops', function (Blueprint $table) {
            $table->dropColumn(['shift_start_time', 'shift_end_time']);
        });
    }
};
