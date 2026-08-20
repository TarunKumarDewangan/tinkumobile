<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EntityNote extends Model
{
    protected $fillable = [
        'entity_id',
        'sale_invoice_id',
        'name',
        'phone',
        'category',
        'promise_date',
        'note',
        'status',
        'resolved_at',
        'balance_at_time',
        'shop_id',
        'created_by',
    ];

    protected $casts = [
        'promise_date' => 'date:Y-m-d',
        'resolved_at' => 'datetime',
        'balance_at_time' => 'float',
    ];

    public function entity()
    {
        return $this->belongsTo(Entity::class);
    }

    public function saleInvoice()
    {
        return $this->belongsTo(SaleInvoice::class);
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Re-verify every PENDING note against the real, live balance it's about
     * and auto-resolve any that have already been cleared — regardless of how
     * the payment happened. The one specific "payment on this exact invoice"
     * hook (SaleInvoiceController::addPayment) can't catch every path a
     * balance clears through (Settle button, a different invoice, a repair/
     * EMI payment, a note with no sale_invoice_id at all), so this checks
     * reality directly instead of relying on every mutation being hooked.
     *
     * Cheap enough to call on every read (Promise to Pay / Pending Balance
     * page load, daily Telegram digest) since the pending-note count is small.
     */
    public static function reconcilePending(): void
    {
        $notes = static::where('status', 'PENDING')->get();
        if ($notes->isEmpty()) return;

        $entityService = app(\App\Services\EntityService::class);

        foreach ($notes as $note) {
            $stillOwed = null;

            if ($note->sale_invoice_id) {
                $invoice = SaleInvoice::find($note->sale_invoice_id);
                if ($invoice) {
                    $stillOwed = $invoice->payment_status !== 'paid';
                }
            }

            if ($stillOwed === null) {
                $entity = $note->entity_id
                    ? Entity::find($note->entity_id)
                    : Entity::where('name', $note->name)->first();
                if ($entity) {
                    $calculated = $entityService->syncBalance($entity);
                    $stillOwed = (float) $calculated->net_balance > 0.01;
                }
            }

            if ($stillOwed === false) {
                $note->update(['status' => 'FULFILLED', 'resolved_at' => now()]);
            }
        }
    }
}
