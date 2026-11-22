<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use App\Models\Shop;
use App\Models\User;
use App\Models\Customer;
use App\Models\Entity;
use App\Models\Product;
use App\Models\Inventory;
use App\Models\Ledger;
use App\Models\SaleInvoice;

/** Changing a sale's customer must move it to the new customer's ledger (not leave it on the old one). */
class SaleCustomerChangeLedgerTest extends TestCase
{
    use RefreshDatabase;

    public function test_changing_sale_customer_moves_it_to_the_new_customers_ledger()
    {
        $shop = Shop::create(['name' => 'Test Shop', 'address' => 'x', 'phone' => '1234567890']);
        $user = User::factory()->create(['shop_id' => $shop->id, 'is_owner' => true]);
        $wrong = Customer::create(['name' => 'LILESH TEST', 'phone' => '8959572356']);
        $right = Customer::create(['name' => 'SIDDHI TEST', 'phone' => '7089606109']);
        $wrongEntity = Entity::where('relation_type', Customer::class)->where('relation_id', $wrong->id)->firstOrFail();
        $rightEntity = Entity::where('relation_type', Customer::class)->where('relation_id', $right->id)->firstOrFail();

        $cat = \App\Models\Category::create(['name' => 'Accessories', 'slug' => 'accessories']);
        $product = Product::create(['name' => 'Test Item', 'sku' => 'T-1', 'selling_price' => 55000, 'purchase_price' => 50000, 'category_id' => $cat->id]);
        Inventory::create(['shop_id' => $shop->id, 'product_id' => $product->id, 'stock' => 5]);

        $id = $this->actingAs($user)->postJson('/api/sale-invoices', [
            'sale_date' => now()->toDateString(), 'shop_id' => $shop->id,
            'customer_id' => $wrong->id, 'customer_name' => $wrong->name,
            'payment_method' => 'cash', 'bill_type' => 'kaccha', 'calculate_gst' => false,
            'items' => [['product_id' => $product->id, 'quantity' => 1, 'unit_price' => 55000, 'subtotal' => 55000]],
            'subtotal' => 55000, 'discount' => 0, 'total' => 55000, 'total_paid' => 0,
        ])->assertStatus(201)->json('id');

        $this->assertEquals($wrongEntity->id, SaleInvoice::find($id)->accounting_entity_id);

        // Fix the customer on the bill.
        SaleInvoice::find($id)->update(['customer_id' => $right->id]);

        $sale = SaleInvoice::find($id);
        $this->assertEquals($rightEntity->id, $sale->accounting_entity_id);
        $this->assertTrue(Ledger::where('voucher_type', 'SALE')->where('voucher_id', $id)->where('entity_id', $rightEntity->id)->exists(), 'sale should be on the new customer ledger');
        $this->assertFalse(Ledger::where('voucher_type', 'SALE')->where('voucher_id', $id)->where('entity_id', $wrongEntity->id)->exists(), 'sale must be gone from the old customer ledger');
    }
}
