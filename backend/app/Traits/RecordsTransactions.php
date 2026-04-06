<?php

namespace App\Traits;

use App\Models\Transaction;
use Illuminate\Support\Facades\Auth;

trait RecordsTransactions
{
    /**
     * Record an incoming or outgoing money transaction.
     */
    public function recordTransaction(array $data)
    {
        return Transaction::create([
            'shop_id'          => $data['shop_id'] ?? $this->shop_id ?? Auth::user()->shop_id,
            'user_id'          => Auth::id() ?? $data['user_id'] ?? 1,
            'type'             => $data['type'], // IN or OUT
            'category'         => $data['category'], // SALE, PURCHASE, etc.
            'amount'           => $data['amount'],
            'payment_mode'     => $data['payment_mode'] ?? 'CASH',
            'entity_type'      => $data['entity_type'] ?? get_class($this),
            'entity_id'        => $data['entity_id'] ?? $this->id,
            'description'      => $data['description'] ?? null,
            'ref_id'           => $data['ref_id'] ?? null,
            'transaction_date' => $data['transaction_date'] ?? now()->toDateString(),
        ]);
    }
}
