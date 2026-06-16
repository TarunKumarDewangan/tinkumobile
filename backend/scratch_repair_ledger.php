<?php

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;
use App\Models\Entity;
use App\Models\Ledger;
use App\Models\Transaction;
use App\Models\RepairRequest;
use App\Models\SaleInvoice;
use App\Models\PurchaseInvoice;
use App\Models\Loan;
use App\Models\AirtelDrop;

echo "Starting accounting entity alignment and ledger rebuild...\n";

DB::transaction(function() {
    // 1. Repair Purchase Invoices accounting_entity_id
    echo "Syncing purchase_invoices...\n";
    $purchaseInvoices = PurchaseInvoice::all();
    $pCount = 0;
    foreach ($purchaseInvoices as $inv) {
        $supplier = $inv->supplier;
        if ($supplier) {
            $entity = Entity::where('relation_type', \App\Models\Supplier::class)
                ->where('relation_id', $supplier->id)
                ->first();
            if ($entity && $inv->accounting_entity_id !== $entity->id) {
                $inv->accounting_entity_id = $entity->id;
                $inv->saveQuietly();
                $pCount++;
            }
        }
    }
    echo "Updated {$pCount} purchase invoices.\n";

    // 2. Repair Sale Invoices accounting_entity_id
    echo "Syncing sale_invoices...\n";
    $saleInvoices = SaleInvoice::all();
    $sCount = 0;
    foreach ($saleInvoices as $inv) {
        $customer = $inv->customer;
        if ($customer) {
            $entity = Entity::where('relation_type', \App\Models\Customer::class)
                ->where('relation_id', $customer->id)
                ->first();
            if ($entity && $inv->accounting_entity_id !== $entity->id) {
                $inv->accounting_entity_id = $entity->id;
                $inv->saveQuietly();
                $sCount++;
            }
        }
    }
    echo "Updated {$sCount} sale invoices.\n";

    // 3. Repair Repair Requests accounting_entity_id
    echo "Syncing repair_requests...\n";
    $repairRequests = RepairRequest::all();
    $rCount = 0;
    foreach ($repairRequests as $rep) {
        $customer = $rep->customer;
        if ($customer) {
            $entity = Entity::where('relation_type', \App\Models\Customer::class)
                ->where('relation_id', $customer->id)
                ->first();
            if ($entity && $rep->accounting_entity_id !== $entity->id) {
                $rep->accounting_entity_id = $entity->id;
                $rep->saveQuietly();
                $rCount++;
            }
        }
    }
    echo "Updated {$rCount} repair requests.\n";

    // 4. Repair Loans accounting_entity_id
    echo "Syncing loans...\n";
    $loans = Loan::all();
    $lCount = 0;
    foreach ($loans as $loan) {
        $customer = $loan->customer;
        if ($customer) {
            $entity = Entity::where('relation_type', \App\Models\Customer::class)
                ->where('relation_id', $customer->id)
                ->first();
            if ($entity && $loan->accounting_entity_id !== $entity->id) {
                $loan->accounting_entity_id = $entity->id;
                $loan->saveQuietly();
                $lCount++;
            }
        }
    }
    echo "Updated {$lCount} loans.\n";

    // 5. Repair Transactions accounting_entity_id
    echo "Syncing transactions...\n";
    $transactions = Transaction::all();
    $tCount = 0;
    foreach ($transactions as $tx) {
        $entityId = null;

        // Try by explicit polymorphic relation
        if ($tx->entity_type && $tx->entity_id) {
            $entity = Entity::where('relation_type', $tx->entity_type)
                ->where('relation_id', $tx->entity_id)
                ->first();
            if ($entity) {
                $entityId = $entity->id;
            }
        }

        // Try by name matching
        if (!$entityId && $tx->entity_name) {
            $entity = Entity::where('name', $tx->entity_name)->first();
            if (!$entity) {
                $cleanName = preg_replace('/\s*\(.*?\)\s*/', '', $tx->entity_name);
                $entity = Entity::where('name', $cleanName)
                    ->orWhere('name', 'like', $cleanName . ' %')
                    ->first();
            }
            if ($entity) {
                $entityId = $entity->id;
            }
        }

        if ($entityId && $tx->accounting_entity_id !== $entityId) {
            $tx->accounting_entity_id = $entityId;
            $tx->saveQuietly();
            $tCount++;
        }
    }
    echo "Updated {$tCount} transactions.\n";
});

// 6. Truncate ledgers table
echo "Truncating ledgers table...\n";
DB::statement('SET FOREIGN_KEY_CHECKS=0;');
Ledger::truncate();
DB::statement('SET FOREIGN_KEY_CHECKS=1;');

// 7. Migrate all records into the unified ledger
echo "Migrating Airtel Drops to ledger...\n";
AirtelDrop::chunk(100, function ($drops) {
    foreach ($drops as $drop) $drop->postToLedger();
});

echo "Migrating Repair Requests to ledger...\n";
RepairRequest::chunk(100, function ($repairs) {
    foreach ($repairs as $repair) $repair->postToLedger();
});

echo "Migrating Sale Invoices to ledger...\n";
SaleInvoice::chunk(100, function ($sales) {
    foreach ($sales as $sale) $sale->postToLedger();
});

echo "Migrating Purchase Invoices to ledger...\n";
PurchaseInvoice::chunk(100, function ($purchases) {
    foreach ($purchases as $purchase) $purchase->postToLedger();
});

echo "Migrating Transactions to ledger...\n";
Transaction::chunk(100, function ($transactions) {
    foreach ($transactions as $transaction) $transaction->postToLedger();
});

// 8. Re-sync balances
echo "Recalculating all entity balances...\n";
app(\App\Services\EntityService::class)->syncAll();

echo "\nRebuild and alignment completed successfully!\n";
