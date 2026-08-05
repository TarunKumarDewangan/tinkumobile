<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\ActivityLog;
use Illuminate\Support\Facades\DB;

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
        'transaction'      => \App\Models\Transaction::class,
        'entity'           => \App\Models\Entity::class,
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

    /**
     * Permanently erase a trashed record — for items stuck in a state like
     * "deleted, but still blocking something" (e.g. a soft-deleted product whose
     * unique IMEI can never be reused, or a soft-deleted sale still holding a
     * finance plan open). Only ever offered from the Trash Manager, and only on
     * records already soft-deleted, never on live data.
     */
    public function forceDelete(Request $request)
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
        $label = $item->name ?? $item->invoice_no ?? "ID {$item->id}";

        try {
            return DB::transaction(function () use ($item, $type, $id, $label) {
                // These specific relations don't cascade on a soft delete (they have no
                // soft-delete of their own, so the DB's ON DELETE CASCADE never fires) —
                // clean them up first so the parent's real hard delete can succeed.
                if ($type === 'sale_invoice') {
                    if ($item->financePlan) {
                        $item->financePlan->payments()->delete();
                        $item->financePlan->delete();
                    }
                    $item->giftItems()->delete();
                    $item->items()->delete();
                } elseif ($type === 'purchase_invoice') {
                    $item->items()->delete();
                } elseif ($type === 'entity' && $item->relation) {
                    $item->relation->forceDelete();
                }

                $item->forceDelete();

                ActivityLog::log('PERMANENTLY_DELETED', null, "Permanently erased $type \"$label\" (ID: $id) from Trash Manager");

                return response()->json(['message' => 'Item permanently deleted']);
            });
        } catch (\Illuminate\Database\QueryException $e) {
            return response()->json([
                'message' => 'Cannot permanently delete this record — it is still referenced by other live data (e.g. a sale, purchase, or transaction) that was not itself deleted. Remove or reassign those first.',
            ], 422);
        }
    }
}
