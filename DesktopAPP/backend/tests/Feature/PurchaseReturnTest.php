<?php

namespace Tests\Feature;

use App\Models\Inventory;
use App\Models\Product;
use App\Models\PurchaseInvoice;
use App\Models\PurchaseItem;
use App\Models\Shop;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PurchaseReturnTest extends TestCase
{
    use RefreshDatabase;

    public function test_mark_received_with_damages()
    {
        $shop = Shop::create(['name' => 'Test Shop', 'address' => 'Test Address', 'phone' => '1234567890']);
        $user = User::factory()->create(['shop_id' => $shop->id, 'is_owner' => true]);
        $supplier = Supplier::create(['name' => 'Test Supplier', 'phone' => '0987654321', 'address' => 'Test Address']);
        $category = \App\Models\Category::create(['name' => 'Mobile', 'slug' => 'mobile']);
        $product = Product::create([
            'name' => 'Test Phone',
            'category_id' => $category->id,
            'sku' => 'TEST-SKU',
            'purchase_price' => 1000,
            'selling_price' => 1200
        ]);

        $invoice = PurchaseInvoice::create([
            'invoice_no' => 'PUR-TEST-123',
            'shop_id' => $shop->id,
            'supplier_id' => $supplier->id,
            'user_id' => $user->id,
            'purchase_date' => now(),
            'total_amount' => 10000,
            'grand_total' => 11800,
            'status' => 'ordered'
        ]);

        $item = PurchaseItem::create([
            'purchase_invoice_id' => $invoice->id,
            'product_id' => $product->id,
            'quantity' => 10,
            'unit_price' => 1000,
            'total' => 10000
        ]);

        $response = $this->actingAs($user)
            ->postJson("/api/purchase-invoices/{$invoice->id}/receive", [
                'items' => [
                    [
                        'id' => $item->id,
                        'received_quantity' => 10,
                        'damaged_quantity' => 3
                    ]
                ]
            ]);

        $response->assertStatus(200);
        
        $item->refresh();
        $this->assertEquals(10, $item->received_quantity);
        $this->assertEquals(3, $item->damaged_quantity);

        // Net added to inventory should be 10 - 3 = 7
        $inventory = Inventory::where('shop_id', $shop->id)
            ->where('product_id', $product->id)
            ->first();
        
        $this->assertNotNull($inventory);
        $this->assertEquals(7, $inventory->stock);
        
        $invoice->refresh();
        $this->assertEquals('received', $invoice->status);
    }
}
