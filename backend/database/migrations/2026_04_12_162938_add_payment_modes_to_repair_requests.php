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
        Schema::table('repair_requests', function (Blueprint $table) {
            $table->string('advance_payment_mode')->nullable()->after('advance_amount');
            $table->string('balance_payment_mode')->nullable()->after('balance_amount_received');
        });
    }

    public function down(): void
    {
        Schema::table('repair_requests', function (Blueprint $table) {
            $table->dropColumn(['advance_payment_mode', 'balance_payment_mode']);
        });
    }
};
