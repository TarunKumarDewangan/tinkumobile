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
        Inventory::create(['shop_id' => $shop->id, 'product_id' => $product->id, 'stock' => 10]);

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

    public function test_can_filter_sale_invoices_by_old_mobile_status()
    {
        $shop = Shop::create(['name' => 'Test Shop', 'address' => '123 Test St', 'phone' => '1234567890']);
        $user = User::factory()->create(['shop_id' => $shop->id]);
        $customer = \App\Models\Customer::create(['shop_id' => $shop->id, 'name' => 'Test Customer', 'phone' => '1234567890']);
        
        $newCategory = \App\Models\Category::create(['name' => 'Mobile New', 'slug' => 'mobile-new']);
        $oldCategory = \App\Models\Category::create(['name' => 'Mobile Old', 'slug' => 'mobile-old']);
        
        $newProduct = Product::create([
            'shop_id' => $shop->id, 'name' => 'New Phone', 'sku' => 'NEW-1', 'selling_price' => 1000, 'purchase_price' => 800, 'category_id' => $newCategory->id
        ]);
        $oldProduct = Product::create([
            'shop_id' => $shop->id, 'name' => 'Old Phone', 'sku' => 'OLD-1', 'selling_price' => 500, 'purchase_price' => 400, 'category_id' => $oldCategory->id
        ]);
        
        Inventory::create(['shop_id' => $shop->id, 'product_id' => $newProduct->id, 'stock' => 10]);
        Inventory::create(['shop_id' => $shop->id, 'product_id' => $oldProduct->id, 'stock' => 10]);

        // The sale below claims IMEI 123456789012345 for $newProduct — the sale
        // creation guard now verifies that IMEI was actually purchased under
        // this exact product, so a matching PurchaseItem is required here.
        $supplier = \App\Models\Supplier::create(['name' => 'Test Supplier', 'phone' => '0987654321', 'address' => 'Test Address']);
        $purchaseInvoice = \App\Models\PurchaseInvoice::create([
            'invoice_no' => 'PUR-TEST-IMEI-1',
            'shop_id' => $shop->id,
            'supplier_id' => $supplier->id,
            'user_id' => $user->id,
            'purchase_date' => now(),
            'total_amount' => 800,
            'grand_total' => 800,
            'status' => 'ordered',
        ]);
        \App\Models\PurchaseItem::create([
            'purchase_invoice_id' => $purchaseInvoice->id,
            'product_id' => $newProduct->id,
            'imei' => '123456789012345',
            'quantity' => 1,
            'unit_price' => 800,
            'total' => 800,
        ]);

        // Create new mobile sale
        $payloadNew = [
            'sale_date' => now()->toDateString(),
            'customer_id' => $customer->id,
            'payment_method' => 'cash',
            'bill_type' => 'kaccha',
            'calculate_gst' => false,
            'items' => [['product_id' => $newProduct->id, 'quantity' => 1, 'unit_price' => 1000, 'imei' => '123456789012345']]
        ];
        $this->actingAs($user)->postJson('/api/sale-invoices', $payloadNew)->assertStatus(201);

        // Create old mobile sale
        $payloadOld = [
            'sale_date' => now()->toDateString(),
            'customer_id' => $customer->id,
            'payment_method' => 'cash',
            'bill_type' => 'kaccha',
            'calculate_gst' => false,
            'items' => [['product_id' => $oldProduct->id, 'quantity' => 1, 'unit_price' => 500]]
        ];
        $this->actingAs($user)->postJson('/api/sale-invoices', $payloadOld)->assertStatus(201);

        // Request with is_old_mobile = true
        $responseTrue = $this->actingAs($user)->getJson('/api/sale-invoices?is_old_mobile=true');
        $responseTrue->assertStatus(200);
        $dataTrue = $responseTrue->json('data');
        $this->assertCount(1, $dataTrue);
        $this->assertEquals('OLD PHONE', $dataTrue[0]['items'][0]['product']['name']);

        // Request with is_old_mobile = false
        $responseFalse = $this->actingAs($user)->getJson('/api/sale-invoices?is_old_mobile=false');
        $responseFalse->assertStatus(200);
        $dataFalse = $responseFalse->json('data');
        $this->assertCount(1, $dataFalse);
        $this->assertEquals('NEW PHONE', $dataFalse[0]['items'][0]['product']['name']);
    }

    public function test_can_convert_old_mobile_sale_to_new_mobile_sale()
    {
        $shop = Shop::create(['name' => 'Test Shop', 'address' => '123 Test St', 'phone' => '1234567890']);
        $user = User::factory()->create(['shop_id' => $shop->id]);
        $customer = \App\Models\Customer::create(['shop_id' => $shop->id, 'name' => 'Test Customer', 'phone' => '1234567890']);
        
        $newCategory = \App\Models\Category::create(['name' => 'Mobile New', 'slug' => 'mobile-new']);
        $oldCategory = \App\Models\Category::create(['name' => 'Mobile Old', 'slug' => 'mobile-old']);
        
        $oldProduct = Product::create([
            'shop_id' => $shop->id,
            'name' => 'Old Phone to Convert',
            'sku' => 'OLD-2',
            'selling_price' => 500,
            'purchase_price' => 400,
            'category_id' => $oldCategory->id
        ]);
        
        Inventory::create(['shop_id' => $shop->id, 'product_id' => $oldProduct->id, 'stock' => 10]);

        $payload = [
            'sale_date' => now()->toDateString(),
            'customer_id' => $customer->id,
            'payment_method' => 'cash',
            'bill_type' => 'kaccha',
            'calculate_gst' => false,
            'items' => [['product_id' => $oldProduct->id, 'quantity' => 1, 'unit_price' => 500]]
        ];

        $invoiceResponse = $this->actingAs($user)->postJson('/api/sale-invoices', $payload);
        $invoiceResponse->assertStatus(201);
        $invoiceId = $invoiceResponse->json('id');

        // Verify it is initially returned in is_old_mobile=true
        $responseTrue = $this->actingAs($user)->getJson('/api/sale-invoices?is_old_mobile=true');
        $responseTrue->assertStatus(200);
        $this->assertCount(1, $responseTrue->json('data'));

        // Call the conversion endpoint
        $convertResponse = $this->actingAs($user)->postJson("/api/sale-invoices/{$invoiceId}/convert-to-new-sale");
        $convertResponse->assertStatus(200);

        // Verify the product category was changed
        $oldProduct->refresh();
        $this->assertEquals($newCategory->id, $oldProduct->category_id);
        $this->assertEquals('NEW', $oldProduct->condition);

        // Verify employee incentive was created
        $this->assertDatabaseHas('employee_incentives', [
            'product_id' => $oldProduct->id,
            'incentive_amount' => 5.00, // 500 * 0.01 = 5
        ]);

        // Verify it is now returned in is_old_mobile=false instead
        $responseTrueAfter = $this->actingAs($user)->getJson('/api/sale-invoices?is_old_mobile=true');
        $this->assertCount(0, $responseTrueAfter->json('data'));

        $responseFalseAfter = $this->actingAs($user)->getJson('/api/sale-invoices?is_old_mobile=false');
        $this->assertCount(1, $responseFalseAfter->json('data'));
    }
}
