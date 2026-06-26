<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use App\Services\TransactionService;
use App\Models\Transaction;
use App\Models\Shop;
use App\Models\User;
use App\Models\Entity;

class TransactionServiceTest extends TestCase
{
    use RefreshDatabase;

    protected $transactionService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->transactionService = new TransactionService();
    }

    public function test_can_record_settlement()
    {
        $shop = Shop::create(['name' => 'Test Shop', 'address' => '123 Test St', 'phone' => '1234567890']);
        $user = User::factory()->create(['shop_id' => $shop->id]);
        $entity = Entity::create(['shop_id' => $shop->id, 'type' => 'CUSTOMER', 'name' => 'Test Customer']);

        $data = [
            'shop_id' => $shop->id,
            'user_id' => $user->id,
            'type' => 'IN',
            'category' => 'ENTITY_SETTLEMENT',
            'amount' => 500,
            'payment_mode' => 'CASH',
            'description' => 'Test Settlement',
            'entity_name' => $entity->name,
            'accounting_entity_id' => $entity->id,
        ];

        $transaction = $this->transactionService->recordSettlement($data);

        $this->assertInstanceOf(Transaction::class, $transaction);
        $this->assertDatabaseHas('transactions', [
            'amount' => 500,
            'type' => 'IN',
            'payment_mode' => 'CASH',
            'accounting_entity_id' => $entity->id,
        ]);
    }
}
