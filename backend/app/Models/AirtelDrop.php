<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\Entity;

use Illuminate\Database\Eloquent\SoftDeletes;

use App\Traits\PostsToLedger;

class AirtelDrop extends Model
{
    use PostsToLedger;
    use SoftDeletes;

    protected function getLedgerData(): ?array
    {
        $retailer = $this->retailer;
        if (!$retailer) return null;
        
        $entity = Entity::where('name', $retailer->name)->first();
        if (!$entity) return null;

        return [
            'entity_id' => $entity->id,
            'date' => $this->refill_date,
            'voucher_type' => 'AIRTEL_DROP',
            'particulars' => 'Airtel Stock Drop: #' . $this->id,
            'debit' => $this->amount,
            'credit' => 0,
            'user_id' => null,
            'shop_id' => null,
        ];
    }

    protected $fillable = [
        'retailer_id', 'amount', 'paid_amount', 'refill_date', 'status', 
        'recovery_user_id', 'recovered_at', 'reason', 'next_recovery_date'
    ];

    protected $casts = [
        'refill_date' => 'datetime',
        'recovered_at' => 'datetime',
        'next_recovery_date' => 'date',
    ];

    public function retailer()
    {
        return $this->belongsTo(Retailer::class);
    }

    public function recoveryUser()
    {
        return $this->belongsTo(User::class, 'recovery_user_id');
    }
}
