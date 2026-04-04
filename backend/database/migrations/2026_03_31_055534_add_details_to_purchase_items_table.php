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
            $table->string('imei')->nullable()->after('product_id');
            $table->string('ram')->nullable()->after('imei');
            $table->string('storage')->nullable()->after('ram');
            $table->string('color')->nullable()->after('storage');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('purchase_items', function (Blueprint $table) {
            $table->dropColumn(['imei', 'ram', 'storage', 'color']);
        });
    }
};
