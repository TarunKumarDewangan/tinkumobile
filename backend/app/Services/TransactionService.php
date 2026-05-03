<?php

namespace App\Services;

use App\Models\Transaction;
use Illuminate\Support\Facades\DB;

class TransactionService
{
    /**
     * Record a manual settlement or payment for an entity.
     */
    public function recordSettlement(array $data)
    {
        return Transaction::create([
            'shop_id' => $data['shop_id'],
            'user_id' => $data['user_id'],
            'transaction_date' => now()->toDateString(),
            'type' => $data['type'], // IN or OUT
            'category' => $data['category'] ?? 'ENTITY_SETTLEMENT',
            'amount' => $data['amount'],
            'payment_mode' => $data['payment_mode'],
            'description' => $data['description'] ?? null,
            'entity_name' => $data['entity_name'],
            'accounting_entity_id' => $data['accounting_entity_id'] ?? null,
        ]);
    }

    /**
     * Record a transaction linked to a specific model (e.g., Sale, Repair).
     */
    public function recordForModel($model, array $overrideData = [])
    {
        $shopId = $overrideData['shop_id'] ?? $model->shop_id ?? (auth()->check() ? auth()->user()->shop_id : null);
        if (!$shopId) {
            $shopId = \App\Models\Shop::first()->id ?? 1;
        }

        $data = array_merge([
            'shop_id' => $shopId,
            'user_id' => $model->user_id ?? auth()->id(),
            'transaction_date' => $model->sale_date ?? $model->purchase_date ?? $model->submitted_date ?? now()->toDateString(),
            'amount' => $model->total_paid ?? $model->amount ?? 0,
            'payment_mode' => strtoupper($model->payment_method ?? $model->payment_mode ?? 'CASH'),
            'entity_type' => get_class($model),
            'entity_id' => $model->id,
            'accounting_entity_id' => $model->accounting_entity_id ?? null,
            'entity_name' => $model->customer_name ?? $model->supplier_name ?? $model->name ?? null,
        ], $overrideData);

        return Transaction::create($data);
    }
}
