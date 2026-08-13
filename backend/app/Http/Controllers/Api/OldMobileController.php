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

    /**
     * Post the ledger transaction(s) for a non-exchange purchase. Always posts
     * a "payable" leg for the full purchase price (Credit — this is what the
     * shop now owes the seller), and, unless pay_later is set, an immediate
     * "payment" leg (Debit, dual-posts to Cash/Bank) for the same amount that
     * nets it straight back to zero. This mirrors how a Sale posts the full
     * grand_total as a Debit and any payment received as a separate Credit —
     * so a paid-in-full purchase leaves a clean two-line audit trail with no
     * residual balance, and a pay-later purchase leaves the seller correctly
     * showing as PAYABLE until settled (via the normal Entity Ledger Settle).
     */
    private function recordPurchaseTransactions(OldMobilePurchase $purchase, array $data): void
    {
        if ($purchase->purchase_price <= 0) return;

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
            return;
        }

        $this->transactionService->recordForModel($purchase, [
            'type'             => 'IN',
            'category'         => 'OLD_MOBILE_PURCHASE',
            'amount'           => $purchase->purchase_price,
            'payment_mode'     => 'PAYABLE',
            'description'      => "Old mobile purchase (payable): {$purchase->model_name} from " . ($purchase->customer->name ?? 'Customer'),
            'transaction_date' => $purchase->purchase_date,
            'shop_id'          => $purchase->shop_id,
        ]);

        if (!$purchase->pay_later) {
            $this->transactionService->recordForModel($purchase, [
                'type'             => 'OUT',
                'category'         => 'OLD_MOBILE_PURCHASE_PAYMENT',
                'amount'           => $purchase->purchase_price,
                'payment_mode'     => $data['payment_mode'] ?? 'CASH',
                'payment_lines'    => $data['payment_lines'] ?? null,
                'description'      => "Cash paid for old mobile purchase: {$purchase->model_name} from " . ($purchase->customer->name ?? 'Customer'),
                'transaction_date' => $purchase->purchase_date,
                'shop_id'          => $purchase->shop_id,
            ]);
        }
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
            'pay_later'      => 'nullable|boolean',
            'ram'            => 'nullable|string|max:50',
            'storage'        => 'nullable|string|max:50',
            'color'          => 'nullable|string|max:100',
            'condition_note' => 'nullable|string',
            'purchase_date'  => 'required|date',
            'payment_mode'   => 'nullable|string',
            'payment_lines'  => 'nullable|array|min:2',
            'payment_lines.*.payment_mode' => 'required_with:payment_lines|string',
            'payment_lines.*.amount'       => 'required_with:payment_lines|numeric|min:0.01',
        ]);

        if (!$data['customer_id'] && !$data['customer_phone']) {
            return response()->json(['message' => 'Customer selection or phone number is required.'], 422);
        }

        if (($data['is_exchange'] ?? false) && ($data['pay_later'] ?? false)) {
            return response()->json(['message' => 'Choose either Exchange Credit or Pay Later, not both.'], 422);
        }

        // The split only makes sense for real cash paid out now — trade-in exchange
        // credit and a deferred (pay-later) purchase aren't a cash account movement yet.
        $paysNow = !($data['is_exchange'] ?? false) && !($data['pay_later'] ?? false);
        if ($paysNow && !\App\Services\TransactionService::paymentLinesSumMatches($data['payment_lines'] ?? null, (float) $data['purchase_price'])) {
            return response()->json(['message' => 'Split payment lines must add up to the purchase price'], 422);
        }

        // Sanitize IMEI: treat placeholder values (000000, empty, all-zeros) as null
        // so MySQL's unique constraint doesn't block multiple phones without real IMEIs.
        $data['imei'] = $this->sanitizeImei($data['imei'] ?? null);

        $data['customer_id'] = $data['customer_id'] ?? $this->syncCustomer($data, 'OLD MOBILE PURCHASE');
        $data['shop_id'] = $user->hasFullAccess() ? $request->shop_id : $user->shop_id;
        $data['user_id'] = $user->id;

        return DB::transaction(function () use ($data, $user) {
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

            // 2. Record Transaction(s)
            $this->recordPurchaseTransactions($purchase, $data);

            ActivityLog::log('OLD_MOBILE_PURCHASED', $purchase,
                "Old mobile purchased: {$purchase->model_name} from " . ($purchase->customer?->name ?? $purchase->customer_name) . " ₹{$purchase->purchase_price}"
            );

            $this->notifyOwner(
                "📱 *2nd Hand Purchase*\nModel: {$purchase->model_name}" . ($purchase->imei ? "\nIMEI: {$purchase->imei}" : '') .
                "\nFrom: " . ($purchase->customer?->name ?? $purchase->customer_name) .
                "\nAmount: ₹" . number_format($purchase->purchase_price, 2) .
                "\nBy: {$user->name}"
            );

            return response()->json($purchase, 201);
        });
    }

    /**
     * Record several devices bought from the SAME customer in one visit.
     * Each device still becomes its own OldMobilePurchase row with its own
     * Product/Inventory/Transaction entry — identical to store() per item —
     * so every existing report, exchange-credit calc, and resale flow keeps
     * working unchanged. Only the customer-facing form and notification
     * are batched into one.
     */
    public function bulkStore(Request $request)
    {
        $user = $request->user();
        $data = $request->validate([
            'customer_id'    => 'nullable|exists:customers,id',
            'customer_name'  => 'nullable|string|max:150',
            'customer_phone' => 'nullable|string|max:20',
            'customer_address' => 'nullable|string|max:255',
            'purchase_date'  => 'required|date',
            'is_exchange'    => 'nullable|boolean',
            'pay_later'      => 'nullable|boolean',
            'items'          => 'required|array|min:1',
            'items.*.model_name'     => 'required|string|max:150',
            'items.*.imei'           => 'nullable|string|max:20',
            'items.*.purchase_price' => 'required|numeric|min:0',
            'items.*.selling_price'  => 'nullable|numeric|min:0',
            'items.*.ram'            => 'nullable|string|max:50',
            'items.*.storage'        => 'nullable|string|max:50',
            'items.*.color'          => 'nullable|string|max:100',
            'items.*.condition_note' => 'nullable|string',
            'payment_mode'   => 'nullable|string',
        ]);

        if (!$data['customer_id'] && !$data['customer_phone']) {
            return response()->json(['message' => 'Customer selection or phone number is required.'], 422);
        }

        if (($data['is_exchange'] ?? false) && ($data['pay_later'] ?? false)) {
            return response()->json(['message' => 'Choose either Exchange Credit or Pay Later, not both.'], 422);
        }

        $customerId = $data['customer_id'] ?? $this->syncCustomer($data, 'OLD MOBILE PURCHASE (BULK)');
        $shopId = $user->hasFullAccess() ? $request->shop_id : $user->shop_id;
        $isExchange = (bool) ($data['is_exchange'] ?? false);
        $payLater = (bool) ($data['pay_later'] ?? false);
        $categoryId = \App\Models\Category::mobileOldId();

        // Only tag a batch_id when there's actually more than one device —
        // a single-device bulk submission is indistinguishable from the
        // original single-purchase flow, so leave it ungrouped like those.
        $batchId = count($data['items']) > 1 ? (string) \Illuminate\Support\Str::uuid() : null;

        return DB::transaction(function () use ($data, $user, $customerId, $shopId, $isExchange, $payLater, $categoryId, $batchId) {
            $created = [];
            $totalAmount = 0;

            foreach ($data['items'] as $item) {
                $purchase = OldMobilePurchase::create([
                    'customer_id'    => $customerId,
                    'shop_id'        => $shopId,
                    'user_id'        => $user->id,
                    'batch_id'       => $batchId,
                    'model_name'     => $item['model_name'],
                    'imei'           => $this->sanitizeImei($item['imei'] ?? null),
                    'purchase_price' => $item['purchase_price'],
                    'selling_price'  => $item['selling_price'] ?? 0,
                    'is_exchange'    => $isExchange,
                    'pay_later'      => $payLater,
                    'ram'            => $item['ram'] ?? null,
                    'storage'        => $item['storage'] ?? null,
                    'color'          => $item['color'] ?? null,
                    'condition_note' => $item['condition_note'] ?? null,
                    'purchase_date'  => $data['purchase_date'],
                ]);

                $product = \App\Models\Product::create([
                    'category_id'    => $categoryId,
                    'name'           => $purchase->model_name,
                    'sku'            => \App\Models\Product::generateSku($purchase->model_name),
                    'imei'           => $purchase->imei,
                    'purchase_price' => $purchase->purchase_price,
                    'selling_price'  => $purchase->selling_price ?? 0,
                    'attributes'     => [
                        'ram'     => $purchase->ram,
                        'storage' => $purchase->storage,
                        'color'   => $purchase->color,
                    ]
                ]);

                $purchase->update(['product_id' => $product->id]);
                \App\Models\Inventory::addStock($shopId, $product->id, 1);
                $purchase->load('customer');

                $this->recordPurchaseTransactions($purchase, $data);

                $totalAmount += (float) $purchase->purchase_price;
                $created[] = $purchase;
            }

            $customerName = $created[0]->customer->name ?? ($data['customer_name'] ?? 'Customer');
            $modelList = collect($created)->map(fn ($p) => $p->model_name . ($p->imei ? " (IMEI: {$p->imei})" : ''))->implode("\n• ");

            ActivityLog::log('OLD_MOBILE_PURCHASED_BULK', $created[0],
                count($created) . " old mobiles purchased from {$customerName}: ₹" . number_format($totalAmount, 2)
            );

            $this->notifyOwner(
                "📱 *2nd Hand Purchase (" . count($created) . " devices)*\n• {$modelList}" .
                "\nFrom: {$customerName}" .
                "\nTotal: ₹" . number_format($totalAmount, 2) .
                "\nBy: {$user->name}"
            );

            return response()->json($created, 201);
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
            'pay_later'      => 'nullable|boolean',
            'ram'            => 'nullable|string|max:50',
            'storage'        => 'nullable|string|max:50',
            'color'          => 'nullable|string|max:100',
            'condition_note' => 'nullable|string',
            'purchase_date'  => 'required|date',
            'payment_mode'   => 'nullable|string',
            'payment_lines'  => 'nullable|array|min:2',
            'payment_lines.*.payment_mode' => 'required_with:payment_lines|string',
            'payment_lines.*.amount'       => 'required_with:payment_lines|numeric|min:0.01',
        ]);

        if (!$data['customer_id'] && !$data['customer_phone']) {
            return response()->json(['message' => 'Customer selection or phone number is required.'], 422);
        }

        if (($data['is_exchange'] ?? false) && ($data['pay_later'] ?? false)) {
            return response()->json(['message' => 'Choose either Exchange Credit or Pay Later, not both.'], 422);
        }

        $paysNow = !($data['is_exchange'] ?? false) && !($data['pay_later'] ?? false);
        if ($paysNow && !\App\Services\TransactionService::paymentLinesSumMatches($data['payment_lines'] ?? null, (float) $data['purchase_price'])) {
            return response()->json(['message' => 'Split payment lines must add up to the purchase price'], 422);
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

        // Sync associated Transaction record(s) — the number of legs can change
        // between edits (e.g. switching Pay Later on/off), so it's simplest and
        // safest to always wipe and re-record rather than try to patch rows in place.
        \App\Models\Transaction::where('entity_type', OldMobilePurchase::class)
            ->where('entity_id', $oldMobilePurchase->id)
            ->get()
            ->each(fn ($tx) => $tx->delete());

        $this->recordPurchaseTransactions($oldMobilePurchase, $data);

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

        $this->notifyOwner(
            "🗑️ *2nd Hand Purchase Deleted*\nModel: {$oldMobilePurchase->model_name}" .
            "\nAmount: ₹" . number_format($oldMobilePurchase->purchase_price, 2) . "\nBy: {$user->name}"
        );

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
