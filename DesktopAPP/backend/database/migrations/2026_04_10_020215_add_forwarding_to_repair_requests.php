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
            $table->date('submitted_date')->nullable()->after('customer_email');
            $table->boolean('is_forwarded')->default(false)->after('issue_description');
            $table->string('forwarded_to')->nullable()->after('is_forwarded');
            $table->date('external_expected_delivery')->nullable()->after('forwarded_to');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('repair_requests', function (Blueprint $table) {
            $table->dropColumn(['submitted_date', 'is_forwarded', 'forwarded_to', 'external_expected_delivery']);
        });
    }
};
