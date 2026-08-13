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
        Schema::table('old_mobile_purchases', function (Blueprint $table) {
            $table->boolean('pay_later')->default(false)->after('is_exchange');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('old_mobile_purchases', function (Blueprint $table) {
            $table->dropColumn('pay_later');
        });
    }
};
