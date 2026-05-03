<?php
require __DIR__ . '/vendor/autoload.php';
$app = require __DIR__ . '/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\Transaction;
use App\Models\Entity;
use App\Models\Ledger;

echo "=== Repair Transactions ===\n";
$txs = Transaction::whereIn('category', ['REPAIR_ADVANCE', 'REPAIR_SETTLEMENT'])->latest()->take(10)->get();
foreach ($txs as $t) {
    echo "ID={$t->id} | Name={$t->entity_name} | entity_id={$t->accounting_entity_id} | cat={$t->category} | amount={$t->amount}\n";
}

echo "\n=== All Transactions with NULL entity ===\n";
$nulls = Transaction::whereNull('accounting_entity_id')->whereNotNull('entity_name')->take(10)->get();
foreach ($nulls as $t) {
    echo "ID={$t->id} | Name={$t->entity_name} | cat={$t->category}\n";
}

echo "\n=== Entities count: " . Entity::count() . " ===\n";
echo "=== Ledger entries count: " . Ledger::count() . " ===\n";

echo "\n=== Recent Ledger entries ===\n";
$ledgers = Ledger::with('entity')->latest()->take(5)->get();
foreach ($ledgers as $l) {
    echo "entity={$l->entity?->name} | type={$l->voucher_type} | dr={$l->debit} | cr={$l->credit} | date={$l->date}\n";
}
