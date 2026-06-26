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
        $shopId = $data['shop_id'] ?? null;
        if (!$shopId) {
            $shopId = isset($this->shop_id) ? $this->shop_id : (Auth::user()?->shop_id ?? 1);
        }

        return Transaction::create([
            'shop_id'          => $shopId,
            'user_id'          => Auth::id() ?? $data['user_id'] ?? 1,
            'type'             => $data['type'],
            'category'         => $data['category'],
            'amount'           => $data['amount'],
            'payment_mode'     => $data['payment_mode'] ?? 'CASH',
            'entity_type'      => $data['entity_type'] ?? (isset($this->id) ? get_class($this) : null),
            'entity_id'        => $data['entity_id'] ?? ($this->id ?? null),
            'entity_name'      => $data['entity_name'] ?? null,
            'description'      => $data['description'] ?? null,
            'ref_id'           => $data['ref_id'] ?? null,
            'transaction_date' => $data['transaction_date'] ?? now()->toDateString(),
        ]);
    }
}
