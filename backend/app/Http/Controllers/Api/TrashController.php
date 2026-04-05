<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\ActivityLog;

class TrashController extends Controller
{
    /** Models that support soft deletes */
    private $models = [
        'retailer'         => \App\Models\Retailer::class,
        'drop'             => \App\Models\AirtelDrop::class,
        'recovery'         => \App\Models\AirtelRecovery::class,
        'product'          => \App\Models\Product::class,
        'customer'         => \App\Models\Customer::class,
        'supplier'         => \App\Models\Supplier::class,
        'purchase_invoice' => \App\Models\PurchaseInvoice::class,
        'sale_invoice'     => \App\Models\SaleInvoice::class,
        'user'             => \App\Models\User::class,
    ];

    public function index(Request $request)
    {
        if (!$request->user()->hasFullAccess()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $type = $request->type;
        if (!$type || !isset($this->models[$type])) {
            return response()->json(['message' => 'Invalid model type'], 400);
        }

        $modelClass = $this->models[$type];
        $items = $modelClass::onlyTrashed()->orderBy('deleted_at', 'desc')->paginate(50);

        return response()->json($items);
    }

    public function restore(Request $request)
    {
        if (!$request->user()->hasFullAccess()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $type = $request->type;
        $id = $request->id;

        if (!$type || !isset($this->models[$type])) {
            return response()->json(['message' => 'Invalid model type'], 400);
        }

        $modelClass = $this->models[$type];
        $item = $modelClass::onlyTrashed()->findOrFail($id);
        $item->restore();

        ActivityLog::log('RESTORED_ITEM', $item, "Restored $type (ID: $id): " . ($item->name ?: $item->invoice_no ?: 'Record'));

        return response()->json(['message' => 'Item restored successfully']);
    }
}
