<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $tables = [
            'transactions',
            'repair_requests',
            'sale_invoices',
            'purchase_invoices',
            'loans'
        ];

        foreach ($tables as $tableName) {
            if (Schema::hasTable($tableName) && !Schema::hasColumn($tableName, 'entity_id')) {
                Schema::table($tableName, function (Blueprint $table) {
                    $table->foreignId('entity_id')->after('id')->nullable()->index()->constrained('entities')->onDelete('set null');
                });
            }
        }

        $this->backfill();
    }

    /**
     * Backfill entity_id based on names or existing IDs.
     */
    protected function backfill()
    {
        // 1. Transactions - Using entity_name
        DB::table('transactions')->whereNull('entity_id')->chunkById(100, function($rows) {
            foreach ($rows as $row) {
                if ($row->entity_name) {
                    $entity = DB::table('entities')->where('name', $row->entity_name)->first();
                    if ($entity) {
                        DB::table('transactions')->where('id', $row->id)->update(['entity_id' => $entity->id]);
                    }
                }
            }
        });

        // 2. Sale Invoices - Using customer_id -> Customer Name -> Entity Name
        DB::table('sale_invoices')->whereNull('entity_id')->chunkById(100, function($rows) {
            foreach ($rows as $row) {
                $customer = DB::table('customers')->where('id', $row->customer_id)->first();
                if ($customer) {
                    $entity = DB::table('entities')->where('name', $customer->name)->first();
                    if ($entity) {
                        DB::table('sale_invoices')->where('id', $row->id)->update(['entity_id' => $entity->id]);
                    }
                }
            }
        });

        // 3. Purchase Invoices - Using supplier_id -> Supplier Name -> Entity Name
        DB::table('purchase_invoices')->whereNull('entity_id')->chunkById(100, function($rows) {
            foreach ($rows as $row) {
                $supplier = DB::table('suppliers')->where('id', $row->supplier_id)->first();
                if ($supplier) {
                    $entity = DB::table('entities')->where('name', $supplier->name)->first();
                    if ($entity) {
                        DB::table('purchase_invoices')->where('id', $row->id)->update(['entity_id' => $entity->id]);
                    }
                }
            }
        });

        // 4. Repair Requests - Using customer_id or customer_name
        DB::table('repair_requests')->whereNull('entity_id')->chunkById(100, function($rows) {
            foreach ($rows as $row) {
                $name = $row->customer_name;
                if (!$name && $row->customer_id) {
                    $name = DB::table('customers')->where('id', $row->customer_id)->value('name');
                }
                if ($name) {
                    $entity = DB::table('entities')->where('name', $name)->first();
                    if ($entity) {
                        DB::table('repair_requests')->where('id', $row->id)->update(['entity_id' => $entity->id]);
                    }
                }
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $tables = [
            'transactions',
            'repair_requests',
            'sale_invoices',
            'purchase_invoices',
            'loans'
        ];

        foreach ($tables as $tableName) {
            if (Schema::hasTable($tableName)) {
                Schema::table($tableName, function (Blueprint $table) {
                    $table->dropConstrainedForeignId('entity_id');
                });
            }
        }
    }
};
