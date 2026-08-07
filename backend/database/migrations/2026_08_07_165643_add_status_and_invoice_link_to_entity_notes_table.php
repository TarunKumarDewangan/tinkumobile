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
        Schema::table('entity_notes', function (Blueprint $table) {
            $table->string('status', 20)->default('PENDING')->after('note');
            $table->foreignId('sale_invoice_id')->nullable()->after('entity_id')->constrained()->nullOnDelete();
            $table->timestamp('resolved_at')->nullable()->after('status');
            $table->index('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('entity_notes', function (Blueprint $table) {
            $table->dropConstrainedForeignId('sale_invoice_id');
            $table->dropColumn(['status', 'resolved_at']);
        });
    }
};
