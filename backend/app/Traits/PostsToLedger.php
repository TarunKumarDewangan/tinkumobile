<?php

namespace App\Traits;

use App\Models\Entity;
use App\Services\AccountingService;

trait PostsToLedger
{
    public static function bootPostsToLedger()
    {
        static::created(function ($model) {
            $model->postToLedger();
        });

        static::updated(function ($model) {
            $model->postToLedger();
        });

        static::deleted(function ($model) {
            $model->removeFromLedger();
        });
    }

    public function postToLedger()
    {
        $data = $this->getLedgerData();
        if (!$data) {
            return;
        }

        // If it's a single associative array, wrap it in an array
        $entries = isset($data['entity_id']) ? [$data] : $data;

        $validEntityIds = [];
        foreach ($entries as $entry) {
            if (!isset($entry['entity_id']) || !$entry['entity_id']) continue;
            $validEntityIds[] = $entry['entity_id'];

            app(AccountingService::class)->post(
                entityId: $entry['entity_id'],
                date: $entry['date'],
                voucherType: $entry['voucher_type'],
                voucherId: $this->id,
                particulars: $entry['particulars'],
                debit: $entry['debit'] ?? 0,
                credit: $entry['credit'] ?? 0,
                shopId: $entry['shop_id'] ?? null,
                userId: $entry['user_id'] ?? null
            );
        }

        // Clean up stale entries (e.g. if the customer or forwarded shop changed)
        if (!empty($validEntityIds)) {
            $firstEntry = $entries[0];
            if (isset($firstEntry['voucher_type'])) {
                \App\Models\Ledger::where('voucher_type', $firstEntry['voucher_type'])
                    ->where('voucher_id', $this->id)
                    ->whereNotIn('entity_id', $validEntityIds)
                    ->delete();
            }
        }
    }

    public function removeFromLedger()
    {
        $data = $this->getLedgerData();
        if ($data) {
            app(AccountingService::class)->remove($data['voucher_type'], $this->id);
        }
    }

    /**
     * Must be implemented by the model.
     * Returns array (single entry): ['entity_id', 'date', 'voucher_type', 'particulars', 'debit', 'credit', 'shop_id', 'user_id']
     * OR array of entries: [['entity_id' => ...], ['entity_id' => ...]]
     */
    abstract protected function getLedgerData(): ?array;
}
