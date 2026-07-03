<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FinancePayment extends Model
{
    protected $fillable = [
        'sale_finance_plan_id', 'amount', 'payment_date',
        'payment_mode', 'emi_number', 'notes', 'created_by',
    ];

    protected $casts = [
        'payment_date' => 'date',
        'amount'       => 'float',
    ];

    public function plan()
    {
        return $this->belongsTo(SaleFinancePlan::class, 'sale_finance_plan_id');
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
