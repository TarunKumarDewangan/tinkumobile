<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('follow_ups', function (Blueprint $table) {
            $table->foreignId('shop_id')->nullable()->after('customer_id')->constrained('shops')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->after('shop_id')->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('follow_ups', function (Blueprint $table) {
            $table->dropForeign(['shop_id']);
            $table->dropForeign(['created_by']);
            $table->dropColumn(['shop_id', 'created_by']);
        });
    }
};
