<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SaleFinancePlan extends Model
{
    protected $fillable = [
        'sale_invoice_id', 'customer_id', 'type',
        'down_payment', 'principal', 'processing_fee',
        'interest_rate', 'interest_type', 'tenure_months', 'monthly_emi', 'emi_start_date', 'total_payable',
        'total_paid', 'status', 'settled_at', 'created_by',
    ];

    protected $casts = [
        'emi_start_date'  => 'date',
        'settled_at'      => 'datetime',
        'down_payment'    => 'float',
        'principal'       => 'float',
        'processing_fee'  => 'float',
        'interest_rate'   => 'float',
        'monthly_emi'     => 'float',
        'total_payable'   => 'float',
        'total_paid'      => 'float',
    ];

    /**
     * PERSONAL (interest-based) and PROCESSING_FEE (flat-fee-based) plans
     * both repay principal + a cost on top via a fixed monthly EMI schedule
     * — FAVOR has neither a schedule nor a fixed total, it's pay-whenever.
     */
    private const SCHEDULED_TYPES = ['PERSONAL', 'PROCESSING_FEE'];

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
        return max(0, (in_array($this->type, self::SCHEDULED_TYPES) ? $this->total_payable : $this->principal) - $this->total_paid);
    }

    /**
     * Build the full EMI schedule for PERSONAL/PROCESSING_FEE plans.
     * Returns array of ['emi_no', 'due_date', 'amount', 'status']
     *
     * For PROCESSING_FEE, monthly_emi is typically rounded to a whole rupee
     * for a clean figure (e.g. ₹500 instead of ₹500.21) — the last
     * installment absorbs whatever that rounding leaves over, so the
     * schedule still sums to exactly total_payable.
     */
    public function buildSchedule(): array
    {
        if (!in_array($this->type, self::SCHEDULED_TYPES) || !$this->tenure_months || !$this->emi_start_date) {
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

            $amount = $this->monthly_emi;
            if ($this->type === 'PROCESSING_FEE' && $i === $this->tenure_months) {
                $amount = round($this->total_payable - ($this->monthly_emi * ($this->tenure_months - 1)), 2);
            }

            $schedule[] = [
                'emi_no'       => $i,
                'due_date'     => $due->format('Y-m-d'),
                'amount'       => $amount,
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

        if (in_array($this->type, self::SCHEDULED_TYPES)) {
            $schedule = $this->buildSchedule();
            $hasOverdue = collect($schedule)->contains('status', 'OVERDUE');
            $this->status = $hasOverdue ? 'OVERDUE' : 'ACTIVE';
        } else {
            $this->status = 'ACTIVE';
        }
        $this->saveQuietly();
    }
}
