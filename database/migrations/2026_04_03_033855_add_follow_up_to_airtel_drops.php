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
        // Columns already exist from a partial failed run
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('airtel_drops', function (Blueprint $table) {
            $table->dropColumn(['reason', 'next_recovery_date']);
        });
    }
};
