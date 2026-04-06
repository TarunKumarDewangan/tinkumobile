<?php

namespace App\Models;
use App\Traits\RecordsTransactions;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Loan extends Model
{
    use RecordsTransactions;
    protected $fillable = [
        'customer_id', 'principal', 'interest_rate', 'total_months',
        'monthly_installment', 'start_date', 'status', 'notes'
    ];

    public function customer(): BelongsTo { return $this->belongsTo(Customer::class); }
    public function payments(): HasMany { return $this->hasMany(LoanPayment::class); }

    public function totalPaid(): float
    {
        return (float) $this->payments()->where('status', 'paid')->sum('amount');
    }

    public function remaining(): float
    {
        return (float) ($this->monthly_installment * $this->total_months) - $this->totalPaid();
    }
}
