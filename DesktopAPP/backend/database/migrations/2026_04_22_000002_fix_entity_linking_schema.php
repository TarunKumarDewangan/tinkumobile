<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Rename columns in tables that don't have polymorphic entity_id
        $tablesToRename = [
            'repair_requests',
            'sale_invoices',
            'purchase_invoices',
            'loans'
        ];

        foreach ($tablesToRename as $tableName) {
            if (Schema::hasColumn($tableName, 'entity_id')) {
                Schema::table($tableName, function (Blueprint $table) {
                    $table->renameColumn('entity_id', 'accounting_entity_id');
                });
            }
        }

        // 2. Add accounting_entity_id to transactions (since entity_id is taken by polymorphism)
        if (Schema::hasTable('transactions') && !Schema::hasColumn('transactions', 'accounting_entity_id')) {
            Schema::table('transactions', function (Blueprint $table) {
                $table->foreignId('accounting_entity_id')->after('id')->nullable()->index()->constrained('entities')->onDelete('set null');
            });
        }

        // 3. Backfill transactions.accounting_entity_id based on entity_name
        DB::table('transactions')->whereNull('accounting_entity_id')->chunkById(100, function($rows) {
            foreach ($rows as $row) {
                if ($row->entity_name) {
                    $entityId = DB::table('entities')->where('name', $row->entity_name)->value('id');
                    if ($entityId) {
                        DB::table('transactions')->where('id', $row->id)->update(['accounting_entity_id' => $entityId]);
                    }
                }
            }
        });
    }

    public function down(): void
    {
        $tablesToRename = [
            'repair_requests',
            'sale_invoices',
            'purchase_invoices',
            'loans'
        ];

        foreach ($tablesToRename as $tableName) {
            if (Schema::hasColumn($tableName, 'accounting_entity_id')) {
                Schema::table($tableName, function (Blueprint $table) {
                    $table->renameColumn('accounting_entity_id', 'entity_id');
                });
            }
        }

        if (Schema::hasColumn('transactions', 'accounting_entity_id')) {
            Schema::table('transactions', function (Blueprint $table) {
                $table->dropConstrainedForeignId('accounting_entity_id');
            });
        }
    }
};
