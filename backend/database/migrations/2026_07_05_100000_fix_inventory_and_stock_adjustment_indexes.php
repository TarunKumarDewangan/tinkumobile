<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Corrective migration.
 *
 * 2026_04_23_035442_add_performance_indexes_to_core_tables.php intended to add
 * a [shop_id, stock] index to the `inventory` table, but targeted the
 * nonexistent table `inventories` (plural) and guarded on a nonexistent
 * `quantity` column, so it silently added nothing. That migration has
 * already run in production, so it is left as-is (never edit an applied
 * migration) and the intended index is added here instead.
 *
 * Also adds the `adjustment_date` index on stock_adjustments — the primary
 * per-day filter column in StockController::dailyLedger — which no prior
 * migration added.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inventory', function (Blueprint $table) {
            if (!$this->indexExists('inventory', 'inventory_shop_id_stock_index')) {
                $table->index(['shop_id', 'stock']);
            }
        });

        Schema::table('stock_adjustments', function (Blueprint $table) {
            if (!$this->indexExists('stock_adjustments', 'stock_adjustments_adjustment_date_index')) {
                $table->index('adjustment_date');
            }
            if (!$this->indexExists('stock_adjustments', 'stock_adjustments_reason_index')) {
                $table->index('reason');
            }
        });
    }

    public function down(): void
    {
        Schema::table('inventory', function (Blueprint $table) {
            if ($this->indexExists('inventory', 'inventory_shop_id_stock_index')) {
                $table->dropIndex(['shop_id', 'stock']);
            }
        });

        Schema::table('stock_adjustments', function (Blueprint $table) {
            if ($this->indexExists('stock_adjustments', 'stock_adjustments_adjustment_date_index')) {
                $table->dropIndex(['adjustment_date']);
            }
            if ($this->indexExists('stock_adjustments', 'stock_adjustments_reason_index')) {
                $table->dropIndex(['reason']);
            }
        });
    }

    private function indexExists(string $table, string $indexName): bool
    {
        foreach (Schema::getIndexes($table) as $index) {
            if (strtolower($index['name']) === strtolower($indexName)) {
                return true;
            }
        }
        return false;
    }
};
