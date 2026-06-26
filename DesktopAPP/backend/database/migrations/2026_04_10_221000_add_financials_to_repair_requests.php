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
            $table->decimal('quoted_amount', 12, 2)->default(0)->after('device_model');
            $table->decimal('service_center_cost', 12, 2)->default(0)->after('quoted_amount');
            $table->decimal('advance_amount', 12, 2)->default(0)->after('service_center_cost');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('repair_requests', function (Blueprint $table) {
            $table->dropColumn(['quoted_amount', 'service_center_cost', 'advance_amount']);
        });
    }
};
