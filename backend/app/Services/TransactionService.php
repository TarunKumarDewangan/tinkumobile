<?php

namespace App\Services;

use App\Models\Transaction;
use Illuminate\Support\Facades\DB;

class TransactionService
{
    /**
     * Shared guard for every controller accepting an optional payment_lines
     * split — true if the lines add up to the total (within rounding),
     * or if there are no lines to check.
     */
    public static function paymentLinesSumMatches(?array $lines, float $total): bool
    {
        if (empty($lines)) {
            return true;
        }
        return abs(array_sum(array_column($lines, 'amount')) - $total) <= 0.01;
    }

    /**
     * Record a manual settlement or payment for an entity. Pass
     * $data['payment_lines'] (array of ['payment_mode' => ..., 'amount' => ...])
     * to split the same total across more than one mode (e.g. half cash,
     * half UPI) — each line becomes its own Transaction row and dual-posts
     * independently.
     */
    public function recordSettlement(array $data)
    {
        $base = [
            'shop_id' => $data['shop_id'],
            'user_id' => $data['user_id'],
            'transaction_date' => $data['transaction_date'] ?? now()->toDateString(),
            'type' => $data['type'], // IN or OUT
            'category' => $data['category'] ?? 'ENTITY_SETTLEMENT',
            'description' => $data['description'] ?? null,
            'entity_name' => $data['entity_name'],
            'accounting_entity_id' => $data['accounting_entity_id'] ?? null,
        ];

        $paymentLines = $data['payment_lines'] ?? null;
        if (is_array($paymentLines) && count($paymentLines) > 1) {
            return $this->createSplitTransactions($base, $paymentLines);
        }

        $transaction = Transaction::create($base + [
            'amount' => $data['amount'],
            'payment_mode' => $data['payment_mode'],
        ]);

        $this->maybeDualPostToBank($transaction);

        return $transaction;
    }

    /**
     * Record a transaction linked to a specific model (e.g., Sale, Repair).
     * Also auto-creates an Entity record if one doesn't exist for the party,
     * so the payment appears in the Entity Manager / Ledger. Pass
     * $overrideData['payment_lines'] (array of ['payment_mode' => ...,
     * 'amount' => ...]) to split the same total across more than one mode —
     * each line becomes its own Transaction row and dual-posts independently.
     */
    public function recordForModel($model, array $overrideData = [])
    {
        $paymentLines = $overrideData['payment_lines'] ?? null;
        unset($overrideData['payment_lines']);

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

        if (is_array($paymentLines) && count($paymentLines) > 1) {
            $base = $data;
            unset($base['amount'], $base['payment_mode']);
            return $this->createSplitTransactions($base, $paymentLines);
        }

        $transaction = Transaction::create($data);

        $this->maybeDualPostToBank($transaction);

        return $transaction;
    }

    /**
     * Create one Transaction per payment line (e.g. half cash, half UPI),
     * each dual-posting to its own matching Bank/Card/UPI/Cash-Counter
     * entity independently. $base carries every shared field except
     * amount/payment_mode, which come from each line.
     */
    protected function createSplitTransactions(array $base, array $paymentLines): array
    {
        $created = [];
        foreach ($paymentLines as $line) {
            $transaction = Transaction::create($base + [
                'amount' => $line['amount'],
                'payment_mode' => strtoupper($line['payment_mode']),
            ]);
            $this->maybeDualPostToBank($transaction);
            $created[] = $transaction;
        }
        return $created;
    }

    /**
     * If a transaction's payment mode matches the name of an existing
     * Bank/Card/UPI/Cash Counter entity, mirror it as a second transaction
     * against that account so its balance reflects real money flow. Marked
     * as an internal transfer so cash/bank collection reports don't
     * double-count it — the money already appears once against the
     * customer/supplier/party.
     */
    protected function maybeDualPostToBank(Transaction $transaction): void
    {
        if ($transaction->is_internal_transfer || empty($transaction->payment_mode)) {
            return;
        }

        $bank = \App\Models\Entity::whereRaw('LOWER(name) = ?', [strtolower(trim($transaction->payment_mode))])->first();

        if (!$bank || !\App\Models\Entity::isAssetType($bank->type) || $bank->id === $transaction->accounting_entity_id) {
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
            'mirror_of_transaction_id' => $transaction->id,
        ]);
    }

    /**
     * Create one standalone Transaction (not tied to a model) and dual-post
     * it — used by the manual Cashbook income/expense entry, which has no
     * underlying model to attach to like Sales/Purchases/Repairs do.
     */
    public function postSingle(array $data): Transaction
    {
        $transaction = Transaction::create($data);
        $this->maybeDualPostToBank($transaction);
        return $transaction;
    }

    /**
     * Update a standalone Transaction and re-sync its dual-posted mirror(s):
     * the old mirror(s) are removed and a fresh one is posted for the new
     * amount/mode, since a plain ->update() can't move a mirror between
     * bank entities or resize it correctly.
     */
    public function resyncSingle(Transaction $transaction, array $data): Transaction
    {
        Transaction::where('mirror_of_transaction_id', $transaction->id)->get()->each->delete();
        $transaction->update($data);
        $this->maybeDualPostToBank($transaction->fresh());
        return $transaction->fresh();
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
