<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RechargePurchase;
use App\Models\RechargeSale;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RechargeController extends Controller
{
    use \App\Traits\SyncsWithCustomer;
    protected $transactionService;

    public function __construct(\App\Services\TransactionService $transactionService)
    {
        $this->transactionService = $transactionService;
    }

    // ── Purchases ──────────────────────────────────────────────────────────
    public function purchaseIndex(Request $request)
    {
        $user = $request->user();
        $query = RechargePurchase::with('supplier', 'user');
        if (! $user->hasFullAccess()) $query->where('shop_id', $user->shop_id);
        return response()->json($query->latest()->get());
    }

    public function purchaseStore(Request $request)
    {
        $this->resolveSupplierId($request);
        $user = $request->user();
        $data = $request->validate([
            'supplier_id'   => 'required|exists:suppliers,id',
            'operator'      => 'required|string|max:50',
            'amount'        => 'nullable|numeric|min:0',
            'cost_price'    => 'nullable|numeric|min:0',
            'purchase_date' => 'required|date',
        ]);
        $data['amount'] = $data['amount'] ?? 0;
        $data['cost_price'] = $data['cost_price'] ?? 0;
        $shopId = $user->hasFullAccess() ? $request->shop_id : $user->shop_id;
        if (in_array($shopId, [null, '', 0, 'null', 'undefined'], true)) {
            $shopId = null;
        }
        if (!$shopId && $user->hasFullAccess()) {
            $shopId = \App\Models\Shop::where('is_main', true)->value('id') ?? \App\Models\Shop::value('id');
        }
        $data['shop_id'] = $shopId;
        $data['user_id'] = $user->id;

        $purchase = DB::transaction(function () use ($data) {
            $purchase = RechargePurchase::create($data);

            // Record Transaction
            $this->transactionService->recordForModel($purchase, [
                'type'             => 'OUT',
                'category'         => 'RECHARGE_PURCHASE',
                'amount'           => $purchase->cost_price,
                'description'      => "Recharge stock purchased: {$purchase->operator} (Amount: {$purchase->amount})",
                'transaction_date' => $purchase->purchase_date,
                'shop_id'          => $purchase->shop_id,
            ]);

            return $purchase;
        });

        return response()->json($purchase, 201);
    }

    // ── Sales ───────────────────────────────────────────────────────────────
    public function saleIndex(Request $request)
    {
        $user = $request->user();
        $query = RechargeSale::with('customer', 'user');
        if (! $user->hasFullAccess()) $query->where('shop_id', $user->shop_id);
        return response()->json($query->latest()->get());
    }

    public function saleStore(Request $request)
    {
        $user = $request->user();
        $data = $request->validate([
            'customer_id'    => 'nullable|exists:customers,id',
            'customer_name'  => 'nullable|string|max:150',
            'customer_phone' => 'nullable|string|max:20',
            'mobile_number'  => 'required|string|max:15',
            'operator'       => 'required|string|max:50',
            'amount'         => 'required|numeric|min:0',
            'selling_price'  => 'required|numeric|min:0',
            'sale_date'      => 'required|date',
        ]);

        $customerId = $data['customer_id'] ?? null;
        $customerPhone = $data['customer_phone'] ?? null;

        if (!$customerId && !$customerPhone) {
            return response()->json(['message' => 'Customer selection or phone number is required.'], 422);
        }

        $data['customer_id'] = $customerId ?? $this->syncCustomer($data, 'RECHARGE');
        $shopId = $user->hasFullAccess() ? $request->shop_id : $user->shop_id;
        if (in_array($shopId, [null, '', 0, 'null', 'undefined'], true)) {
            $shopId = null;
        }
        if (!$shopId && $user->hasFullAccess()) {
            $shopId = \App\Models\Shop::where('is_main', true)->value('id') ?? \App\Models\Shop::value('id');
        }
        $data['shop_id'] = $shopId;
        $data['user_id'] = $user->id;

        $recharge = DB::transaction(function () use ($data) {
            $recharge = RechargeSale::create($data);

            // Record Income Transaction
            if ($recharge->selling_price > 0) {
                $this->transactionService->recordForModel($recharge, [
                    'type'             => 'IN',
                    'category'         => 'RECHARGE_SALE',
                    'amount'           => $recharge->selling_price,
                    'description'      => "Recharge sale: {$recharge->operator} for {$recharge->mobile_number}",
                    'transaction_date' => $recharge->sale_date,
                    'shop_id'          => $recharge->shop_id,
                ]);
            }

            return $recharge;
        });

        return response()->json($recharge, 201);
    }

    protected function resolveSupplierId(Request $request)
    {
        $supplierId = $request->input('supplier_id');
        if (is_string($supplierId) && str_starts_with($supplierId, 'entity-')) {
            $entityId = (int) substr($supplierId, 7);
            $entity = \App\Models\Entity::find($entityId);
            if ($entity) {
                if ($entity->relation_type === \App\Models\Supplier::class && $entity->relation_id) {
                    $request->merge(['supplier_id' => $entity->relation_id]);
                } else {
                    // Check if a supplier with the same name already exists to prevent duplicates
                    $supplier = \App\Models\Supplier::where('name', $entity->name)->first();
                    if (!$supplier) {
                        $supplier = \App\Models\Supplier::create([
                            'name'    => $entity->name,
                            'phone'   => $entity->phone ?? '',
                            'address' => $entity->description ?? '',
                            'gst_no'  => $entity->gst_number,
                        ]);
                        
                        $entity->relation_type = \App\Models\Supplier::class;
                        $entity->relation_id   = $supplier->id;
                        $entity->save();
                    } else {
                        $entity->relation_type = \App\Models\Supplier::class;
                        $entity->relation_id   = $supplier->id;
                        $entity->save();
                    }
                    $request->merge(['supplier_id' => $supplier->id]);
                }
            }
        }
    }
}
