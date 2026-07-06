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

    /**
     * Calculate GST/discount totals for tax-INCLUSIVE item pricing (sales:
     * unit_price is the customer-facing selling price, GST is backed out of
     * it). This is a different pricing model from calculateTotals() above,
     * which treats unit_price as tax-EXCLUSIVE (purchases: GST is added on
     * top of the supplier cost) — the two are not interchangeable, so this
     * is kept as a separate method rather than merged into one.
     *
     * Moved here unchanged from SaleInvoiceController's private
     * calculateGst() so both store() and update() share one implementation
     * instead of a second, drift-prone copy.
     */
    public function calculateInclusiveTotals(array $data, array $items): array
    {
        $discount         = (float) ($data['discount'] ?? 0);
        $cashDiscount     = (float) ($data['cash_discount'] ?? 0);
        $isCashDiscOnBill = (bool) ($data['is_cash_discount_on_bill'] ?? true);
        $calculateGst     = (bool) ($data['calculate_gst'] ?? true);
        $inclusiveTotal   = collect($items)->sum(fn($i) => ($i['quantity'] ?? 1) * ($i['unit_price'] ?? 0));

        if ($calculateGst) {
            $cgstRate = (float) ($data['cgst_rate'] ?? 9);
            $sgstRate = (float) ($data['sgst_rate'] ?? 9);

            if (isset($data['is_gst_manual']) && $data['is_gst_manual'] && isset($data['cgst_amount']) && isset($data['sgst_amount'])) {
                $cgstAmount  = (float) $data['cgst_amount'];
                $sgstAmount  = (float) $data['sgst_amount'];
                $totalAmount = $inclusiveTotal - $cgstAmount - $sgstAmount;
            } else {
                $taxableInclusiveTotal = collect($items)->sum(function($i) {
                    $applyGst = !isset($i['apply_gst']) || filter_var($i['apply_gst'], FILTER_VALIDATE_BOOLEAN);
                    return $applyGst ? (($i['quantity'] ?? 1) * ($i['unit_price'] ?? 0)) : 0;
                });

                $totalGstRate  = $cgstRate + $sgstRate;
                $exclusiveTaxableTotal = $taxableInclusiveTotal / (1 + ($totalGstRate / 100));
                $totalGstAmount = $taxableInclusiveTotal - $exclusiveTaxableTotal;

                $cgstAmount  = $totalGstRate > 0 ? round($totalGstAmount * ($cgstRate / $totalGstRate), 2) : 0;
                $sgstAmount  = $totalGstRate > 0 ? round($totalGstAmount * ($sgstRate / $totalGstRate), 2) : 0;
                $totalAmount = round($inclusiveTotal - $cgstAmount - $sgstAmount, 2);
            }
        } else {
            $cgstRate    = 0;
            $sgstRate    = 0;
            $cgstAmount  = 0;
            $sgstAmount  = 0;
            $totalAmount = $inclusiveTotal;
        }

        $rawGrandTotal = $totalAmount + $cgstAmount + $sgstAmount - $discount;
        if ($isCashDiscOnBill) {
            $rawGrandTotal -= $cashDiscount;
        }

        return [
            'cgst_rate'       => $cgstRate,
            'cgstRate'        => $cgstRate,
            'sgst_rate'       => $sgstRate,
            'sgstRate'        => $sgstRate,
            'cgst_amount'     => $cgstAmount,
            'cgstAmount'      => $cgstAmount,
            'sgst_amount'     => $sgstAmount,
            'sgstAmount'      => $sgstAmount,
            'total_amount'    => $totalAmount,
            'totalAmount'     => $totalAmount,
            'raw_grand_total' => $rawGrandTotal,
            'rawGrandTotal'   => $rawGrandTotal,
            'discount'        => $discount,
            'cash_discount'   => $cashDiscount,
            'cashDiscount'    => $cashDiscount,
            'is_cash_discount_on_bill' => $isCashDiscOnBill,
            'isCashDiscOnBill' => $isCashDiscOnBill,
            'calculate_gst'   => $calculateGst,
            'calculateGst'    => $calculateGst,
        ];
    }
}
