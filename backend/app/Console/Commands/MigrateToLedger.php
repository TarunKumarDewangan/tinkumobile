<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Ledger;
use App\Models\AirtelDrop;
use App\Models\RepairRequest;
use App\Models\SaleInvoice;
use App\Models\PurchaseInvoice;
use App\Models\Transaction;

class MigrateToLedger extends Command
{
    protected $signature = 'ledger:migrate';
    protected $description = 'Migrate all historical transactions and invoices into the unified ledger';

    public function handle()
    {
        $this->info('Truncating ledgers table...');
        Ledger::truncate();

        $this->info('Migrating Airtel Drops...');
        AirtelDrop::chunk(100, function ($drops) {
            foreach ($drops as $drop) $drop->postToLedger();
        });

        $this->info('Migrating Repair Requests...');
        RepairRequest::chunk(100, function ($repairs) {
            foreach ($repairs as $repair) $repair->postToLedger();
        });

        $this->info('Migrating Sale Invoices...');
        SaleInvoice::chunk(100, function ($sales) {
            foreach ($sales as $sale) $sale->postToLedger();
        });

        $this->info('Migrating Purchase Invoices...');
        PurchaseInvoice::chunk(100, function ($purchases) {
            foreach ($purchases as $purchase) $purchase->postToLedger();
        });

        $this->info('Migrating Transactions...');
        Transaction::chunk(100, function ($transactions) {
            foreach ($transactions as $transaction) $transaction->postToLedger();
        });

        $this->info('Migration complete!');
    }
}
