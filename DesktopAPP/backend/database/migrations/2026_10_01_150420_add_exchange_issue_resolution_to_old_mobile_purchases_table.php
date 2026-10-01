<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Tracks manual review/resolution of old-mobile purchases caught by the
     * exchange-credit audit (the "Adjust against existing balance" option
     * silently cancelling out the trade-in credit instead of applying it,
     * fixed 2026-10-01). Resolved rows drop off the audit list.
     */
    public function up(): void
    {
        Schema::table('old_mobile_purchases', function (Blueprint $table) {
            $table->timestamp('exchange_issue_resolved_at')->nullable()->after('exchange_credit_amount');
            $table->string('exchange_issue_resolution')->nullable()->after('exchange_issue_resolved_at');
            $table->text('exchange_issue_note')->nullable()->after('exchange_issue_resolution');
            $table->foreignId('exchange_issue_resolved_by')->nullable()->after('exchange_issue_note')
                ->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('old_mobile_purchases', function (Blueprint $table) {
            $table->dropForeign(['exchange_issue_resolved_by']);
            $table->dropColumn([
                'exchange_issue_resolved_at',
                'exchange_issue_resolution',
                'exchange_issue_note',
                'exchange_issue_resolved_by',
            ]);
        });
    }
};
