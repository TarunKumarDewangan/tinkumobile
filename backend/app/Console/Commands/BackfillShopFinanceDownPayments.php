<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\SaleFinancePlan;
use App\Models\Transaction;
use App\Services\TransactionService;

/**
 * Shop Finance (Personal EMI / Favor) down payments were never posted to the
 * Ledger — only the invoice's own SALE debit was, so every such customer's
 * Entity Ledger / net balance overstated what they actually owe by exactly
 * their down payment amount. The forward-going fix is in
 * SaleInvoiceController; this one-time command corrects existing plans.
 */
class BackfillShopFinanceDownPayments extends Command
{
    protected $signature = 'finance:backfill-down-payments {--dry-run : Show what would be posted without writing anything}';
    protected $description = 'Post the missing Ledger credit for existing Shop Finance plans whose down payment was never recorded.';

    public function handle(TransactionService $transactionService)
    {
        $dryRun = $this->option('dry-run');

        $plans = SaleFinancePlan::with('saleInvoice')
            ->where('down_payment', '>', 0)
            ->get();

        $this->info("Found {$plans->count()} Shop Finance plan(s) with a down payment.");

        $posted = 0;
        $skipped = 0;

        foreach ($plans as $plan) {
            $invoice = $plan->saleInvoice;
            if (!$invoice) {
                $this->warn("Plan #{$plan->id}: no linked sale invoice, skipping.");
                $skipped++;
                continue;
            }

            $alreadyPosted = Transaction::where('entity_type', get_class($invoice))
                ->where('entity_id', $invoice->id)
                ->where('category', 'SHOP_FINANCE_DOWN_PAYMENT')
                ->exists();

            if ($alreadyPosted) {
                $skipped++;
                continue;
            }

            $this->line("Invoice #{$invoice->invoice_no}: posting down payment ₹" . number_format((float) $plan->down_payment, 2));

            if (!$dryRun) {
                $transactionService->recordForModel($invoice, [
                    'type'        => 'IN',
                    'category'    => 'SHOP_FINANCE_DOWN_PAYMENT',
                    'amount'      => (float) $plan->down_payment,
                    'description' => "Shop Finance down payment for Invoice #{$invoice->invoice_no}",
                ]);
            }

            $posted++;
        }

        $verb = $dryRun ? 'would be posted' : 'posted';
        $this->info("✅ Done. {$posted} down payment(s) {$verb}, {$skipped} skipped (already posted or no invoice).");
    }
}
