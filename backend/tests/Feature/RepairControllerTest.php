<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use App\Models\User;
use App\Models\Shop;
use App\Models\Entity;

class RepairControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_can_create_repair_request()
    {
        $shop = Shop::create(['name' => 'Test Shop', 'address' => '123 Test St', 'phone' => '1234567890']);
        $user = User::factory()->create(['shop_id' => $shop->id]);
        
        $payload = [
            'customer_name' => 'John Repair',
            'customer_phone' => '9876543210',
            'device_model' => 'iPhone 13',
            'issue_description' => ['Broken Screen'],
            'estimated_cost' => 5000,
            'status' => 'PENDING',
            'password_pattern' => '1234',
            'submitted_date' => now()->toDateString(),
        ];

        $response = $this->actingAs($user)->postJson('/api/repairs', $payload);

        $response->assertStatus(201);
        $this->assertDatabaseHas('repair_requests', [
            'customer_name' => 'JOHN REPAIR',
            'device_model' => 'IPHONE 13',
            'status' => 'pending',
        ]);
    }
}
