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
            if (isset($data['is_gst_manual']) && $data['is_gst_manual'] && isset($data['cgst_amount']) && isset($data['sgst_amount'])) {
                $cgstAmount = (float) $data['cgst_amount'];
                $sgstAmount = (float) $data['sgst_amount'];
            } else {
                $gstTaxableTotal = collect($items)->sum(function($i) {
                    $applyGst = !isset($i['apply_gst']) || filter_var($i['apply_gst'], FILTER_VALIDATE_BOOLEAN);
                    return $applyGst ? (($i['quantity'] ?? 1) * ($i['unit_price'] ?? 0)) : 0;
                });
                $cgstAmount = ($gstTaxableTotal * $cgstRate) / 100;
                $sgstAmount = ($gstTaxableTotal * $sgstRate) / 100;
            }
        }

        $roundingMode = $data['rounding_mode'] ?? 'auto';
        $rawGrandTotal = $totalAmount + $cgstAmount + $sgstAmount - $discount;
        
        if ($isCashDiscOnBill) {
            $rawGrandTotal -= $cashDiscount;
        }

        if ($roundingMode === 'manual') {
            $roundOff = (float) ($data['round_off'] ?? 0);
            $grandTotal = $rawGrandTotal + $roundOff;
        } else {
            $grandTotal = $this->applyRounding($rawGrandTotal, $roundingMode);
            $roundOff = $grandTotal - $rawGrandTotal;
        }

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
            'round_off'     => $roundOff,
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
