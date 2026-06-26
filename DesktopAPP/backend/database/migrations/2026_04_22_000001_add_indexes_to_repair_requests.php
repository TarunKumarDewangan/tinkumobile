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
        Schema::table('repair_requests', function (Blueprint $table) {
            $table->index(['status', 'submitted_date']);
            $table->index(['customer_phone', 'status']);
            $table->index('device_model');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('repair_requests', function (Blueprint $table) {
            $table->dropIndex(['status', 'submitted_date']);
            $table->dropIndex(['customer_phone', 'status']);
            $table->dropIndex(['device_model']);
        });
    }
};
