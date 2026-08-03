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
        $transaction = Transaction::create([
            'shop_id' => $data['shop_id'],
            'user_id' => $data['user_id'],
            'transaction_date' => $data['transaction_date'] ?? now()->toDateString(),
            'type' => $data['type'], // IN or OUT
            'category' => $data['category'] ?? 'ENTITY_SETTLEMENT',
            'amount' => $data['amount'],
            'payment_mode' => $data['payment_mode'],
            'description' => $data['description'] ?? null,
            'entity_name' => $data['entity_name'],
            'accounting_entity_id' => $data['accounting_entity_id'] ?? null,
        ]);

        $this->maybeDualPostToBank($transaction);

        return $transaction;
    }

    /**
     * Record a transaction linked to a specific model (e.g., Sale, Repair).
     * Also auto-creates an Entity record if one doesn't exist for the party,
     * so the payment appears in the Entity Manager / Ledger.
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
            'entity_name' => $model->customer?->name ?? $model->supplier?->name ?? $model->customer_name ?? $model->name ?? $overrideData['entity_name'] ?? null,
        ], $overrideData);

        // Auto-create an Entity if one doesn't exist for this person,
        // so the payment flows into the Entity Manager / Ledger automatically.
        if (!empty($data['entity_name']) && empty($data['accounting_entity_id'])) {
            $entity = \App\Models\Entity::firstOrCreate(
                ['name' => $data['entity_name']],
                [
                    'type'            => $this->guessEntityType($model),
                    'phone'           => $model->customer_phone ?? $model->phone ?? null,
                    'email'           => $model->customer_email ?? $model->email ?? null,
                    'opening_balance' => 0,
                    'balance_type'    => 'RECEIVABLE',
                ]
            );
            $data['accounting_entity_id'] = $entity->id;
        }

        $transaction = Transaction::create($data);

        $this->maybeDualPostToBank($transaction);

        return $transaction;
    }

    /**
     * If a transaction's payment mode matches the name of an existing
     * Bank/Card/UPI entity, mirror it as a second transaction against that
     * bank so its balance reflects real money flow. Marked as an internal
     * transfer so cash/bank collection reports don't double-count it — the
     * money already appears once against the customer/supplier/party.
     */
    protected function maybeDualPostToBank(Transaction $transaction): void
    {
        if ($transaction->is_internal_transfer || empty($transaction->payment_mode)) {
            return;
        }

        $bank = \App\Models\Entity::whereIn('type', ['BANK', 'CARD', 'UPI'])
            ->whereRaw('LOWER(name) = ?', [strtolower(trim($transaction->payment_mode))])
            ->first();

        if (!$bank || $bank->id === $transaction->accounting_entity_id) {
            return;
        }

        Transaction::create([
            'shop_id' => $transaction->shop_id,
            'user_id' => $transaction->user_id,
            'transaction_date' => $transaction->transaction_date,
            'type' => $transaction->type,
            'category' => $transaction->category,
            'amount' => $transaction->amount,
            'payment_mode' => $transaction->payment_mode,
            'description' => 'Auto-posted: ' . ($transaction->entity_name ?? 'Party') . ' — ' . ($transaction->description ?? $transaction->category),
            'entity_name' => $bank->name,
            'accounting_entity_id' => $bank->id,
            'is_internal_transfer' => true,
        ]);
    }

    /**
     * Guess the entity type based on the model class.
     */
    protected function guessEntityType($model): string
    {
        $class = class_basename($model);
        return match($class) {
            'RepairRequest'   => 'CUSTOMER',
            'SaleInvoice'     => 'CUSTOMER',
            'PurchaseInvoice' => 'SUPPLIER',
            'AirtelDrop'      => 'RETAILER',
            'OldMobilePurchase' => 'CUSTOMER',
            default           => 'OTHER',
        };
    }

}
