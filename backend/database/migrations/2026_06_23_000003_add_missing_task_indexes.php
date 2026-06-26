<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Tasks table — composite index for overdue queries
        Schema::table('tasks', function (Blueprint $table) {
            try {
                $table->index(['shop_id', 'due_date', 'status'], 'tasks_shop_date_status_idx');
            } catch (\Exception $e) {
                // Index may already exist — skip
            }
        });

        Schema::table('tasks', function (Blueprint $table) {
            try {
                $table->index('assigned_by', 'tasks_assigned_by_idx');
            } catch (\Exception $e) {
                // skip
            }
        });

        // Task updates — composite index for ordered timeline queries
        Schema::table('task_updates', function (Blueprint $table) {
            // Drop the existing single-column index on task_id if it exists
            try {
                $sm = Schema::getConnection()->getDoctrineSchemaManager();
                $indexes = $sm->listTableIndexes('task_updates');
                if (isset($indexes['task_updates_task_id_index'])) {
                    $table->dropIndex('task_updates_task_id_index');
                }
            } catch (\Exception $e) {
                // skip
            }
        });

        Schema::table('task_updates', function (Blueprint $table) {
            try {
                $table->index(['task_id', 'created_at'], 'task_updates_task_created_idx');
            } catch (\Exception $e) {
                // skip
            }
        });

        Schema::table('task_updates', function (Blueprint $table) {
            try {
                $table->index('updated_by', 'task_updates_updated_by_idx');
            } catch (\Exception $e) {
                // skip
            }
        });
    }

    public function down(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            try { $table->dropIndex('tasks_shop_date_status_idx'); } catch (\Exception $e) {}
            try { $table->dropIndex('tasks_assigned_by_idx'); } catch (\Exception $e) {}
        });

        Schema::table('task_updates', function (Blueprint $table) {
            try { $table->dropIndex('task_updates_task_created_idx'); } catch (\Exception $e) {}
            try { $table->dropIndex('task_updates_updated_by_idx'); } catch (\Exception $e) {}
        });
    }
};
