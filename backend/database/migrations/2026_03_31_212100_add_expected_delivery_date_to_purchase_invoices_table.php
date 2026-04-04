<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_invoices', function (Blueprint $col) {
            $col->date('expected_delivery_date')->nullable()->after('purchase_date');
        });
    }

    public function down(): void
    {
        Schema::table('purchase_invoices', function (Blueprint $col) {
            $col->dropColumn('expected_delivery_date');
        });
    }
};
