<?php

namespace Tests\Feature;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Entity;
use App\Models\Product;
use App\Models\Shop;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PurchaseInvoiceControllerTest extends TestCase
{
    use RefreshDatabase;

    private $shop;
    private $user;
    private $category;
    private $brand;
    private $product;

    protected function setUp(): void
    {
        parent::setUp();

        $this->shop = Shop::create(['name' => 'TEST SHOP', 'address' => 'TEST ADDRESS', 'phone' => '1234567890']);
        $this->user = User::factory()->create(['shop_id' => $this->shop->id, 'is_owner' => true]);
        $this->category = Category::create(['name' => 'MOBILE', 'slug' => 'mobile']);
        $this->brand = Brand::create(['name' => 'SAMSUNG']);
        $this->product = Product::create([
            'name' => 'GALAXY S23',
            'category_id' => $this->category->id,
            'brand_id' => $this->brand->id,
            'sku' => 'SAM-S23',
            'purchase_price' => 1000,
            'selling_price' => 1200
        ]);
    }

    public function test_can_create_purchase_with_standard_supplier()
    {
        $supplier = Supplier::create([
            'name' => 'VIJAY MARKETING',
            'phone' => '1234567890',
            'address' => 'VIJAY NAGAR'
        ]);

        $postData = [
            'shop_id' => $this->shop->id,
            'supplier_id' => $supplier->id,
            'purchase_date' => '2026-05-24',
            'status' => 'received',
            'bill_type' => 'kaccha',
            'items' => [
                [
                    'product_id' => $this->product->id,
                    'quantity' => 2,
                    'unit_price' => 1000,
                    'selling_price' => 1200
                ]
            ]
        ];

        $response = $this->actingAs($this->user)
            ->postJson('/api/purchase-invoices', $postData);

        $response->assertStatus(201);
        $invoiceId = $response->json('id');

        $this->assertDatabaseHas('purchase_invoices', [
            'id' => $invoiceId,
            'supplier_id' => $supplier->id,
        ]);

        // Verify accounting_entity_id is filled
        $invoice = \App\Models\PurchaseInvoice::find($invoiceId);
        $this->assertNotNull($invoice->accounting_entity_id);
        
        $entity = Entity::where('name', 'VIJAY MARKETING')->first();
        $this->assertNotNull($entity);
        $this->assertEquals($entity->id, $invoice->accounting_entity_id);
    }

    public function test_can_create_purchase_with_entity_supplier_not_linked_to_supplier()
    {
        // Create an entity directly (as done via EntityManager)
        $entity = Entity::create([
            'name' => 'VIJAY DISTRIBUTORS',
            'type' => 'DISTRIBUTOR',
            'phone' => '9999999999',
            'description' => 'SOME ADDRESS',
            'gst_number' => 'GST123456789'
        ]);

        $this->assertDatabaseMissing('suppliers', [
            'name' => 'VIJAY DISTRIBUTORS'
        ]);

        $postData = [
            'shop_id' => $this->shop->id,
            'supplier_id' => "entity-{$entity->id}",
            'purchase_date' => '2026-05-24',
            'status' => 'received',
            'bill_type' => 'kaccha',
            'items' => [
                [
                    'product_id' => $this->product->id,
                    'quantity' => 2,
                    'unit_price' => 1000,
                    'selling_price' => 1200
                ]
            ]
        ];

        $response = $this->actingAs($this->user)
            ->postJson('/api/purchase-invoices', $postData);

        $response->assertStatus(201);
        $invoiceId = $response->json('id');

        // A supplier should have been created
        $supplier = Supplier::where('name', 'VIJAY DISTRIBUTORS')->first();
        $this->assertNotNull($supplier);

        // Entity relation should be updated
        $entity->refresh();
        $this->assertEquals(Supplier::class, $entity->relation_type);
        $this->assertEquals($supplier->id, $entity->relation_id);

        // Purchase Invoice should use newly created supplier and correct accounting_entity_id
        $this->assertDatabaseHas('purchase_invoices', [
            'id' => $invoiceId,
            'supplier_id' => $supplier->id,
            'accounting_entity_id' => $entity->id
        ]);
    }

    public function test_can_create_purchase_with_entity_supplier_already_linked_to_supplier()
    {
        $supplier = Supplier::create([
            'name' => 'VIJAY DISTRIBUTORS',
            'phone' => '9999999999',
            'address' => 'SOME ADDRESS',
            'gst_no' => 'GST123456789'
        ]);

        // Find the auto-created entity
        $entity = Entity::where('name', 'VIJAY DISTRIBUTORS')->first();
        $this->assertNotNull($entity);
        $this->assertEquals(Supplier::class, $entity->relation_type);
        $this->assertEquals($supplier->id, $entity->relation_id);

        $suppliersCountBefore = Supplier::count();

        $postData = [
            'shop_id' => $this->shop->id,
            'supplier_id' => "entity-{$entity->id}",
            'purchase_date' => '2026-05-24',
            'status' => 'received',
            'bill_type' => 'kaccha',
            'items' => [
                [
                    'product_id' => $this->product->id,
                    'quantity' => 2,
                    'unit_price' => 1000,
                    'selling_price' => 1200
                ]
            ]
        ];

        $response = $this->actingAs($this->user)
            ->postJson('/api/purchase-invoices', $postData);

        $response->assertStatus(201);
        $invoiceId = $response->json('id');

        // No new supplier should have been created
        $this->assertEquals($suppliersCountBefore, Supplier::count());

        // Purchase Invoice should use the existing supplier and correct accounting_entity_id
        $this->assertDatabaseHas('purchase_invoices', [
            'id' => $invoiceId,
            'supplier_id' => $supplier->id,
            'accounting_entity_id' => $entity->id
        ]);
    }

    public function test_can_create_purchase_with_entity_supplier_having_null_phone_and_description()
    {
        $entity = Entity::create([
            'name' => 'VIJAY DISTRIBUTORS',
            'type' => 'DISTRIBUTOR',
            'phone' => null,
            'description' => null,
            'gst_number' => null
        ]);

        $postData = [
            'shop_id' => $this->shop->id,
            'supplier_id' => "entity-{$entity->id}",
            'purchase_date' => '2026-05-24',
            'status' => 'received',
            'bill_type' => 'kaccha',
            'items' => [
                [
                    'product_id' => $this->product->id,
                    'quantity' => 2,
                    'unit_price' => 1000,
                    'selling_price' => 1200
                ]
            ]
        ];

        $response = $this->actingAs($this->user)
            ->postJson('/api/purchase-invoices', $postData);

        $response->assertStatus(201);
        
        $supplier = Supplier::where('name', 'VIJAY DISTRIBUTORS')->first();
        $this->assertNotNull($supplier);
        $this->assertEquals('', $supplier->phone);
        $this->assertEquals('', $supplier->address);
    }
}
