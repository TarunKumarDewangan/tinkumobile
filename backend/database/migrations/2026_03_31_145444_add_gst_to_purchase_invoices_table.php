<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_invoices', function (Blueprint $table) {
            $table->decimal('cgst_rate', 5, 2)->default(9)->after('total_amount');
            $table->decimal('sgst_rate', 5, 2)->default(9)->after('cgst_rate');
            $table->decimal('cgst_amount', 12, 2)->default(0)->after('sgst_rate');
            $table->decimal('sgst_amount', 12, 2)->default(0)->after('cgst_amount');
        });
    }

    public function down(): void
    {
        Schema::table('purchase_invoices', function (Blueprint $table) {
            $table->dropColumn(['cgst_rate', 'sgst_rate', 'cgst_amount', 'sgst_amount']);
        });
    }
};
