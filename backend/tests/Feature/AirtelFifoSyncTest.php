<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use App\Models\Retailer;
use App\Models\AirtelDrop;
use App\Models\AirtelRecovery;
use App\Models\User;
use App\Models\Shop;
use App\Services\AirtelSyncService;

class AirtelFifoSyncTest extends TestCase
{
    use RefreshDatabase;

    public function test_fifo_sync_allocates_payments_correctly_including_opening_balance()
    {
        // 1. Create a user (needed for recovery creation)
        $user = User::factory()->create();

        // 2. Create a shop
        $shop = Shop::create(['name' => 'Test Shop', 'address' => '123 Test St', 'phone' => '1234567890']);

        // 3. Create a Retailer with opening balance of 1000
        $retailer = Retailer::create([
            'name' => 'Test Retailer',
            'msisdn' => '1234567890',
            'address' => 'Test address',
            'shop_id' => $shop->id,
            'balance' => 1000.00
        ]);

        // 3. Create drops
        // Drop 1: 5000 refilled on May 1
        $drop1 = AirtelDrop::create([
            'retailer_id' => $retailer->id,
            'amount' => 5000.00,
            'refill_date' => '2026-05-01 10:00:00',
            'status' => 'pending'
        ]);

        // Drop 2: 3000 refilled on May 2
        $drop2 = AirtelDrop::create([
            'retailer_id' => $retailer->id,
            'amount' => 3000.00,
            'refill_date' => '2026-05-02 10:00:00',
            'status' => 'pending'
        ]);

        // 4. Create recoveries (payments)
        // Recovery 1: 3000 on May 3 (should cover 1000 opening balance, and 2000 of Drop 1)
        AirtelRecovery::create([
            'retailer_id' => $retailer->id,
            'amount' => 3000.00,
            'recovered_at' => '2026-05-03 12:00:00',
            'recovery_user_id' => $user->id
        ]);

        // Recovery 2: 4000 on May 4 (should cover the remaining 3000 of Drop 1, and 1000 of Drop 2)
        AirtelRecovery::create([
            'retailer_id' => $retailer->id,
            'amount' => 4000.00,
            'recovered_at' => '2026-05-04 12:00:00',
            'recovery_user_id' => $user->id
        ]);

        // 5. Run sync manually
        app(AirtelSyncService::class)->syncRetailer($retailer->id);

        // 6. Assertions
        $d1 = AirtelDrop::find($drop1->id);
        $d2 = AirtelDrop::find($drop2->id);

        // Drop 1 should be fully paid (paid_amount = 5000, status = recovered)
        $this->assertEquals(5000.00, (float)$d1->paid_amount);
        $this->assertEquals('recovered', $d1->status);
        $this->assertEquals('2026-05-04 12:00:00', $d1->recovered_at->toDateTimeString());

        // Drop 2 should be partially paid (paid_amount = 1000, status = pending)
        $this->assertEquals(1000.00, (float)$d2->paid_amount);
        $this->assertEquals('pending', $d2->status);
        $this->assertNull($d2->recovered_at);
    }
}
