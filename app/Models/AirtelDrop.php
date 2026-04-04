<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AirtelDrop extends Model
{
    protected $fillable = [
        'retailer_id', 'amount', 'refill_date', 'status', 
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
