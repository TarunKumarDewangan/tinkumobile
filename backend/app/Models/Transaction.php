<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

use App\Traits\SyncsBalances;

use App\Traits\PostsToLedger;

class Transaction extends Model
{
    use PostsToLedger;
    use SoftDeletes;

    protected function getLedgerData(): ?array
    {
        $entityId = $this->accounting_entity_id;
        
        // If not explicitly set, try to find by name
        if (!$entityId && $this->entity_name) {
            $entity = \App\Models\Entity::where('name', $this->entity_name)->first();
            if ($entity) $entityId = $entity->id;
        }

        if (!$entityId) return null;

        // Transaction IN (Receipt) = Credit the entity (decreases what they owe us)
        $isReceipt = $this->type === 'IN';

        return [
            'entity_id' => $entityId,
            'date' => $this->transaction_date,
            'voucher_type' => $isReceipt ? 'RECEIPT' : 'PAYMENT',
            'particulars' => ($isReceipt ? 'Cash Received' : 'Cash Paid') . ($this->description ? ' - ' . $this->description : ''),
            'debit' => $isReceipt ? 0 : $this->amount,
            'credit' => $isReceipt ? $this->amount : 0,
            'user_id' => $this->user_id,
            'shop_id' => $this->shop_id,
        ];
    }


    protected $fillable = [
        'shop_id', 
        'user_id', 
        'type', 
        'category', 
        'amount', 
        'payment_mode', 
        'entity_type', 
        'entity_id', 
        'accounting_entity_id',
        'description', 
        'entity_name',
        'ref_id', 
        'transaction_date'
    ];

    protected $casts = [
        'transaction_date' => 'date',
        'amount' => 'float',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function shop()
    {
        return $this->belongsTo(Shop::class);
    }

    public function entity()
    {
        return $this->morphTo();
    }
}
