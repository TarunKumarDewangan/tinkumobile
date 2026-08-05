<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            // Traces a dual-posted mirror row back to the primary transaction
            // that spawned it, so editing/deleting the primary can reliably
            // clean up its mirror(s) instead of leaving stale bank entries.
            $table->foreignId('mirror_of_transaction_id')->nullable()->after('is_internal_transfer')
                ->constrained('transactions')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->dropForeign(['mirror_of_transaction_id']);
            $table->dropColumn('mirror_of_transaction_id');
        });
    }
};
