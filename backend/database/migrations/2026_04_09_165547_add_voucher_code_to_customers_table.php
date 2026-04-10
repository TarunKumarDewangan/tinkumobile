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
        Schema::table('customers', function (Blueprint $table) {
            // Drop old columns if they exist
            if (Schema::hasColumn('customers', 'event_type')) {
                $table->dropColumn(['event_type', 'event_name', 'event_date']);
            }
            // Add voucher_code if it doesn't exist
            if (!Schema::hasColumn('customers', 'voucher_code')) {
                $table->string('voucher_code')->nullable()->after('address');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->dropColumn('voucher_code');
        });
    }
};
