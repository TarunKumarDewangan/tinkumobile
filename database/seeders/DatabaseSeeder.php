<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Shop;
use App\Models\Category;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // ── 1. Permissions ──────────────────────────────────────────────────
        $permissions = [
            'view_products', 'create_products', 'edit_products', 'delete_products',
            'view_purchases', 'create_purchases', 'edit_purchases', 'delete_purchases',
            'view_sales', 'create_sales', 'edit_sales', 'delete_sales', 'convert_kaccha_to_pakka',
            'view_recharge_purchases', 'create_recharge_purchases',
            'view_recharge_sales', 'create_recharge_sales',
            'view_sims', 'purchase_sims', 'sell_sims',
            'view_old_mobile_purchases', 'create_old_mobile_purchases',
            'view_repairs', 'create_repair_requests', 'edit_repair_requests',
            'assign_repair', 'update_repair_status',
            'view_followups', 'create_followup', 'edit_followup', 'delete_followup',
            'view_loans', 'create_loan', 'record_loan_payment',
            'view_gifts', 'purchase_gifts', 'assign_gift_in_sale',
            'view_reports', 'view_all_shops_reports',
            'manage_shops', 'manage_users', 'manage_roles',
            'manage_incentives', 'manage_offers',
            'view_airtel_recovery', 'manage_airtel_recovery',
            'view_dashboard', 'view_customers', 'view_staff', 'view_suppliers',
        ];

        foreach ($permissions as $perm) {
            Permission::firstOrCreate(['name' => $perm, 'guard_name' => 'web']);
        }

        // ── 2. Roles ────────────────────────────────────────────────────────
        $managerRole = Role::firstOrCreate(['name' => 'manager', 'guard_name' => 'web']);
        $cashierRole = Role::firstOrCreate(['name' => 'cashier', 'guard_name' => 'web']);
        $stockRole   = Role::firstOrCreate(['name' => 'stock_clerk', 'guard_name' => 'web']);
        $repairRole  = Role::firstOrCreate(['name' => 'repair_tech', 'guard_name' => 'web']);
        $auditorRole = Role::firstOrCreate(['name' => 'auditor', 'guard_name' => 'web']);
        $recoveryRole = Role::firstOrCreate(['name' => 'recovery_man', 'guard_name' => 'web']);

        $managerRole->syncPermissions([
            'view_products','create_products','edit_products',
            'view_purchases','create_purchases','edit_purchases',
            'view_sales','create_sales','edit_sales','convert_kaccha_to_pakka','delete_sales',
            'view_recharge_purchases','create_recharge_purchases',
            'view_recharge_sales','create_recharge_sales',
            'view_sims','purchase_sims','sell_sims',
            'view_old_mobile_purchases','create_old_mobile_purchases',
            'view_repairs','create_repair_requests','assign_repair','update_repair_status',
            'view_followups','create_followup','edit_followup',
            'view_loans','create_loan','record_loan_payment',
            'view_gifts','purchase_gifts','assign_gift_in_sale',
            'view_reports','manage_users','manage_incentives',
            'view_airtel_recovery', 'manage_airtel_recovery',
            'view_dashboard', 'view_customers', 'view_staff', 'view_suppliers',
        ]);

        $cashierRole->syncPermissions([
            'view_products','create_sales','view_sales','create_recharge_sales',
            'sell_sims','view_followups','create_followup',
            'view_dashboard', 'view_customers',
        ]);

        $stockRole->syncPermissions([
            'view_products','create_purchases','edit_purchases','view_purchases',
            'purchase_sims','purchase_gifts',
        ]);

        $repairRole->syncPermissions([
            'view_repairs','create_repair_requests','edit_repair_requests',
            'assign_repair','update_repair_status',
        ]);

        $auditorRole->syncPermissions(['view_reports']);

        $recoveryRole->syncPermissions([
            'view_airtel_recovery'
        ]);

        // ── 3. Main shop ────────────────────────────────────────────────────
        $shop = Shop::firstOrCreate(
            ['name' => 'TinkuMobiles Main Branch'],
            [
                'address' => '123 Main Street, City',
                'phone'   => '9876543210',
                'email'   => 'main@tinkumobiles.com',
                'is_main' => true,
            ]
        );

        // ── 4. Owner account ─────────────────────────────────────────────────
        User::firstOrCreate(
            ['email' => 'owner@tinkumobiles.com'],
            [
                'name'     => 'Tinku (Owner)',
                'password' => Hash::make('password'),
                'is_owner' => true,
                'shop_id'  => null,
            ]
        );

        // ── 5. Manager account ───────────────────────────────────────────────
        $manager = User::firstOrCreate(
            ['email' => 'manager@tinkumobiles.com'],
            [
                'name'     => 'Raju Manager',
                'password' => Hash::make('password'),
                'is_owner' => false,
                'shop_id'  => $shop->id,
            ]
        );
        $manager->syncRoles(['manager']);

        // ── 6. Sample Cashier ─────────────────────────────────────────────────
        $cashier = User::firstOrCreate(
            ['email' => 'cashier@tinkumobiles.com'],
            [
                'name'     => 'Priya Cashier',
                'password' => Hash::make('password'),
                'is_owner' => false,
                'shop_id'  => $shop->id,
            ]
        );
        $cashier->syncRoles(['cashier']);

        // ── 7. Categories ─────────────────────────────────────────────────────
        $cats = [
            ['name' => 'Mobile New',      'slug' => 'mobile-new'],
            ['name' => 'Mobile Old',      'slug' => 'mobile-old'],
            ['name' => 'Accessory',       'slug' => 'accessory'],
            ['name' => 'SIM',             'slug' => 'sim'],
            ['name' => 'Recharge',        'slug' => 'recharge'],
            ['name' => 'Repair Service',  'slug' => 'repair-service'],
        ];
        foreach ($cats as $cat) {
            Category::firstOrCreate(['slug' => $cat['slug']], ['name' => $cat['name']]);
        }

        // ── 8. Recovery Man ──────────────────────────────────────────────────
        $recoveryUser = User::firstOrCreate(
            ['email' => 'recovery@tinkumobiles.com'],
            [
                'name'     => 'Airtel Recovery Man',
                'password' => Hash::make('password'),
                'is_owner' => false,
                'shop_id'  => $shop->id,
            ]
        );
        $recoveryUser->syncRoles(['recovery_man']);

        $this->call(RetailerSeeder::class);
        $this->call(RetailerBulkSeeder::class);
        $this->call(AdminSeeder::class);

        $this->command->info('✅ Seeding complete!');
        $this->command->info('   Admin:    admin@tinkumobile.in / admin123');
        $this->command->info('   Owner:   owner@tinkumobiles.com / password');
        $this->command->info('   Manager: manager@tinkumobiles.com / password');
        $this->command->info('   Cashier: cashier@tinkumobiles.com / password');
        $this->command->info('   Recovery: recovery@tinkumobiles.com / password');
    }
}
