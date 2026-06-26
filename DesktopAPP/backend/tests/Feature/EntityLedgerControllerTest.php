<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use App\Models\User;
use App\Models\Shop;
use App\Models\Entity;
use App\Models\Transaction;

class EntityLedgerControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_can_fetch_entity_ledger_summary()
    {
        $shop = Shop::create(['name' => 'Test Shop', 'address' => '123 Test St', 'phone' => '1234567890']);
        $user = User::factory()->create(['shop_id' => $shop->id]);
        
        $entity1 = Entity::create(['shop_id' => $shop->id, 'type' => 'CUSTOMER', 'name' => 'Test Customer 1', 'opening_balance' => 0]);
        
        // Add a transaction
        Transaction::create([
            'shop_id' => $shop->id,
            'user_id' => $user->id,
            'transaction_date' => now()->toDateString(),
            'amount' => 500,
            'type' => 'IN',
            'payment_mode' => 'CASH',
            'category' => 'SALE_INCOME',
            'accounting_entity_id' => $entity1->id,
            'entity_name' => $entity1->name,
            'entity_type' => Entity::class,
            'entity_id' => $entity1->id,
        ]);

        $response = $this->actingAs($user)->getJson('/api/entities/summary');

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'overallTotal',
            'receivable',
            'payable'
        ]);
    }
}
