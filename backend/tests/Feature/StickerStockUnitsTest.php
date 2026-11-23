<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use App\Models\User;
use App\Models\Shop;
use App\Models\Product;
use App\Models\Customer;
use App\Models\Supplier;
use App\Models\Category;
use App\Models\PurchaseInvoice;
use App\Models\PurchaseItem;
use App\Models\SaleInvoice;
use App\Models\SaleItem;

/**
 * Generate Stickers lists new mobiles as the phones in stock, one row per IMEI,
 * with that phone's own purchase/selling price (IMEIs live on purchase lines, not the product).
 */
class StickerStockUnitsTest extends TestCase
{
    use RefreshDatabase;

    private Shop $shop;
    private User $owner;
    private Product $phone;
    private Product $charger;
    private Supplier $supplier;
    private int $seq = 0;

    protected function setUp(): void
    {
        parent::setUp();
        $this->shop = Shop::create(['name' => 'Test Shop', 'address' => 'x', 'phone' => '1234567890']);
        $this->owner = User::factory()->create(['shop_id' => $this->shop->id, 'is_owner' => true]);
        $cat = Category::create(['name' => 'Mobile New', 'slug' => 'mobile-new']);
        $this->phone = Product::create([
            'name' => 'IPHONE 17', 'sku' => 'IP17', 'selling_price' => 99900,
            'purchase_price' => 80000, 'category_id' => $cat->id, 'condition' => 'new',
        ]);
        $this->charger = Product::create([
            'name' => 'CHARGER 20W', 'sku' => 'CH20', 'selling_price' => 1999,
            'purchase_price' => 900, 'category_id' => $cat->id, 'condition' => 'new',
        ]);
        $this->supplier = Supplier::create(['name' => 'Supplier', 'phone' => '0987654321', 'address' => 'x']);
    }

    private function buy(string $imei, float $price, string $color = 'BLACK', string $status = 'received'): void
    {
        $inv = PurchaseInvoice::create([
            'invoice_no' => 'PUR-S-' . (++$this->seq), 'shop_id' => $this->shop->id,
            'supplier_id' => $this->supplier->id, 'user_id' => $this->owner->id,
            'purchase_date' => now()->toDateString(), 'total_amount' => $price, 'grand_total' => $price,
            'status' => $status,
        ]);
        $n = count(explode(',', $imei));
        PurchaseItem::create([
            'purchase_invoice_id' => $inv->id, 'product_id' => $this->phone->id, 'imei' => $imei,
            'ram' => '8', 'storage' => '256', 'color' => $color,
            'quantity' => $n, 'received_quantity' => $n, 'unit_price' => $price, 'selling_price' => 96500,
            'total' => $price * $n,
        ]);
    }

    private function sell(string $imei): void
    {
        $customer = Customer::create(['name' => 'BUYER', 'phone' => (string) random_int(7000000000, 7999999999)]);
        $inv = SaleInvoice::create([
            'invoice_no' => 'S-' . (++$this->seq), 'shop_id' => $this->shop->id, 'customer_id' => $customer->id,
            'user_id' => $this->owner->id, 'sale_date' => now()->toDateString(),
            'total_amount' => 96500, 'grand_total' => 96500, 'total_paid' => 96500, 'payment_method' => 'cash', 'bill_type' => 'kaccha',
        ]);
        SaleItem::create([
            'sale_invoice_id' => $inv->id, 'product_id' => $this->phone->id, 'imei' => $imei,
            'quantity' => 1, 'unit_price' => 96500, 'total' => 96500,
        ]);
    }

    private function list(array $params = [])
    {
        return $this->actingAs($this->owner)->getJson('/api/products/sticker-list?' . http_build_query($params))
            ->assertOk()->json('data');
    }

    public function test_each_phone_in_stock_is_its_own_row_with_its_imei_and_price()
    {
        $this->buy('111111111111111,222222222222222', 80000);
        $this->buy('333333333333333', 82000);
        $this->buy('444444444444444', 81000, 'BLACK', 'pending'); // not received yet
        $this->sell('222222222222222');

        $rows = $this->list();
        $units = array_values(array_filter($rows, fn($r) => ($r['is_unit'] ?? false)));

        $this->assertSame(['111111111111111', '333333333333333'], array_column($units, 'imei'));
        $this->assertEquals([80000, 82000], array_map('floatval', array_column($units, 'purchase_price')));
        $this->assertSame('256', $units[0]['attributes']['storage']);
        $this->assertSame($this->phone->id, $units[0]['product_id']);

        // product without IMEI stock (accessory) is still listed as a normal product row
        $this->assertContains('CHARGER 20W', array_column(array_filter($rows, fn($r) => !($r['is_unit'] ?? false)), 'name'));
    }

    public function test_sold_then_bought_back_phone_is_in_stock_again()
    {
        $this->buy('555555555555555', 80000);
        $this->sell('555555555555555');
        $this->assertSame([], array_column(array_filter($this->list(), fn($r) => $r['is_unit'] ?? false), 'imei'));

        $this->buy('555555555555555', 70000); // bought back
        $units = array_values(array_filter($this->list(), fn($r) => $r['is_unit'] ?? false));
        $this->assertSame(['555555555555555'], array_column($units, 'imei'));
        $this->assertEquals(70000, (float) $units[0]['purchase_price']);
    }

    public function test_search_by_imei_finds_just_that_phone()
    {
        $this->buy('111111111111111,222222222222222', 80000);

        $rows = $this->list(['search' => '22222222']);
        $this->assertCount(1, $rows);
        $this->assertSame('222222222222222', $rows[0]['imei']);
    }

    public function test_grouped_view_groups_phones_by_config_with_their_units()
    {
        $this->buy('111111111111111,222222222222222', 80000, 'BLACK');
        $this->buy('333333333333333', 80000, 'BLUE');

        $rows = $this->list(['group_by_config' => 1]);
        $group = collect($rows)->firstWhere('is_group', true);
        $this->assertNotNull($group);
        $this->assertSame(2, $group['count']);
        $this->assertSame(['111111111111111', '222222222222222'], array_column($group['units'], 'imei'));

        // a config with a single phone is shown as that phone, not a group of one
        $single = collect($rows)->firstWhere('imei', '333333333333333');
        $this->assertTrue($single['is_unit']);
    }
}
