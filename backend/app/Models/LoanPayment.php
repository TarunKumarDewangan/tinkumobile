<?php

namespace App\Models;
use App\Traits\RecordsTransactions;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LoanPayment extends Model
{
    use RecordsTransactions;
    public $timestamps = false;
    protected $fillable = ['loan_id', 'due_date', 'paid_date', 'amount', 'penalty', 'status', 'notes'];

    public function loan(): BelongsTo { return $this->belongsTo(Loan::class); }
}
