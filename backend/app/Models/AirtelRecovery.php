<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class AirtelRecovery extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'retailer_id', 'amount', 'recovered_at', 'recovery_user_id', 'notes'
    ];

    protected $casts = [
        'recovered_at' => 'datetime',
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
