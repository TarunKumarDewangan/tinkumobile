<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_items', function (Blueprint $table) {
            // Rate (Ex. GST) and Rate (Incl. of Tax) as typed by the user for a
            // "Manual Rate" row — unlike the normal auto-calc flow, these are
            // never recomputed from unit_price/discount%/GST%, so they must be
            // stored verbatim or a manual entry would revert on next edit.
            $table->decimal('rate_ex_gst', 12, 2)->nullable()->after('apply_gst');
            $table->decimal('rate_incl_gst', 12, 2)->nullable()->after('rate_ex_gst');
            $table->boolean('is_manual_rate')->default(false)->after('rate_incl_gst');
        });
    }

    public function down(): void
    {
        Schema::table('purchase_items', function (Blueprint $table) {
            $table->dropColumn(['rate_ex_gst', 'rate_incl_gst', 'is_manual_rate']);
        });
    }
};
