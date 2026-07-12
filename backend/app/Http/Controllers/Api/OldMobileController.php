<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\OldMobilePurchase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

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

        // Sanitize IMEI: treat placeholder values (000000, empty, all-zeros) as null
        // so MySQL's unique constraint doesn't block multiple phones without real IMEIs.
        $data['imei'] = $this->sanitizeImei($data['imei'] ?? null);

        $data['customer_id'] = $data['customer_id'] ?? $this->syncCustomer($data, 'OLD MOBILE PURCHASE');
        $data['shop_id'] = $user->hasFullAccess() ? $request->shop_id : $user->shop_id;
        $data['user_id'] = $user->id;

        return DB::transaction(function () use ($data) {
            $purchase = OldMobilePurchase::create($data);

            // 1. Automatically create a Product for inventory reselling
            $categoryId = \App\Models\Category::mobileOldId();

            $product = \App\Models\Product::create([
                'category_id'       => $categoryId,
                'name'              => $purchase->model_name,
                'sku'               => \App\Models\Product::generateSku($purchase->model_name),
                'imei'              => $purchase->imei, // already sanitized (null if placeholder)
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

            ActivityLog::log('OLD_MOBILE_PURCHASED', $purchase,
                "Old mobile purchased: {$purchase->model_name} from " . ($purchase->customer?->name ?? $purchase->customer_name) . " ₹{$purchase->purchase_price}"
            );
            return response()->json($purchase, 201);
        });
    }

    public function show(Request $request, OldMobilePurchase $oldMobilePurchase)
    {
        $user = $request->user();
        if (! $user->hasFullAccess() && $oldMobilePurchase->shop_id !== $user->shop_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        return response()->json($oldMobilePurchase->load('customer', 'user'));
    }

    public function update(Request $request, OldMobilePurchase $oldMobilePurchase)
    {
        $user = $request->user();
        if (! $user->hasFullAccess() && $oldMobilePurchase->shop_id !== $user->shop_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

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

        // Check if the associated product has already been sold
        if ($oldMobilePurchase->product_id) {
            $isSold = \App\Models\SaleItem::where('product_id', $oldMobilePurchase->product_id)
                ->whereHas('invoice', function($q) {
                    $q->where('is_cancelled', false);
                })
                ->exists();
            if ($isSold) {
                return response()->json(['message' => 'Cannot edit this purchase because the device has already been sold.'], 422);
            }
        }

        $data['customer_id'] = $data['customer_id'] ?? $this->syncCustomer($data, 'OLD MOBILE PURCHASE');

        // Update purchase record
        $oldMobilePurchase->update($data);

        // Sanitize IMEI before updating
        $data['imei'] = $this->sanitizeImei($data['imei'] ?? null);

        // Update associated product
        if ($oldMobilePurchase->product_id) {
            $categoryId = \App\Models\Category::mobileOldId();

            $product = \App\Models\Product::find($oldMobilePurchase->product_id);
            if ($product) {
                $product->update([
                    'category_id'    => $categoryId,
                    'name'           => $oldMobilePurchase->model_name,
                    'imei'           => $this->sanitizeImei($oldMobilePurchase->imei),
                    'purchase_price' => $oldMobilePurchase->purchase_price,
                    'selling_price'  => $oldMobilePurchase->selling_price ?? 0,
                    'attributes'     => [
                        'ram'     => $oldMobilePurchase->ram,
                        'storage' => $oldMobilePurchase->storage,
                        'color'   => $oldMobilePurchase->color,
                    ]
                ]);
            }
        }

        // Sync associated Transaction record
        $transaction = \App\Models\Transaction::where('entity_type', OldMobilePurchase::class)
            ->where('entity_id', $oldMobilePurchase->id)
            ->first();

        if ($transaction) {
            if ($oldMobilePurchase->purchase_price > 0) {
                if ($oldMobilePurchase->is_exchange) {
                    $transaction->update([
                        'type'             => 'IN',
                        'category'         => 'OLD_MOBILE_EXCHANGE',
                        'amount'           => $oldMobilePurchase->purchase_price,
                        'payment_mode'     => 'EXCHANGE',
                        'description'      => "Old mobile trade-in exchange credit: {$oldMobilePurchase->model_name} from " . ($oldMobilePurchase->customer->name ?? 'Customer'),
                        'transaction_date' => $oldMobilePurchase->purchase_date,
                    ]);
                } else {
                    $transaction->update([
                        'type'             => 'OUT',
                        'category'         => 'OLD_MOBILE_PURCHASE',
                        'amount'           => $oldMobilePurchase->purchase_price,
                        'payment_mode'     => 'CASH',
                        'description'      => "Purchased old mobile: {$oldMobilePurchase->model_name} from " . ($oldMobilePurchase->customer->name ?? 'Customer'),
                        'transaction_date' => $oldMobilePurchase->purchase_date,
                    ]);
                }
            } else {
                $transaction->delete();
            }
        } else if ($oldMobilePurchase->purchase_price > 0) {
            if ($oldMobilePurchase->is_exchange) {
                $this->transactionService->recordForModel($oldMobilePurchase, [
                    'type'             => 'IN',
                    'category'         => 'OLD_MOBILE_EXCHANGE',
                    'amount'           => $oldMobilePurchase->purchase_price,
                    'payment_mode'     => 'EXCHANGE',
                    'description'      => "Old mobile trade-in exchange credit: {$oldMobilePurchase->model_name} from " . ($oldMobilePurchase->customer->name ?? 'Customer'),
                    'transaction_date' => $oldMobilePurchase->purchase_date,
                    'shop_id'          => $oldMobilePurchase->shop_id,
                ]);
            } else {
                $this->transactionService->recordForModel($oldMobilePurchase, [
                    'type'             => 'OUT',
                    'category'         => 'OLD_MOBILE_PURCHASE',
                    'amount'           => $oldMobilePurchase->purchase_price,
                    'payment_mode'     => 'CASH',
                    'description'      => "Purchased old mobile: {$oldMobilePurchase->model_name} from " . ($oldMobilePurchase->customer->name ?? 'Customer'),
                    'transaction_date' => $oldMobilePurchase->purchase_date,
                    'shop_id'          => $oldMobilePurchase->shop_id,
                ]);
            }
        }

        ActivityLog::log('OLD_MOBILE_UPDATED', $oldMobilePurchase,
            "Old mobile updated: {$oldMobilePurchase->model_name} — ₹{$oldMobilePurchase->purchase_price}"
        );
        return response()->json($oldMobilePurchase->load('customer', 'user'));
    }

    public function destroy(Request $request, OldMobilePurchase $oldMobilePurchase)
    {
        $user = $request->user();
        if (! $user->hasFullAccess() && $oldMobilePurchase->shop_id !== $user->shop_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Check if the associated product has already been sold
        if ($oldMobilePurchase->product_id) {
            $isSold = \App\Models\SaleItem::where('product_id', $oldMobilePurchase->product_id)
                ->whereHas('invoice', function($q) {
                    $q->where('is_cancelled', false);
                })
                ->exists();
            if ($isSold) {
                return response()->json(['message' => 'Cannot delete this purchase because the device has already been sold.'], 422);
            }
        }

        // Delete associated transaction records (individual deletes fire model events → cleans ledger table)
        $linkedTransactions = \App\Models\Transaction::where('entity_type', OldMobilePurchase::class)
            ->where('entity_id', $oldMobilePurchase->id)
            ->get();

        // Fallback: catch transactions created without entity_type/entity_id (older records or duplicate entries)
        if ($linkedTransactions->isEmpty()) {
            $oldMobilePurchase->loadMissing('customer');
            $category = $oldMobilePurchase->is_exchange ? 'OLD_MOBILE_EXCHANGE' : 'OLD_MOBILE_PURCHASE';
            $customerName = $oldMobilePurchase->customer?->name;
            if ($customerName) {
                $linkedTransactions = \App\Models\Transaction::where('category', $category)
                    ->where('amount', $oldMobilePurchase->purchase_price)
                    ->where('transaction_date', $oldMobilePurchase->purchase_date)
                    ->where('entity_name', $customerName)
                    ->get();
            }
        }

        foreach ($linkedTransactions as $tx) {
            $tx->delete();
        }

        // Revert stock and delete associated product. This must be a hard delete, not
        // Product's default soft delete — products.imei has a UNIQUE index, and MySQL
        // doesn't exempt soft-deleted rows from it, so a soft-deleted product's IMEI
        // would permanently block re-purchasing that same physical phone later (the
        // guard above already confirmed it was never sold, so nothing references it).
        if ($oldMobilePurchase->product_id) {
            \App\Models\Inventory::removeStock($oldMobilePurchase->shop_id, $oldMobilePurchase->product_id, 1);
            \App\Models\Product::withTrashed()->where('id', $oldMobilePurchase->product_id)->forceDelete();
        }

        ActivityLog::log('OLD_MOBILE_DELETED', $oldMobilePurchase,
            "Old mobile deleted: {$oldMobilePurchase->model_name} (₹{$oldMobilePurchase->purchase_price})"
        );
        $oldMobilePurchase->delete();

        return response()->json(['message' => 'Old mobile purchase deleted successfully.']);
    }

    /**
     * Sanitize IMEI: convert placeholder/blank values to null.
     * MySQL unique constraint allows multiple NULL values, but blocks duplicate non-null values.
     * Users often enter '000000' or similar when they don't have the actual IMEI.
     */
    private function sanitizeImei(?string $imei): ?string
    {
        if (empty($imei)) return null;

        $cleaned = trim($imei);

        // Treat all-zero strings of any length as null (e.g. 000000, 000000000000000)
        if (preg_match('/^0+$/', $cleaned)) return null;

        // Treat obviously invalid/placeholder values as null
        if (in_array(strtolower($cleaned), ['na', 'n/a', 'none', '-', '--', '000'])) return null;

        return $cleaned;
    }
}
