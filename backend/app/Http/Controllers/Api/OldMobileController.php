<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\OldMobilePurchase;
use Illuminate\Http\Request;

class OldMobileController extends Controller
{
    use \App\Traits\SyncsWithCustomer;
    protected $transactionService;

    public function __construct(\App\Services\TransactionService $transactionService)
    {
        $this->transactionService = $transactionService;
    }

    public function index(Request $request)
    {
        $user = $request->user();
        $query = OldMobilePurchase::with('customer', 'user');
        if (! $user->hasFullAccess()) $query->where('shop_id', $user->shop_id);
        return response()->json($query->latest()->get());
    }

    public function store(Request $request)
    {
        $user = $request->user();
        $data = $request->validate([
            'customer_id'    => 'nullable|exists:customers,id',
            'customer_name'  => 'nullable|string|max:150',
            'customer_phone' => 'nullable|string|max:20',
            'model_name'     => 'required|string|max:150',
            'imei'           => 'nullable|string|max:20',
            'purchase_price' => 'required|numeric|min:0',
            'selling_price'  => 'nullable|numeric|min:0',
            'is_exchange'    => 'nullable|boolean',
            'ram'            => 'nullable|string|max:50',
            'storage'        => 'nullable|string|max:50',
            'color'          => 'nullable|string|max:100',
            'condition_note' => 'nullable|string',
            'purchase_date'  => 'required|date',
        ]);

        if (!$data['customer_id'] && !$data['customer_phone']) {
            return response()->json(['message' => 'Customer selection or phone number is required.'], 422);
        }

        $data['customer_id'] = $data['customer_id'] ?? $this->syncCustomer($data, 'OLD MOBILE PURCHASE');
        $data['shop_id'] = $user->hasFullAccess() ? $request->shop_id : $user->shop_id;
        $data['user_id'] = $user->id;
        
        $purchase = OldMobilePurchase::create($data);

        // 1. Automatically create a Product for inventory reselling
        $category = \App\Models\Category::where('slug', 'mobile-old')->first();
        $categoryId = $category ? $category->id : null;

        $product = \App\Models\Product::create([
            'category_id'       => $categoryId,
            'name'              => $purchase->model_name,
            'sku'               => \App\Models\Product::generateSku($purchase->model_name),
            'imei'              => $purchase->imei,
            'purchase_price'    => $purchase->purchase_price,
            'selling_price'     => $purchase->selling_price ?? 0,
            'attributes'        => [
                'ram'     => $purchase->ram,
                'storage' => $purchase->storage,
                'color'   => $purchase->color,
            ]
        ]);

        // Link the product back to the purchase
        $purchase->update(['product_id' => $product->id]);

        // Add 1 stock to the shop's inventory for this product
        \App\Models\Inventory::addStock($purchase->shop_id, $product->id, 1);

        $purchase->load('customer');

        // 2. Record Transaction
        if ($purchase->purchase_price > 0) {
            if ($purchase->is_exchange) {
                // Exchange adds credit to Customer Ledger: transaction type IN, mode EXCHANGE
                $this->transactionService->recordForModel($purchase, [
                    'type'             => 'IN',
                    'category'         => 'OLD_MOBILE_EXCHANGE',
                    'amount'           => $purchase->purchase_price,
                    'payment_mode'     => 'EXCHANGE',
                    'description'      => "Old mobile trade-in exchange credit: {$purchase->model_name} from " . ($purchase->customer->name ?? 'Customer'),
                    'transaction_date' => $purchase->purchase_date,
                    'shop_id'          => $purchase->shop_id,
                ]);
            } else {
                // Direct purchase payouts: transaction type OUT, mode CASH
                $this->transactionService->recordForModel($purchase, [
                    'type'             => 'OUT',
                    'category'         => 'OLD_MOBILE_PURCHASE',
                    'amount'           => $purchase->purchase_price,
                    'payment_mode'     => 'CASH',
                    'description'      => "Purchased old mobile: {$purchase->model_name} from " . ($purchase->customer->name ?? 'Customer'),
                    'transaction_date' => $purchase->purchase_date,
                    'shop_id'          => $purchase->shop_id,
                ]);
            }
        }

        return response()->json($purchase, 201);
    }

    public function show(Request $request, OldMobilePurchase $oldMobilePurchase)
    {
        $user = $request->user();
        if (! $user->hasFullAccess() && $oldMobilePurchase->shop_id !== $user->shop_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        return response()->json($oldMobilePurchase->load('customer', 'user'));
    }
}
