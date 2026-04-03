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
        Schema::table('purchase_items', function (Blueprint $table) {
            if (!Schema::hasColumn('purchase_items', 'received_quantity')) {
                $table->integer('received_quantity')->after('quantity')->default(0);
            }
            if (!Schema::hasColumn('purchase_items', 'damaged_quantity')) {
                $table->integer('damaged_quantity')->after('received_quantity')->default(0);
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('purchase_items', function (Blueprint $table) {
            $table->dropColumn(['received_quantity', 'damaged_quantity']);
        });
    }
};
