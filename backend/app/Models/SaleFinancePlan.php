<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SaleFinancePlan extends Model
{
    protected $fillable = [
        'sale_invoice_id', 'customer_id', 'type',
        'down_payment', 'principal',
        'interest_rate', 'tenure_months', 'monthly_emi', 'emi_start_date', 'total_payable',
        'total_paid', 'status', 'settled_at', 'created_by',
    ];

    protected $casts = [
        'emi_start_date' => 'date',
        'settled_at'     => 'datetime',
        'down_payment'   => 'float',
        'principal'      => 'float',
        'interest_rate'  => 'float',
        'monthly_emi'    => 'float',
        'total_payable'  => 'float',
        'total_paid'     => 'float',
    ];

    public function saleInvoice()
    {
        return $this->belongsTo(SaleInvoice::class);
    }

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function payments()
    {
        return $this->hasMany(FinancePayment::class)->orderBy('payment_date');
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function getRemainingAttribute(): float
    {
        return max(0, ($this->type === 'PERSONAL' ? $this->total_payable : $this->principal) - $this->total_paid);
    }

    /**
     * Build the full EMI schedule for PERSONAL plans.
     * Returns array of ['emi_no', 'due_date', 'amount', 'status']
     */
    public function buildSchedule(): array
    {
        if ($this->type !== 'PERSONAL' || !$this->tenure_months || !$this->emi_start_date) {
            return [];
        }

        $payments   = $this->payments()->where('emi_number', '>', 0)->get()->keyBy('emi_number');
        $schedule   = [];
        $startDate  = $this->emi_start_date->copy();

        for ($i = 1; $i <= $this->tenure_months; $i++) {
            $due    = $startDate->copy()->addMonths($i - 1);
            $paid   = $payments->has($i);
            $today  = now()->startOfDay();

            if ($paid) {
                $statusLabel = 'PAID';
            } elseif ($due->lt($today)) {
                $statusLabel = 'OVERDUE';
            } else {
                $statusLabel = 'PENDING';
            }

            $schedule[] = [
                'emi_no'       => $i,
                'due_date'     => $due->format('Y-m-d'),
                'amount'       => $this->monthly_emi,
                'status'       => $statusLabel,
                'payment'      => $paid ? $payments[$i] : null,
            ];
        }

        return $schedule;
    }

    /**
     * Update plan status based on today vs overdue EMIs.
     */
    public function refreshStatus(): void
    {
        if ($this->status === 'SETTLED') return;

        if ($this->type === 'PERSONAL') {
            $schedule = $this->buildSchedule();
            $hasOverdue = collect($schedule)->contains('status', 'OVERDUE');
            $this->status = $hasOverdue ? 'OVERDUE' : 'ACTIVE';
        } else {
            $this->status = 'ACTIVE';
        }
        $this->saveQuietly();
    }
}
