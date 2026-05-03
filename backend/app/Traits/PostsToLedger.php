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
        if (!$data || !isset($data['entity_id']) || !$data['entity_id']) {
            return;
        }

        app(AccountingService::class)->post(
            entityId: $data['entity_id'],
            date: $data['date'],
            voucherType: $data['voucher_type'],
            voucherId: $this->id,
            particulars: $data['particulars'],
            debit: $data['debit'] ?? 0,
            credit: $data['credit'] ?? 0,
            shopId: $data['shop_id'] ?? null,
            userId: $data['user_id'] ?? null
        );
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
     * Returns array: ['entity_id', 'date', 'voucher_type', 'particulars', 'debit', 'credit', 'shop_id', 'user_id']
     */
    abstract protected function getLedgerData(): ?array;
}
