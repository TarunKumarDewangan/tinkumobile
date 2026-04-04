<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\Shop;
use Spatie\Permission\Models\Role;
use Illuminate\Support\Facades\Hash;

class AdminSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function up(): void
    {
        // 1. Create Admin Role
        $adminRole = Role::firstOrCreate(['name' => 'Admin']);

        // 2. Create Default Admin User
        $shop = Shop::first(); // Assign to first shop or create one
        if (!$shop) {
            $shop = Shop::create(['name' => 'Main Head Office', 'address' => 'Main City', 'phone' => '0000000000']);
        }

        $admin = User::firstOrCreate(
            ['email' => 'admin@tinkumobile.in'],
            [
                'name' => 'System Admin',
                'password' => Hash::make('admin123'),
                'shop_id' => $shop->id,
                'is_owner' => false, // Admin is a role, not 'is_owner' flag
                'status' => 'active'
            ]
        );

        $admin->assignRole($adminRole);

        echo "Admin User Created: admin@tinkumobile.in / admin123\n";
    }

    // Standard run method
    public function run(): void
    {
        $this->up();
    }
}
