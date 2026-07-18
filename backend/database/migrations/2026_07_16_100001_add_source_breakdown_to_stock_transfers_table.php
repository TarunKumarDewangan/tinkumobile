<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Records exactly which source purchase_item row(s) supplied this transfer,
     * and how much was taken from each — needed to precisely restore them on
     * cancel, and to clone the same batch metadata (price/config) onto the new
     * purchase_item row(s) created at the destination shop on receive.
     */
    public function up(): void
    {
        Schema::table('stock_transfers', function (Blueprint $table) {
            $table->json('source_breakdown')->nullable()->after('notes');
        });
    }

    public function down(): void
    {
        Schema::table('stock_transfers', function (Blueprint $table) {
            $table->dropColumn('source_breakdown');
        });
    }
};
