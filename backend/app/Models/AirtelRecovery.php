<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

use App\Traits\PostsToLedger;
use App\Models\Entity;

class AirtelRecovery extends Model
{
    use PostsToLedger, SoftDeletes;

    protected $fillable = [
        'retailer_id', 'amount', 'recovered_at', 'recovery_user_id', 'notes'
    ];

    protected $casts = [
        'recovered_at' => 'datetime',
    ];

    protected function getLedgerData(): ?array
    {
        $retailer = $this->retailer;
        if (!$retailer) return null;

        $entity = Entity::where('name', $retailer->name)->first();
        if (!$entity) return null;

        return [
            'entity_id'    => $entity->id,
            'date'         => $this->recovered_at?->toDateString() ?? now()->toDateString(),
            'voucher_type' => 'AIRTEL_RECOVERY',
            'particulars'  => 'Airtel Recovery' . ($this->notes ? ': ' . $this->notes : '') . ' (MSISDN: ' . $retailer->msisdn . ')',
            'debit'        => 0,
            'credit'       => $this->amount,
            'user_id'      => $this->recovery_user_id,
            'shop_id'      => null,
        ];
    }

    public function retailer()
    {
        return $this->belongsTo(Retailer::class);
    }

    public function recoveryUser()
    {
        return $this->belongsTo(User::class, 'recovery_user_id');
    }
}
