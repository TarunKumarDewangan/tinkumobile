<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use App\Models\User;
use App\Models\Shop;
use App\Models\Product;
use App\Models\Entity;
use App\Models\Inventory;

class SaleInvoiceControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_can_create_sale_invoice_with_valid_data()
    {
        $shop = Shop::create(['name' => 'Test Shop', 'address' => '123 Test St', 'phone' => '1234567890']);
        $user = User::factory()->create(['shop_id' => $shop->id]);
        $customer = \App\Models\Customer::create(['shop_id' => $shop->id, 'name' => 'Test Customer', 'phone' => '1234567890']);
        
        $category = \App\Models\Category::create(['name' => 'Smartphones', 'slug' => 'smartphones']);
        $product = Product::create([
            'shop_id' => $shop->id,
            'name' => 'Test Product',
            'sku' => 'TEST-SKU-123',
            'selling_price' => 1000,
            'purchase_price' => 800,
            'category_id' => $category->id
        ]);
        Inventory::create(['shop_id' => $shop->id, 'product_id' => $product->id, 'quantity' => 10, 'current_stock' => 10, 'selling_price' => 1000]);

        $payload = [
            'sale_date' => now()->toDateString(),
            'customer_id' => $customer->id,
            'customer_name' => $customer->name,
            'payment_method' => 'cash',
            'bill_type' => 'kaccha',
            'calculate_gst' => false,
            'items' => [
                [
                    'product_id' => $product->id,
                    'quantity' => 1,
                    'unit_price' => 1000,
                    'subtotal' => 1000,
                ]
            ],
            'subtotal' => 1000,
            'discount' => 0,
            'total' => 1000,
            'total_paid' => 1000,
        ];

        $response = $this->actingAs($user)->postJson('/api/sale-invoices', $payload);

        if ($response->status() !== 201) {
            dump($response->json());
        }
        $response->assertStatus(201);
        
        $this->assertDatabaseHas('sale_invoices', [
            'total_amount' => 1000,
            'customer_id' => $customer->id,
        ]);
    }
}
