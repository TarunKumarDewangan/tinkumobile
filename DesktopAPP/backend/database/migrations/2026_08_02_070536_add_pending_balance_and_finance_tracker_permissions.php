<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;

return new class extends Migration
{
    /**
     * Pending Balance and Finance Tracker were previously gated by view_sales,
     * which every sales-facing role already has (it's needed just to view the
     * sales list) — so both financial-oversight pages were visible to roles
     * that shouldn't see them. Split them into their own dedicated permissions,
     * left ungranted by default; the owner assigns them per role explicitly
     * via Settings -> Role Permissions.
     */
    public function up(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        foreach (['view_pending_balance', 'view_finance_tracker'] as $perm) {
            Permission::firstOrCreate(['name' => $perm, 'guard_name' => 'web']);
        }

        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
    }

    public function down(): void
    {
        Permission::whereIn('name', ['view_pending_balance', 'view_finance_tracker'])->delete();
    }
};
