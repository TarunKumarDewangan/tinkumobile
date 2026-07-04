<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_items', function (Blueprint $table) {
            $table->decimal('trade_disc_pct', 5, 2)->default(0)->after('total');
            $table->decimal('cash_disc_pct', 5, 2)->default(0)->after('trade_disc_pct');
            $table->decimal('calc_gst_rate', 5, 2)->default(0)->after('cash_disc_pct');
            $table->boolean('apply_gst')->default(false)->after('calc_gst_rate');
        });
    }

    public function down(): void
    {
        Schema::table('purchase_items', function (Blueprint $table) {
            $table->dropColumn(['trade_disc_pct', 'cash_disc_pct', 'calc_gst_rate', 'apply_gst']);
        });
    }
};
