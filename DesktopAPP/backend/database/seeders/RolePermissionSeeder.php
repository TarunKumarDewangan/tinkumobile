<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use App\Models\User;

class RolePermissionSeeder extends Seeder
{
    /**
     * Seed roles and permissions.
     * Idempotent — safe to re-run.
     */
    public function run(): void
    {
        // Reset cached roles and permissions
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        // ─── 1. Define all permissions ─────────────────────────────────
        $allPermissions = [
            // Dashboard
            'view_dashboard',

            // Sales
            'view_sales', 'create_sale', 'edit_sale', 'delete_sale',

            // Purchases
            'view_purchases', 'create_purchase', 'delete_purchase',

            // Repairs
            'view_repairs', 'create_repair', 'update_repair_status',

            // Reports
            'view_reports',

            // Accounts / Ledger
            'view_accounts',

            // Employees
            'view_employees', 'manage_employees',

            // Users (admin-level)
            'manage_users',

            // Airtel Recovery
            'view_airtel', 'manage_airtel',

            // Loans
            'manage_loans',

            // Recharge / SIM
            'view_recharge', 'manage_recharge',

            // Tasks
            'assign_tasks', 'view_tasks', 'complete_task',
        ];

        // Create each permission if it doesn't exist
        foreach ($allPermissions as $perm) {
            Permission::firstOrCreate(['name' => $perm, 'guard_name' => 'web']);
        }

        // ─── 2. Define roles and their permission sets ────────────────
        $roles = [
            'Admin' => $allPermissions, // Admin gets all permissions
            'Manager' => [
                'view_dashboard', 'view_sales', 'create_sale', 'edit_sale', 'delete_sale',
                'view_purchases', 'create_purchase', 'delete_purchase',
                'view_repairs', 'create_repair', 'update_repair_status',
                'view_reports', 'view_accounts', 'view_employees', 'manage_employees',
                'view_airtel', 'manage_airtel', 'manage_loans',
                'view_recharge', 'manage_recharge',
                'assign_tasks', 'view_tasks', 'complete_task',
            ],
            'Sales Staff' => [
                'view_dashboard',
                'view_sales', 'create_sale', 'edit_sale',
                'view_repairs', 'create_repair',
                'view_recharge', 'manage_recharge',
                'view_tasks', 'complete_task',
            ],
            'Accountant' => [
                'view_dashboard',
                'view_sales', 'view_purchases',
                'view_reports', 'view_accounts',
                'view_employees',
                'view_airtel', 'manage_loans',
                'view_tasks', 'complete_task',
            ],
            'Technician' => [
                'view_dashboard',
                'view_repairs', 'create_repair', 'update_repair_status',
                'view_tasks', 'complete_task',
            ],
            'Cashier' => [
                'view_dashboard',
                'view_sales', 'create_sale',
                'view_recharge', 'manage_recharge',
                'view_tasks', 'complete_task',
            ],
            'Viewer' => [
                'view_dashboard',
                'view_sales', 'view_purchases', 'view_repairs',
                'view_reports', 'view_airtel', 'view_recharge',
                'view_employees', 'view_tasks',
            ],
        ];

        // Create roles and sync permissions
        foreach ($roles as $roleName => $perms) {
            $role = Role::firstOrCreate(['name' => $roleName, 'guard_name' => 'web']);
            $role->syncPermissions($perms);
        }

        // ─── 3. Assign Manager role to any user with isManager() capability ───
        // This preserves backward compatibility — existing managers get their role
        $managerUsers = User::whereHas('roles', function ($q) {
            $q->where('name', 'manager');
        })->get();

        foreach ($managerUsers as $user) {
            if (!$user->hasRole('Manager')) {
                $user->assignRole('Manager');
            }
        }

        $this->command->info('Roles and permissions seeded successfully.');
    }
}
