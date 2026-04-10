<?php

namespace App\Models;
use App\Traits\RecordsTransactions;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SalaryPayment extends Model
{
    use RecordsTransactions;
    use HasFactory;

    protected $fillable = [
        'user_id',
        'amount',
        'type',
        'for_month',
        'payment_date',
        'notes',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'payment_date' => 'date',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
