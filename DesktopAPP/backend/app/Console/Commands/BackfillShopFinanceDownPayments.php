<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\SaleFinancePlan;
use App\Models\Transaction;
use App\Models\Ledger;
use App\Models\Entity;
use App\Services\TransactionService;
use App\Services\AccountingService;

/**
 * Shop Finance (Personal EMI / Favor) plans had two things missing from the
 * Ledger, both fixed going forward in SaleInvoiceController — this command
 * corrects existing plans created before that fix:
 *
 *   1. The down payment (real cash received) was never posted at all, so
 *      the customer's ledger balance overstated their debt by that amount.
 *   2. For Personal (EMI) plans, the interest portion of total_payable
 *      (on top of the principal) was never posted either, so the ledger
 *      balance understated what they'll actually repay under the EMI
 *      schedule — this is why Pending Balance/Entity Ledger could show a
 *      different number than Finance Tracker for the same customer.
 */
class BackfillShopFinanceDownPayments extends Command
{
    protected $signature = 'finance:backfill-down-payments {--dry-run : Show what would be posted without writing anything}';
    protected $description = 'Post the missing Ledger entries (down payment + EMI interest) for existing Shop Finance plans.';

    public function handle(TransactionService $transactionService, AccountingService $accounting)
    {
        $dryRun = $this->option('dry-run');

        $plans = SaleFinancePlan::with('saleInvoice.customer')->get();
        $this->info("Found {$plans->count()} Shop Finance plan(s) total.");

        $downPaymentsPosted = 0;
        $downPaymentsSkipped = 0;
        $interestPosted = 0;
        $interestSkipped = 0;

        foreach ($plans as $plan) {
            $invoice = $plan->saleInvoice;
            if (!$invoice) {
                $this->warn("Plan #{$plan->id}: no linked sale invoice, skipping entirely.");
                continue;
            }

            // ── 1. Down payment ──────────────────────────────────────────
            $downPayment = (float) $plan->down_payment;
            if ($downPayment > 0) {
                $alreadyPosted = Transaction::where('entity_type', get_class($invoice))
                    ->where('entity_id', $invoice->id)
                    ->where('category', 'SHOP_FINANCE_DOWN_PAYMENT')
                    ->exists();

                if ($alreadyPosted) {
                    $downPaymentsSkipped++;
                } else {
                    $this->line("Invoice #{$invoice->invoice_no}: posting down payment ₹" . number_format($downPayment, 2));
                    if (!$dryRun) {
                        $transactionService->recordForModel($invoice, [
                            'type'        => 'IN',
                            'category'    => 'SHOP_FINANCE_DOWN_PAYMENT',
                            'amount'      => $downPayment,
                            'description' => "Shop Finance down payment for Invoice #{$invoice->invoice_no}",
                        ]);
                    }
                    $downPaymentsPosted++;
                }
            }

            // ── 2. EMI interest (Personal plans only) ────────────────────
            if ($plan->type === 'PERSONAL') {
                $interestPortion = max(0, (float) $plan->total_payable - (float) $plan->principal);
                if ($interestPortion > 0) {
                    $alreadyPosted = Ledger::where('voucher_type', 'SHOP_FINANCE_INTEREST')
                        ->where('voucher_id', $invoice->id)
                        ->exists();

                    if ($alreadyPosted) {
                        $interestSkipped++;
                    } else {
                        $entity = $invoice->accounting_entity_id
                            ? Entity::find($invoice->accounting_entity_id)
                            : ($invoice->customer ? Entity::where('name', $invoice->customer->name)->first() : null);

                        if ($entity) {
                            $this->line("Invoice #{$invoice->invoice_no}: posting interest ₹" . number_format($interestPortion, 2));
                            if (!$dryRun) {
                                $accounting->post(
                                    $entity->id,
                                    $invoice->sale_date,
                                    'SHOP_FINANCE_INTEREST',
                                    $invoice->id,
                                    "Shop Finance interest for Invoice #{$invoice->invoice_no}",
                                    $interestPortion,
                                    0,
                                    $invoice->shop_id,
                                    $plan->created_by
                                );
                            }
                            $interestPosted++;
                        } else {
                            $this->warn("Invoice #{$invoice->invoice_no}: no entity found for customer, skipping interest post.");
                        }
                    }
                }
            }
        }

        $verb = $dryRun ? 'would be posted' : 'posted';
        $this->info("✅ Done. Down payments: {$downPaymentsPosted} {$verb}, {$downPaymentsSkipped} already done. Interest: {$interestPosted} {$verb}, {$interestSkipped} already done.");
    }
}
