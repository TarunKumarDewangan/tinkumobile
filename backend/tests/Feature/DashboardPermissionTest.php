<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;
use App\Models\Shop;
use App\Models\User;

/** The dashboard figures are only served to roles with view_dashboard (owner/admin always). */
class DashboardPermissionTest extends TestCase
{
    use RefreshDatabase;

    public function test_dashboard_requires_view_dashboard_permission()
    {
        $shop = Shop::create(['name' => 'Test Shop', 'address' => 'x', 'phone' => '1234567890']);
        Permission::findOrCreate('view_dashboard', 'web');
        $withRole = Role::findOrCreate('sales_person', 'web');
        $withoutRole = Role::findOrCreate('test_no_dashboard', 'web');
        $withRole->givePermissionTo('view_dashboard');

        $allowed = User::factory()->create(['shop_id' => $shop->id]);
        $allowed->assignRole($withRole);
        $blocked = User::factory()->create(['shop_id' => $shop->id]);
        $blocked->assignRole($withoutRole);
        $owner = User::factory()->create(['shop_id' => $shop->id, 'is_owner' => true]);

        $this->actingAs($blocked)->getJson('/api/reports/dashboard')->assertStatus(403);
        $this->actingAs($allowed)->getJson('/api/reports/dashboard')->assertStatus(200);
        $this->actingAs($owner)->getJson('/api/reports/dashboard')->assertStatus(200);
    }
}
