<?php

namespace App\Services;

use App\Models\Ledger;
use App\Models\Entity;
use Illuminate\Support\Facades\DB;

class AccountingService
{
    /**
     * Post a debit or credit to the ledger.
     */
    public function post(
        $entityId, 
        $date, 
        $voucherType, 
        $voucherId, 
        $particulars, 
        $debit = 0, 
        $credit = 0, 
        $shopId = null, 
        $userId = null
    ) {
        if (!$entityId || ($debit == 0 && $credit == 0)) return null;

        // If an entry already exists for this exact voucher, update it.
        $ledger = Ledger::where('voucher_type', $voucherType)
            ->where('voucher_id', $voucherId)
            ->where('entity_id', $entityId)
            ->first();

        if ($ledger) {
            $ledger->update([
                'date' => $date,
                'particulars' => $particulars,
                'debit' => $debit,
                'credit' => $credit,
                'shop_id' => $shopId ?? $ledger->shop_id,
                'user_id' => $userId ?? $ledger->user_id,
            ]);
            return $ledger;
        }

        return Ledger::create([
            'entity_id' => $entityId,
            'shop_id' => $shopId,
            'user_id' => $userId,
            'date' => $date,
            'voucher_type' => $voucherType,
            'voucher_id' => $voucherId,
            'particulars' => $particulars,
            'debit' => $debit,
            'credit' => $credit,
        ]);
    }

    /**
     * Delete a ledger posting.
     */
    public function remove($voucherType, $voucherId)
    {
        Ledger::where('voucher_type', $voucherType)->where('voucher_id', $voucherId)->delete();
    }

    /**
     * Calculate closing balance for an entity dynamically.
     * Returns: Positive for Receivable (Dr), Negative for Payable (Cr).
     */
    public function getClosingBalance(Entity $entity, $upToDate = null)
    {
        $opening = ($entity->balance_type === 'RECEIVABLE' ? 1 : -1) * (float)$entity->opening_balance;
        
        $query = Ledger::where('entity_id', $entity->id);
        if ($upToDate) {
            $query->where('date', '<=', $upToDate);
        }

        $totals = $query->selectRaw('SUM(debit) as dr, SUM(credit) as cr')->first();
        
        $netMovements = (float)($totals->dr ?? 0) - (float)($totals->cr ?? 0);

        return $opening + $netMovements;
    }
}
