<?php

namespace App\Models;
use App\Traits\RecordsTransactions;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LoanPayment extends Model
{
    use RecordsTransactions;
    use SoftDeletes;
    public $timestamps = false;
    protected $fillable = ['shop_id', 'loan_id', 'due_date', 'paid_date', 'amount', 'penalty', 'status', 'notes'];

    public function shop(): BelongsTo { return $this->belongsTo(Shop::class); }
    public function loan(): BelongsTo { return $this->belongsTo(Loan::class); }
}
