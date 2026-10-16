<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use App\Models\User;
use App\Models\Shop;
use App\Models\Product;
use App\Models\Inventory;
use App\Models\Customer;
use App\Models\Supplier;
use App\Models\Category;
use App\Models\PurchaseInvoice;
use App\Models\PurchaseItem;

/**
 * A new mobile that was sold and then bought back (a dealer/customer return
 * recorded as a fresh purchase) is in stock again and must be sellable.
 * Selling the same physical unit twice without a buy-back must still fail.
 */
class ImeiBuybackSaleTest extends TestCase
{
    use RefreshDatabase;

    private const IMEI = '866010086038603';

    private Shop $shop;
    private User $user;
    private Product $product;
    private Supplier $supplier;
    private int $purchaseSeq = 0;

    protected function setUp(): void
    {
        parent::setUp();
        $this->shop = Shop::create(['name' => 'Test Shop', 'address' => 'x', 'phone' => '1234567890']);
        // Staff user (not owner) so the IMEI rules are fully enforced.
        $this->user = User::factory()->create(['shop_id' => $this->shop->id]);
        $cat = Category::create(['name' => 'Mobile New', 'slug' => 'mobile-new']);
        $this->product = Product::create([
            'name' => 'VIVO T4X', 'sku' => 'T4X-1', 'selling_price' => 27000,
            'purchase_price' => 25000, 'category_id' => $cat->id,
        ]);
        Inventory::create(['shop_id' => $this->shop->id, 'product_id' => $this->product->id, 'stock' => 5]);
        $this->supplier = Supplier::create(['name' => 'Supplier', 'phone' => '0987654321', 'address' => 'x']);
    }

    private function buy(): void
    {
        $inv = PurchaseInvoice::create([
            'invoice_no' => 'PUR-T-' . (++$this->purchaseSeq), 'shop_id' => $this->shop->id,
            'supplier_id' => $this->supplier->id, 'user_id' => $this->user->id,
            'purchase_date' => now()->toDateString(), 'total_amount' => 25000, 'grand_total' => 25000,
            'status' => 'received',
        ]);
        PurchaseItem::create([
            'purchase_invoice_id' => $inv->id, 'product_id' => $this->product->id, 'imei' => self::IMEI,
            'quantity' => 1, 'received_quantity' => 1, 'unit_price' => 25000, 'total' => 25000,
        ]);
    }

    private function sell(string $customerName)
    {
        $customer = Customer::create(['name' => $customerName, 'phone' => (string) random_int(7000000000, 7999999999)]);
        return $this->actingAs($this->user)->postJson('/api/sale-invoices', [
            'sale_date' => now()->toDateString(), 'shop_id' => $this->shop->id,
            'customer_id' => $customer->id, 'customer_name' => $customer->name,
            'payment_method' => 'cash', 'bill_type' => 'kaccha', 'calculate_gst' => false,
            'items' => [[
                'product_id' => $this->product->id, 'imei' => self::IMEI,
                'quantity' => 1, 'unit_price' => 27000, 'subtotal' => 27000,
            ]],
            'subtotal' => 27000, 'discount' => 0, 'total' => 27000, 'total_paid' => 27000,
        ]);
    }

    public function test_same_imei_cannot_be_sold_twice_without_a_buyback()
    {
        $this->buy();
        $this->sell('FIRST BUYER')->assertStatus(201);
        $this->sell('SECOND BUYER')->assertStatus(422)->assertJsonFragment(['message' => 'IMEI ' . self::IMEI . ' has already been sold on invoice #' . \App\Models\SaleInvoice::first()->invoice_no . '.']);
    }

    public function test_bought_back_phone_can_be_sold_again_once()
    {
        $this->buy();
        $this->sell('VIKASH MOBILE')->assertStatus(201);

        $this->buy(); // Vikash returns it — recorded as a purchase from him
        $this->sell('NEXT CUSTOMER')->assertStatus(201);

        // Bought twice, sold twice → a third sale is blocked again.
        $this->sell('THIRD CUSTOMER')->assertStatus(422);
    }
}
