<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Traits\PostsToLedger;

class RechargePurchase extends Model
{
    use PostsToLedger;
    protected $fillable = ['shop_id', 'supplier_id', 'operator', 'amount', 'cost_price', 'purchase_date', 'user_id'];

    public function shop(): BelongsTo { return $this->belongsTo(Shop::class); }
    public function supplier(): BelongsTo { return $this->belongsTo(Supplier::class); }
    public function user(): BelongsTo { return $this->belongsTo(User::class); }

    protected function getLedgerData(): ?array
    {
        $supplier = $this->supplier;
        if (!$supplier) return null;

        $entity = \App\Models\Entity::where('name', $supplier->name)->first();
        if (!$entity) return null;

        return [
            'entity_id' => $entity->id,
            'date' => $this->purchase_date,
            'voucher_type' => 'PURCHASE',
            'particulars' => "Recharge stock purchased: {$this->operator} (Amount: {$this->amount})",
            'debit' => 0,
            'credit' => $this->cost_price,
            'user_id' => $this->user_id,
            'shop_id' => $this->shop_id,
        ];
    }
}
