<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

use App\Traits\RecordsTransactions;
use App\Traits\PostsToLedger;

class RechargeSale extends Model
{
    use RecordsTransactions, PostsToLedger, \App\Traits\MirrorsToSupabase;
    protected $fillable = ['shop_id', 'customer_id', 'mobile_number', 'operator', 'amount', 'selling_price', 'sale_date', 'user_id'];

    public function shop(): BelongsTo { return $this->belongsTo(Shop::class); }
    public function customer(): BelongsTo { return $this->belongsTo(Customer::class); }
    public function user(): BelongsTo { return $this->belongsTo(User::class); }

    protected function getLedgerData(): ?array
    {
        $customer = $this->customer;
        if (!$customer) return null;

        $entity = \App\Models\Entity::where('name', $customer->name)->first();
        if (!$entity) return null;

        return [
            'entity_id' => $entity->id,
            'date' => $this->sale_date,
            'voucher_type' => 'SALE',
            'particulars' => "Recharge sale: {$this->operator} for {$this->mobile_number}",
            'debit' => $this->selling_price,
            'credit' => 0,
            'user_id' => $this->user_id,
            'shop_id' => $this->shop_id,
        ];
    }
}
