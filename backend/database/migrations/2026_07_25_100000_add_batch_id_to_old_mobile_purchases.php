<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Groups multiple devices bought from the same customer in one visit
     * (via the bulk purchase form) so the list page can display them as one
     * combined entry — while each device stays its own row for individual
     * editing/deleting/inventory tracking, exactly as before. Null for
     * every purchase made through the original single-device flow.
     */
    public function up(): void
    {
        Schema::table('old_mobile_purchases', function (Blueprint $table) {
            $table->uuid('batch_id')->nullable()->after('id');
            $table->index('batch_id');
        });
    }

    public function down(): void
    {
        Schema::table('old_mobile_purchases', function (Blueprint $table) {
            $table->dropColumn('batch_id');
        });
    }
};
