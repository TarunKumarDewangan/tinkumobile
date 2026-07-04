<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_items', function (Blueprint $table) {
            $table->boolean('apply_gst')->nullable()->default(null)->change();
        });

        // Reset all existing rows to NULL so the frontend falls back to
        // deriving apply_gst from the product's gst_rate. The previous
        // migration set DEFAULT false, stamping 0 on every legacy row.
        DB::table('purchase_items')->update(['apply_gst' => null]);
    }

    public function down(): void
    {
        DB::table('purchase_items')->whereNull('apply_gst')->update(['apply_gst' => false]);
        Schema::table('purchase_items', function (Blueprint $table) {
            $table->boolean('apply_gst')->default(false)->change();
        });
    }
};
