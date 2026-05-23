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
            $this->removeStaleLedgerEntries();
            return;
        }

        // If it's a single associative array, wrap it in an array
        $entries = isset($data['entity_id']) ? [$data] : $data;

        $validEntityIds = [];
        $voucherTypes = [];
        foreach ($entries as $entry) {
            if (!isset($entry['entity_id']) || !$entry['entity_id']) continue;
            $validEntityIds[] = $entry['entity_id'];
            if (isset($entry['voucher_type'])) {
                $voucherTypes[] = $entry['voucher_type'];
            }

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
        $voucherTypes = array_unique($voucherTypes);
        if (!empty($voucherTypes)) {
            $query = \App\Models\Ledger::whereIn('voucher_type', $voucherTypes)
                ->where('voucher_id', $this->id);
            if (!empty($validEntityIds)) {
                $query->whereNotIn('entity_id', $validEntityIds);
            }
            $query->delete();
        }
    }

    public function removeFromLedger()
    {
        $this->removeStaleLedgerEntries();
    }

    public function removeStaleLedgerEntries()
    {
        $types = $this->getPossibleVoucherTypes();
        if (!empty($types)) {
            \App\Models\Ledger::whereIn('voucher_type', $types)
                ->where('voucher_id', $this->id)
                ->delete();
        }
    }

    protected function getPossibleVoucherTypes(): array
    {
        $class = get_class($this);
        switch ($class) {
            case \App\Models\Transaction::class:
                return ['RECEIPT', 'PAYMENT'];
            case \App\Models\SaleInvoice::class:
                return ['SALE', 'SALE_FINANCE', 'FINANCE_PENDING'];
            case \App\Models\PurchaseInvoice::class:
                return ['PURCHASE'];
            case \App\Models\RepairRequest::class:
                return ['REPAIR'];
            case \App\Models\AirtelDrop::class:
                return ['AIRTEL_DROP'];
            case \App\Models\AirtelRecovery::class:
                return ['AIRTEL_RECOVERY'];
            default:
                $data = $this->getLedgerData();
                if ($data) {
                    $entries = isset($data['entity_id']) ? [$data] : $data;
                    return array_unique(array_filter(array_column($entries, 'voucher_type')));
                }
                return [];
        }
    }

    /**
     * Must be implemented by the model.
     * Returns array (single entry): ['entity_id', 'date', 'voucher_type', 'particulars', 'debit', 'credit', 'shop_id', 'user_id']
     * OR array of entries: [['entity_id' => ...], ['entity_id' => ...]]
     */
    abstract protected function getLedgerData(): ?array;
}
