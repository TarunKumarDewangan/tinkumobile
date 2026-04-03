<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_invoices', function (Blueprint $table) {
            // Status: ordered = stock NOT yet in inventory, received = stock added to inventory
            $table->enum('status', ['ordered', 'received'])->default('ordered')->after('notes');
            $table->dateTime('received_at')->nullable()->after('status'); // when stock was received
        });
    }

    public function down(): void
    {
        Schema::table('purchase_invoices', function (Blueprint $table) {
            $table->dropColumn(['status', 'received_at']);
        });
    }
};
