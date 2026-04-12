<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\OldMobilePurchase;
use Illuminate\Http\Request;

class OldMobileController extends Controller
{
    use \App\Traits\SyncsWithCustomer, \App\Traits\RecordsTransactions;
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

        // Record Expense Transaction
        if ($purchase->purchase_amount > 0) {
            $this->recordTransaction([
                'type' => 'OUT',
                'category' => 'OLD_MOBILE_PURCHASE',
                'amount' => $purchase->purchase_amount,
                'description' => "Purchased old mobile: {$purchase->model_name} from {$purchase->customer_name}",
                'entity_type' => get_class($purchase),
                'entity_id' => $purchase->id,
                'shop_id' => $purchase->shop_id,
            ]);
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
