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
     * — auto-resolving any that have been fully cleared, and refreshing
     * balance_at_time for any that have been partially paid down.
     *
     * balance_at_time is a snapshot taken when the promise was recorded; on
     * its own it never changes again, so a customer who pays down PART of
     * what they owed (anything short of the full amount) kept showing the
     * original, now-stale, too-high figure in every report indefinitely —
     * only a full payoff ever corrected anything, by removing the row
     * outright. This brings the shown amount back in line with reality on
     * every read, regardless of how the payment happened (Settle button, a
     * different invoice, a repair/EMI payment, a note with no
     * sale_invoice_id at all) — always checked against the entity's real
     * aggregate ledger balance rather than one specific invoice's status,
     * so it can't miss a payment that landed somewhere else.
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
            $entity = $note->entity_id
                ? Entity::find($note->entity_id)
                : Entity::where('name', $note->name)->first();
            if (!$entity) continue;

            $calculated = $entityService->syncBalance($entity);
            $liveBalance = round((float) $calculated->net_balance, 2);

            if ($liveBalance <= 0.01) {
                $note->update(['status' => 'FULFILLED', 'resolved_at' => now()]);
            } elseif ($liveBalance !== round((float) $note->balance_at_time, 2)) {
                $note->update(['balance_at_time' => $liveBalance]);
            }
        }
    }
}
