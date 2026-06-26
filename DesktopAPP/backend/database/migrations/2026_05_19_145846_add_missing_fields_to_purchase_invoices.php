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
        Schema::table('purchase_invoices', function (Blueprint $table) {
            $table->decimal('round_off', 10, 2)->default(0)->after('rounding_mode');
            $table->boolean('is_gst_manual')->default(false)->after('round_off');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('purchase_invoices', function (Blueprint $table) {
            $table->dropColumn(['round_off', 'is_gst_manual']);
        });
    }

};
