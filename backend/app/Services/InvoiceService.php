<?php

namespace App\Services;

class InvoiceService
{
    /**
     * Calculate invoice totals including GST, discounts, and rounding.
     */
    public function calculateTotals(array $items, array $data)
    {
        $totalAmount = collect($items)->sum(fn($i) => ($i['quantity'] ?? 1) * ($i['unit_price'] ?? 0));
        
        $discount    = (float) ($data['discount'] ?? 0);
        $cashDiscount = (float) ($data['cash_discount'] ?? 0);
        $isCashDiscOnBill = (bool) ($data['is_cash_discount_on_bill'] ?? true);
        $calculateGst = (bool) ($data['calculate_gst'] ?? true);
        
        $cgstRate = 0;
        $sgstRate = 0;
        $cgstAmount = 0;
        $sgstAmount = 0;

        if ($calculateGst) {
            $cgstRate = (float) ($data['cgst_rate'] ?? 9);
            $sgstRate = (float) ($data['sgst_rate'] ?? 9);
            $cgstAmount = ($totalAmount * $cgstRate) / 100;
            $sgstAmount = ($totalAmount * $sgstRate) / 100;
        }

        $roundingMode = $data['rounding_mode'] ?? 'auto';
        $rawGrandTotal = $totalAmount + $cgstAmount + $sgstAmount - $discount;
        
        if ($isCashDiscOnBill) {
            $rawGrandTotal -= $cashDiscount;
        }

        $grandTotal = $this->applyRounding($rawGrandTotal, $roundingMode);

        return [
            'total_amount'  => $totalAmount,
            'cgst_rate'     => $cgstRate,
            'sgst_rate'     => $sgstRate,
            'cgst_amount'   => $cgstAmount,
            'sgst_amount'   => $sgstAmount,
            'discount'      => $discount,
            'cash_discount' => $cashDiscount,
            'grand_total'   => $grandTotal,
            'rounding_mode' => $roundingMode,
            'calculate_gst' => $calculateGst,
            'is_cash_discount_on_bill' => $isCashDiscOnBill,
        ];
    }

    /**
     * Apply rounding based on mode.
     */
    public function applyRounding($amount, $mode)
    {
        if ($mode === 'up') return ceil($amount);
        if ($mode === 'down') return floor($amount);
        return round($amount);
    }
}
