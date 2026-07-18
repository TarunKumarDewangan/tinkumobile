<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Separates "who paid for this unit" (purchase_invoices.shop_id — untouched,
     * stays with the buying shop forever for GST/supplier/purchase reporting)
     * from "which shop currently holds it" (this column — moved by Stock Transfer).
     * Defaults every existing row to its own invoice's shop, so nothing changes
     * for stock that has never been transferred.
     */
    public function up(): void
    {
        Schema::table('purchase_items', function (Blueprint $table) {
            $table->foreignId('current_shop_id')->nullable()->after('product_id')->constrained('shops')->nullOnDelete();
            $table->index('current_shop_id');
        });

        // Driver-portable backfill (the test suite runs migrations against
        // SQLite, which doesn't support MySQL's multi-table UPDATE...JOIN).
        DB::table('purchase_invoices')->select('id', 'shop_id')->orderBy('id')
            ->chunk(200, function ($invoices) {
                foreach ($invoices as $invoice) {
                    DB::table('purchase_items')
                        ->where('purchase_invoice_id', $invoice->id)
                        ->whereNull('current_shop_id')
                        ->update(['current_shop_id' => $invoice->shop_id]);
                }
            });
    }

    public function down(): void
    {
        Schema::table('purchase_items', function (Blueprint $table) {
            $table->dropConstrainedForeignId('current_shop_id');
        });
    }
};
