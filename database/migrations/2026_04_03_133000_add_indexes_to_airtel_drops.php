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
        Schema::table('airtel_drops', function (Blueprint $table) {
            $table->index('refill_date');
            $table->index('status');
            $table->index('recovered_at');
            $table->index(['refill_date', 'status']); // Composite index for status filters
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('airtel_drops', function (Blueprint $table) {
            $table->dropIndex(['refill_date']);
            $table->dropIndex(['status']);
            $table->dropIndex(['recovered_at']);
            $table->dropIndex(['refill_date', 'status']);
        });
    }
};
