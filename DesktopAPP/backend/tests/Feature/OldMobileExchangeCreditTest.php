<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;
use App\Models\User;
use App\Models\Shop;
use App\Models\Customer;
use App\Models\Entity;
use App\Models\Transaction;
use App\Models\OldMobilePurchase;

/**
 * Covers the 2026-10-01 fix: "Adjust against existing balance" exchange
 * credit on an old-mobile purchase was silently cancelling itself back out
 * instead of reducing what the customer owed (recordPurchaseTransactions()
 * unconditionally posted a settlement leg that only Reserve mode should
 * post). Also covers the audit page that surfaces purchases the bug hit
 * before the fix, and its resolve action.
 */
class OldMobileExchangeCreditTest extends TestCase
{
    use RefreshDatabase;

    private function makeShopUserCustomer(): array
    {
        $shop = Shop::create(['name' => 'Test Shop', 'address' => '123 Test St', 'phone' => '1234567890']);
        $user = User::factory()->create(['shop_id' => $shop->id, 'is_owner' => true]);
        $customer = Customer::create(['shop_id' => $shop->id, 'name' => 'Pratik Kumar', 'phone' => '9999900000']);
        \App\Models\Category::create(['name' => 'Mobile Old', 'slug' => 'mobile-old']); // OldMobileController::store() needs this for Category::mobileOldId()
        return [$shop, $user, $customer];
    }

    /** Give the customer an existing ₹15,000 debt, the same way a real sale would. */
    private function giveExistingDebt(Shop $shop, User $user, Customer $customer, float $amount): Entity
    {
        // Customer::create() already auto-syncs its own Entity (SyncsWithMasterEntity) —
        // reuse that one rather than creating a colliding duplicate.
        $entity = Entity::where('relation_type', Customer::class)->where('relation_id', $customer->id)->firstOrFail();

        Transaction::create([
            'shop_id' => $shop->id, 'user_id' => $user->id, 'transaction_date' => now()->toDateString(),
            'amount' => $amount, 'type' => 'OUT', 'payment_mode' => 'CASH', 'category' => 'SALE',
            'accounting_entity_id' => $entity->id, 'entity_name' => $entity->name,
        ]);

        return $entity->fresh();
    }

    private function netBalance(int $entityId): float
    {
        return (float) \DB::table('entity_balances')->where('entity_id', $entityId)->value('net_balance');
    }

    public function test_adjust_mode_exchange_credit_reduces_what_customer_owes()
    {
        [$shop, $user, $customer] = $this->makeShopUserCustomer();
        $entity = $this->giveExistingDebt($shop, $user, $customer, 15000);
        $this->assertEquals(15000, $this->netBalance($entity->id));

        $response = $this->actingAs($user)->postJson('/api/old-mobiles', [
            'customer_id'    => $customer->id,
            'model_name'     => 'Vivo X200',
            'purchase_price' => 10000,
            'purchase_date'  => now()->toDateString(),
            'is_exchange'    => true,
            'exchange_credit_mode' => 'adjust',
            'shop_id'        => $shop->id,
        ]);
        $response->assertStatus(201);
        $purchaseId = $response->json('id');

        // The credit must actually bring the balance down — not cancel itself out.
        $this->assertEquals(5000, $this->netBalance($entity->id));

        // Adjust mode must never touch the wallet or post a settlement leg.
        $this->assertEquals(0, (float) $customer->fresh()->exchange_credit_balance);
        $this->assertDatabaseMissing('transactions', [
            'entity_type' => OldMobilePurchase::class,
            'entity_id'   => $purchaseId,
            'category'    => 'OLD_MOBILE_EXCHANGE',
        ]);
    }

    public function test_reserve_mode_exchange_credit_leaves_balance_untouched_and_credits_wallet()
    {
        [$shop, $user, $customer] = $this->makeShopUserCustomer();
        $entity = $this->giveExistingDebt($shop, $user, $customer, 15000);

        $response = $this->actingAs($user)->postJson('/api/old-mobiles', [
            'customer_id'    => $customer->id,
            'model_name'     => 'Vivo X200',
            'purchase_price' => 8000,
            'purchase_date'  => now()->toDateString(),
            'is_exchange'    => true,
            'exchange_credit_mode' => 'reserve',
            'shop_id'        => $shop->id,
        ]);
        $response->assertStatus(201);
        $purchaseId = $response->json('id');

        // "Doesn't touch their current balance" — must still be exactly 15000.
        $this->assertEquals(15000, $this->netBalance($entity->id));
        $this->assertEquals(8000, (float) $customer->fresh()->exchange_credit_balance);
        $this->assertDatabaseHas('transactions', [
            'entity_type' => OldMobilePurchase::class,
            'entity_id'   => $purchaseId,
            'category'    => 'OLD_MOBILE_EXCHANGE',
        ]);
    }

    public function test_non_owner_cannot_see_exchange_credit_issues()
    {
        $shop = Shop::create(['name' => 'Test Shop', 'address' => '123 Test St', 'phone' => '1234567890']);
        $staff = User::factory()->create(['shop_id' => $shop->id, 'is_owner' => false]);

        $this->actingAs($staff)->getJson('/api/old-mobiles/exchange-credit-issues')->assertStatus(403);
    }

    public function test_exchange_credit_issues_lists_legacy_broken_purchase_and_resolve_credits_ledger()
    {
        [$shop, $user, $customer] = $this->makeShopUserCustomer();
        $entity = $this->giveExistingDebt($shop, $user, $customer, 15000);

        // Simulate exactly what the pre-fix buggy code produced: an Adjust-mode
        // purchase whose payable was immediately cancelled by a settlement leg.
        $purchase = OldMobilePurchase::create([
            'shop_id' => $shop->id, 'user_id' => $user->id, 'customer_id' => $customer->id,
            'model_name' => 'Vivo X200', 'imei' => '866961078029671',
            'purchase_price' => 35000, 'is_exchange' => true, 'exchange_credit_mode' => 'adjust',
            'exchange_credit_amount' => null, 'pay_later' => false, 'purchase_date' => now()->toDateString(),
        ]);
        Transaction::create([
            'shop_id' => $shop->id, 'user_id' => $user->id, 'transaction_date' => $purchase->purchase_date,
            'amount' => 35000, 'type' => 'IN', 'payment_mode' => 'PAYABLE', 'category' => 'OLD_MOBILE_PURCHASE',
            'accounting_entity_id' => $entity->id, 'entity_name' => $entity->name,
            'entity_type' => OldMobilePurchase::class, 'entity_id' => $purchase->id,
        ]);
        Transaction::create([
            'shop_id' => $shop->id, 'user_id' => $user->id, 'transaction_date' => $purchase->purchase_date,
            'amount' => 35000, 'type' => 'OUT', 'payment_mode' => 'EXCHANGE', 'category' => 'OLD_MOBILE_EXCHANGE',
            'accounting_entity_id' => $entity->id, 'entity_name' => $entity->name,
            'entity_type' => OldMobilePurchase::class, 'entity_id' => $purchase->id,
        ]);
        $this->assertEquals(15000, $this->netBalance($entity->id)); // unchanged, as the bug caused

        // Shows up in the audit list.
        $list = $this->actingAs($user)->getJson('/api/old-mobiles/exchange-credit-issues');
        $list->assertStatus(200);
        $list->assertJsonFragment(['id' => $purchase->id, 'customer_name' => $customer->fresh()->name]);
        $row = collect($list->json())->firstWhere('id', $purchase->id);
        $this->assertEquals(35000, $row['credit_amount']);
        $this->assertEquals(15000, $row['current_balance']);

        // Resolving it with credit_ledger actually posts the missing credit.
        Cache::put('pin_token:test-token', $user->id, 60);
        $resolve = $this->actingAs($user)
            ->withHeaders(['X-Pin-Token' => 'test-token'])
            ->postJson("/api/old-mobiles/{$purchase->id}/resolve-exchange-issue", [
                'action' => 'credit_ledger',
                'note'   => 'Verified with customer by phone',
            ]);
        $resolve->assertStatus(200);
        $this->assertEquals(-20000, $this->netBalance($entity->id)); // 15000 - 35000

        $purchase->refresh();
        $this->assertNotNull($purchase->exchange_issue_resolved_at);
        $this->assertEquals('credit_ledger', $purchase->exchange_issue_resolution);

        // Resolved rows drop off the list.
        $listAfter = $this->actingAs($user)->getJson('/api/old-mobiles/exchange-credit-issues');
        $this->assertCount(0, $listAfter->json());

        // Can't be resolved twice.
        Cache::put('pin_token:test-token-2', $user->id, 60);
        $this->actingAs($user)
            ->withHeaders(['X-Pin-Token' => 'test-token-2'])
            ->postJson("/api/old-mobiles/{$purchase->id}/resolve-exchange-issue", ['action' => 'ignore'])
            ->assertStatus(422);
    }

    public function test_resolve_move_to_wallet_credits_wallet_without_touching_ledger()
    {
        [$shop, $user, $customer] = $this->makeShopUserCustomer();
        $entity = $this->giveExistingDebt($shop, $user, $customer, 15000);

        $purchase = OldMobilePurchase::create([
            'shop_id' => $shop->id, 'user_id' => $user->id, 'customer_id' => $customer->id,
            'model_name' => 'Redmi Note 10', 'purchase_price' => 5000, 'is_exchange' => true,
            'exchange_credit_mode' => 'adjust', 'pay_later' => false, 'purchase_date' => now()->toDateString(),
        ]);
        Transaction::create([
            'shop_id' => $shop->id, 'user_id' => $user->id, 'transaction_date' => $purchase->purchase_date,
            'amount' => 5000, 'type' => 'IN', 'payment_mode' => 'PAYABLE', 'category' => 'OLD_MOBILE_PURCHASE',
            'accounting_entity_id' => $entity->id, 'entity_name' => $entity->name,
            'entity_type' => OldMobilePurchase::class, 'entity_id' => $purchase->id,
        ]);
        Transaction::create([
            'shop_id' => $shop->id, 'user_id' => $user->id, 'transaction_date' => $purchase->purchase_date,
            'amount' => 5000, 'type' => 'OUT', 'payment_mode' => 'EXCHANGE', 'category' => 'OLD_MOBILE_EXCHANGE',
            'accounting_entity_id' => $entity->id, 'entity_name' => $entity->name,
            'entity_type' => OldMobilePurchase::class, 'entity_id' => $purchase->id,
        ]);

        Cache::put('pin_token:wallet-token', $user->id, 60);
        $resolve = $this->actingAs($user)
            ->withHeaders(['X-Pin-Token' => 'wallet-token'])
            ->postJson("/api/old-mobiles/{$purchase->id}/resolve-exchange-issue", ['action' => 'move_to_wallet']);
        $resolve->assertStatus(200);

        $this->assertEquals(15000, $this->netBalance($entity->id)); // unchanged
        $this->assertEquals(5000, (float) $customer->fresh()->exchange_credit_balance);
        $this->assertEquals('reserve', $purchase->fresh()->exchange_credit_mode);
    }

    private function liveNet(Customer $customer): float
    {
        return (float) $this->getJson("/api/entities/customer-ledger?customer_id={$customer->id}")->json('entity.net_balance');
    }

    private function postPurchase(User $user, Shop $shop, Customer $customer, array $extra)
    {
        return $this->actingAs($user)->postJson('/api/old-mobiles', array_merge([
            'customer_id' => $customer->id, 'model_name' => 'Test Phone', 'purchase_date' => now()->toDateString(),
            'shop_id' => $shop->id,
        ], $extra));
    }

    public function test_customer_ledger_does_not_double_count_cash_or_pay_later_old_mobile_purchases()
    {
        [$shop, $user, $customer] = $this->makeShopUserCustomer();
        $this->giveExistingDebt($shop, $user, $customer, 20000);
        $this->actingAs($user);
        $this->assertEquals(20000, $this->liveNet($customer));

        // Pay Later 3000: shop now owes them 3000 → they owe 17000.
        $this->postPurchase($user, $shop, $customer, ['purchase_price' => 3000, 'is_exchange' => false, 'pay_later' => true])->assertStatus(201);
        $this->assertEquals(17000, $this->liveNet($customer));

        // Cash 4000 paid out now: no change to what they owe.
        $this->postPurchase($user, $shop, $customer, ['purchase_price' => 4000, 'is_exchange' => false, 'payment_mode' => 'CASH'])->assertStatus(201);
        $this->assertEquals(17000, $this->liveNet($customer));
    }

    public function test_show_returns_payout_lines_and_edit_keeps_the_original_payment_mode()
    {
        [$shop, $user, $customer] = $this->makeShopUserCustomer();
        $id = $this->postPurchase($user, $shop, $customer, [
            'purchase_price' => 6000, 'is_exchange' => false,
            'payment_mode' => 'SPLIT',
            'payment_lines' => [['payment_mode' => 'CASH', 'amount' => 4000], ['payment_mode' => 'PHONEPE', 'amount' => 2000]],
        ])->assertStatus(201)->json('id');

        $lines = $this->actingAs($user)->getJson("/api/old-mobiles/{$id}")->json('payout_payment_lines');
        $this->assertEquals([['payment_mode' => 'CASH', 'amount' => 4000], ['payment_mode' => 'PHONEPE', 'amount' => 2000]], $lines);

        // Edit something unrelated, sending back the same split — it must survive.
        $this->actingAs($user)->putJson("/api/old-mobiles/{$id}", [
            'customer_id' => $customer->id, 'model_name' => 'Test Phone RENAMED', 'purchase_price' => 6000,
            'purchase_date' => now()->toDateString(), 'is_exchange' => false, 'pay_later' => false,
            'payment_mode' => 'SPLIT', 'payment_lines' => $lines,
        ])->assertStatus(200);

        $after = $this->actingAs($user)->getJson("/api/old-mobiles/{$id}")->json('payout_payment_lines');
        $this->assertEquals($lines, $after);
    }

    public function test_edit_keeps_reserve_mode_and_blocks_pulling_back_spent_credit()
    {
        [$shop, $user, $customer] = $this->makeShopUserCustomer();
        $id = $this->postPurchase($user, $shop, $customer, [
            'purchase_price' => 8000, 'is_exchange' => true, 'exchange_credit_mode' => 'reserve',
        ])->assertStatus(201)->json('id');
        $this->assertEquals(8000, (float) $customer->fresh()->exchange_credit_balance);

        $edit = fn (array $extra) => $this->actingAs($user)->putJson("/api/old-mobiles/{$id}", array_merge([
            'customer_id' => $customer->id, 'model_name' => 'Test Phone', 'purchase_price' => 8000,
            'purchase_date' => now()->toDateString(), 'is_exchange' => true, 'pay_later' => false,
        ], $extra));

        // Editing with Reserve kept → wallet stays 8000 (no silent flip to Adjust).
        $edit(['exchange_credit_mode' => 'reserve', 'condition_note' => 'scratch'])->assertStatus(200);
        $this->assertEquals('reserve', OldMobilePurchase::find($id)->exchange_credit_mode);
        $this->assertEquals(8000, (float) $customer->fresh()->exchange_credit_balance);

        // Simulate 5000 of it spent on a sale, then try to switch to Adjust → blocked.
        $customer->update(['exchange_credit_balance' => 3000]);
        $edit(['exchange_credit_mode' => 'adjust'])->assertStatus(422);
        $this->assertEquals(3000, (float) $customer->fresh()->exchange_credit_balance);
        $this->assertEquals('reserve', OldMobilePurchase::find($id)->exchange_credit_mode);
    }
}
