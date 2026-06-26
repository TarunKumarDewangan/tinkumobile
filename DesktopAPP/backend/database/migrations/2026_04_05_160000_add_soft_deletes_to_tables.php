<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $tables = [
            'users',
            'suppliers',
            'customers',
            'products',
            'purchase_invoices',
            'sale_invoices',
            'retailers',
            'airtel_drops',
            'airtel_recoveries'
        ];

        foreach ($tables as $table) {
            if (!Schema::hasColumn($table, 'deleted_at')) {
                Schema::table($table, function (Blueprint $table) {
                    $table->softDeletes();
                });
            }
        }
    }

    public function down(): void
    {
        $tables = [
            'users',
            'suppliers',
            'customers',
            'products',
            'purchase_invoices',
            'sale_invoices',
            'retailers',
            'airtel_drops',
            'airtel_recoveries'
        ];

        foreach ($tables as $table) {
            if (Schema::hasColumn($table, 'deleted_at')) {
                Schema::table($table, function (Blueprint $table) {
                    $table->dropSoftDeletes();
                });
            }
        }
    }
};
