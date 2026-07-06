<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;

return new class extends Migration
{
    public function up(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        // Ensure task permissions exist
        $taskPerms = ['view_tasks', 'assign_tasks', 'complete_task'];
        foreach ($taskPerms as $perm) {
            Permission::firstOrCreate(['name' => $perm, 'guard_name' => 'web']);
        }

        // computer_operator — typical billing/sales staff permissions
        $coPerms = [
            'view_dashboard', 'view_customers', 'view_products',
            'view_sales', 'create_sales', 'edit_sales',
            'view_purchases', 'view_recharge_purchases', 'create_recharge_purchases',
            'view_recharge_sales', 'create_recharge_sales',
            'view_sims', 'sell_sims',
            'view_old_mobile_purchases',
            'view_repairs', 'create_repair_requests',
            'view_followups', 'create_followup', 'edit_followup',
            'view_tasks', 'complete_task',
        ];

        // sales_person — lighter set, mainly selling
        $spPerms = [
            'view_dashboard', 'view_customers', 'view_products',
            'view_sales', 'create_sales',
            'view_followups', 'create_followup', 'edit_followup',
            'view_tasks', 'complete_task',
            'sell_sims', 'view_sims',
        ];

        // manager gets task permissions too
        $managerExtraPerms = ['view_tasks', 'assign_tasks', 'complete_task'];

        // syncPermissions()/givePermissionTo() below require the Permission rows to
        // already exist — unlike $taskPerms above, $coPerms/$spPerms were never
        // explicitly created first. In an environment where a prior seeder hadn't
        // already inserted these (e.g. a fresh migrate with no seed step, as in
        // the test suite), this threw PermissionDoesNotExist.
        foreach (array_unique(array_merge($coPerms, $spPerms, $managerExtraPerms)) as $perm) {
            Permission::firstOrCreate(['name' => $perm, 'guard_name' => 'web']);
        }

        $this->syncIfExists('computer_operator', $coPerms);
        $this->syncIfExists('sales_person',      $spPerms);
        $this->addIfExists('manager',            $managerExtraPerms);
        $this->addIfExists('cashier',            ['view_tasks', 'complete_task']);

        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
    }

    private function syncIfExists(string $roleName, array $perms): void
    {
        $role = Role::where('name', $roleName)->first();
        if (! $role) {
            $role = Role::create(['name' => $roleName, 'guard_name' => 'web']);
        }
        $role->syncPermissions($perms);
    }

    private function addIfExists(string $roleName, array $perms): void
    {
        $role = Role::where('name', $roleName)->first();
        if ($role) {
            $role->givePermissionTo($perms);
        }
    }

    public function down(): void {}
};
