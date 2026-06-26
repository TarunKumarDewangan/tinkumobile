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
        $this->info('Auto-generating missing repair payment transactions...');
        $this->backfillRepairTransactions();

        $this->info('Resolving and backfilling transaction entities...');
        $this->backfillTransactionEntities();

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

    private function backfillRepairTransactions()
    {
        $repairs = RepairRequest::all();
        $createdCount = 0;

        foreach ($repairs as $repair) {
            $entity = null;
            if ($repair->customer_name) {
                $entity = \App\Models\Entity::firstOrCreate(
                    ['name' => $repair->customer_name],
                    [
                        'type' => 'CUSTOMER',
                        'phone' => $repair->customer_phone,
                        'email' => $repair->customer_email,
                        'opening_balance' => 0,
                        'balance_type' => 'RECEIVABLE',
                    ]
                );
            }

            // 1. Advance Payment Transaction
            if ($repair->advance_amount > 0) {
                $exists = Transaction::where('entity_type', RepairRequest::class)
                    ->where('entity_id', $repair->id)
                    ->where('category', 'REPAIR_ADVANCE')
                    ->exists();

                if (!$exists) {
                    Transaction::create([
                        'shop_id' => $repair->shop_id ?? 1,
                        'user_id' => $repair->staff_id ?? 1,
                        'transaction_date' => $repair->submitted_date ?? now()->toDateString(),
                        'type' => 'IN',
                        'category' => 'REPAIR_ADVANCE',
                        'amount' => $repair->advance_amount,
                        'payment_mode' => $repair->advance_payment_mode ?? 'CASH',
                        'description' => "Advance for repair: {$repair->device_model} (Inv: #{$repair->id})",
                        'entity_type' => RepairRequest::class,
                        'entity_id' => $repair->id,
                        'entity_name' => $repair->customer_name,
                        'accounting_entity_id' => $entity ? $entity->id : null,
                    ]);
                    $createdCount++;
                }
            }

            // 2. Balance Settlement Transaction
            if ($repair->balance_amount_received > 0) {
                $exists = Transaction::where('entity_type', RepairRequest::class)
                    ->where('entity_id', $repair->id)
                    ->where('category', 'REPAIR_SETTLEMENT')
                    ->exists();

                if (!$exists) {
                    Transaction::create([
                        'shop_id' => $repair->shop_id ?? 1,
                        'user_id' => $repair->staff_id ?? 1,
                        'transaction_date' => $repair->balance_received_at ?? $repair->actual_delivery_date ?? $repair->submitted_date ?? now()->toDateString(),
                        'type' => 'IN',
                        'category' => 'REPAIR_SETTLEMENT',
                        'amount' => $repair->balance_amount_received,
                        'payment_mode' => $repair->balance_payment_mode ?? 'CASH',
                        'description' => "Balance collected for repair: {$repair->device_model} (Inv: #{$repair->id})",
                        'entity_type' => RepairRequest::class,
                        'entity_id' => $repair->id,
                        'entity_name' => $repair->customer_name,
                        'accounting_entity_id' => $entity ? $entity->id : null,
                    ]);
                    $createdCount++;
                }
            }
        }

        $this->info("Generated {$createdCount} missing repair payment transactions.");
    }

    private function backfillTransactionEntities()
    {
        $transactions = Transaction::whereNull('accounting_entity_id')->get();
        $linkedCount = 0;

        foreach ($transactions as $tx) {
            $entityId = null;

            // 1. Try resolving using polymorphic relationship
            if ($tx->entity_type && $tx->entity_id) {
                $related = $tx->entity;
                if ($related) {
                    if ($tx->entity_type === RepairRequest::class) {
                        $entityName = $related->customer_name;
                        if ($entityName) {
                            $entity = \App\Models\Entity::where('name', $entityName)->first();
                            if (!$entity) {
                                $cleanName = preg_replace('/\s*\(.*?\)\s*/', '', $entityName);
                                $entity = \App\Models\Entity::where('name', $cleanName)
                                    ->orWhere('name', 'like', $cleanName . ' %')
                                    ->first();
                            }
                            if ($entity) $entityId = $entity->id;
                        }
                    } elseif (method_exists($related, 'customer') && $related->customer) {
                        $entityId = $related->customer->id;
                    } elseif (isset($related->accounting_entity_id) && $related->accounting_entity_id) {
                        $entityId = $related->accounting_entity_id;
                    }
                }
            }

            // 2. Try resolving using entity_name
            if (!$entityId && $tx->entity_name) {
                $entity = \App\Models\Entity::where('name', $tx->entity_name)->first();
                if (!$entity) {
                    $cleanName = preg_replace('/\s*\(.*?\)\s*/', '', $tx->entity_name);
                    $entity = \App\Models\Entity::where('name', $cleanName)
                        ->orWhere('name', 'like', $cleanName . ' %')
                        ->first();
                }

                if ($entity) {
                    $entityId = $entity->id;
                } else {
                    $entity = \App\Models\Entity::create([
                        'name' => $tx->entity_name,
                        'type' => 'CUSTOMER',
                        'opening_balance' => 0,
                        'balance_type' => 'RECEIVABLE',
                    ]);
                    $entityId = $entity->id;
                }
            }

            if ($entityId) {
                $tx->accounting_entity_id = $entityId;
                $tx->save();
                $linkedCount++;
            }
        }

        $this->info("Linked {$linkedCount} orphan transactions to their entities.");
    }
}
