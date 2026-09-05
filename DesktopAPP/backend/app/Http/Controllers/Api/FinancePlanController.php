<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SaleFinancePlan;
use App\Models\FinancePayment;
use App\Models\SaleInvoice;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class FinancePlanController extends Controller
{
    protected $transactionService;

    public function __construct(\App\Services\TransactionService $transactionService)
    {
        $this->transactionService = $transactionService;
    }

    public function index(Request $request)
    {
        $user  = $request->user();
        $query = SaleFinancePlan::with([
            'saleInvoice.items.product',
            'customer',
            'payments',
        ]);

        // Shop scope for non-owners
        if (!$user->hasFullAccess()) {
            $query->whereHas('saleInvoice', fn($q) => $q->where('shop_id', $user->shop_id));
        }

        if ($request->type)   $query->where('type', $request->type);
        if ($request->status) $query->where('status', $request->status);

        if ($request->search) {
            $s = $request->search;
            $query->where(function ($q) use ($s) {
                $q->whereHas('customer', fn($cq) =>
                    $cq->where('name', 'like', "%$s%")->orWhere('phone', 'like', "%$s%")
                )->orWhereHas('saleInvoice', fn($iq) => $iq->where('invoice_no', 'like', "%$s%"));
            });
        }

        // Refresh OVERDUE status on results
        $plans = $query->latest()->get();
        $plans->each(fn($p) => $p->refreshStatus());

        return response()->json($plans->fresh([
            'saleInvoice.items.product',
            'customer',
            'payments',
        ]));
    }

    /**
     * Create a finance plan. Called directly from SaleInvoiceController after invoice is stored,
     * or standalone via POST /finance-plans.
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'sale_invoice_id' => 'required|exists:sale_invoices,id',
            'type'            => 'required|in:PERSONAL,FAVOR,PROCESSING_FEE',
            'down_payment'    => 'nullable|numeric|min:0',
            'principal'       => 'required|numeric|min:0.01',
            'interest_rate'   => 'nullable|numeric|min:0',
            'interest_type'   => 'nullable|in:FLAT,REDUCING',
            'total_payable'   => 'nullable|numeric|min:0',
            'tenure_months'   => 'nullable|integer|min:1|max:360',
            'emi_start_date'  => 'nullable|date',
            'processing_fee'  => 'nullable|numeric|min:0',
            'monthly_emi'     => 'nullable|numeric|min:0.01',
        ]);

        $invoice = SaleInvoice::findOrFail($data['sale_invoice_id']);

        if (!$request->user()->hasFullAccess() && $invoice->shop_id !== $request->user()->shop_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $interestType = $data['interest_type'] ?? 'REDUCING';
        $months       = $data['tenure_months'] ?? 0;
        $processingFee = (float) ($data['processing_fee'] ?? 0);

        if ($data['type'] === 'PROCESSING_FEE') {
            $totalPayable = round($data['principal'] + $processingFee, 2);
            $monthlyEmi   = $months > 0
                ? (!empty($data['monthly_emi']) ? round((float) $data['monthly_emi'], 2) : round($totalPayable / $months))
                : 0;
            $interestRate = null;
        } elseif (empty($data['interest_rate']) && !empty($data['total_payable'])) {
            // "Total payable" is an alternative way to specify the deal (staff
            // already agreed a fixed repayment figure with the customer) — the
            // effective interest_rate is derived from it here, authoritatively,
            // rather than trusting whatever rate the client-side preview computed.
            [$monthlyEmi, $totalPayable, $impliedRate] = $this->calcEmiFromTotalPayable(
                $data['principal'],
                (float) $data['total_payable'],
                $months,
                $interestType
            );
            $interestRate = $impliedRate;
        } else {
            $interestRate = (float) ($data['interest_rate'] ?? 0);
            [$monthlyEmi, $totalPayable] = $this->calcEmi($data['principal'], $interestRate, $months, $interestType);
        }

        $isScheduled = in_array($data['type'], ['PERSONAL', 'PROCESSING_FEE']);

        $plan = SaleFinancePlan::create([
            'sale_invoice_id' => $data['sale_invoice_id'],
            'customer_id'     => $invoice->customer_id,
            'type'            => $data['type'],
            'down_payment'    => $data['down_payment'] ?? 0,
            'principal'       => $data['principal'],
            'processing_fee'  => $data['type'] === 'PROCESSING_FEE' ? $processingFee : null,
            'interest_rate'   => $interestRate ?: null,
            // Column is NOT NULL (default REDUCING) — PROCESSING_FEE/FAVOR
            // plans don't use this field at all, but must still pass a
            // valid value rather than null, which fails outright under
            // MySQL strict mode and silently relies on the column's own
            // default otherwise.
            'interest_type'   => $data['type'] === 'PERSONAL' ? $interestType : 'REDUCING',
            'tenure_months'   => $data['tenure_months'] ?? null,
            'monthly_emi'     => $isScheduled ? $monthlyEmi : null,
            'emi_start_date'  => $isScheduled ? ($data['emi_start_date'] ?? now()->addMonth()->startOfMonth()) : null,
            'total_payable'   => $isScheduled ? $totalPayable : $data['principal'],
            'total_paid'      => 0,
            'status'          => 'ACTIVE',
            'created_by'      => $request->user()->id,
        ]);

        $this->notifyOwner(
            "💳 *Finance Plan Created*\nType: " . ucfirst(strtolower($plan->type)) .
            "\nCustomer: " . ($plan->customer->name ?? 'Unknown') .
            "\nPrincipal: ₹" . number_format($plan->principal, 2) .
            "\nSale Invoice: #{$invoice->invoice_no}" .
            "\nBy: {$request->user()->name}"
        );

        return response()->json($plan->load('saleInvoice', 'customer', 'payments'), 201);
    }

    public function show(Request $request, SaleFinancePlan $financePlan)
    {
        $financePlan->loadMissing('saleInvoice');
        if (!$request->user()->hasFullAccess() && $financePlan->saleInvoice?->shop_id !== $request->user()->shop_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $financePlan->refreshStatus();
        $financePlan->load('saleInvoice.items.product', 'customer', 'payments.createdBy');

        return response()->json([
            'plan'     => $financePlan,
            'schedule' => $financePlan->buildSchedule(),
        ]);
    }

    public function addPayment(Request $request, SaleFinancePlan $financePlan)
    {
        $financePlan->loadMissing('saleInvoice');
        if (!$request->user()->hasFullAccess() && $financePlan->saleInvoice?->shop_id !== $request->user()->shop_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $data = $request->validate([
            'amount'       => 'required|numeric|min:0.01',
            'payment_date' => 'required|date',
            'payment_mode' => 'nullable|string|max:50',
            'payment_lines' => 'nullable|array|min:2',
            'payment_lines.*.payment_mode' => 'required_with:payment_lines|string',
            'payment_lines.*.amount'       => 'required_with:payment_lines|numeric|min:0.01',
            'emi_number'   => 'nullable|integer|min:1',
            'notes'        => 'nullable|string|max:500',
        ]);

        if ($financePlan->status === 'SETTLED') {
            return response()->json(['message' => 'This finance plan is already settled.'], 422);
        }

        if (!\App\Services\TransactionService::paymentLinesSumMatches($data['payment_lines'] ?? null, (float) $data['amount'])) {
            return response()->json(['message' => 'Split payment lines must add up to the amount'], 422);
        }

        return DB::transaction(function () use ($data, $financePlan, $request) {
            // Create payment record
            $payment = FinancePayment::create([
                'sale_finance_plan_id' => $financePlan->id,
                'amount'               => $data['amount'],
                'payment_date'         => $data['payment_date'],
                'payment_mode'         => $data['payment_mode'] ?? 'CASH',
                'emi_number'           => $data['emi_number'] ?? null,
                'notes'                => $data['notes'] ?? null,
                'created_by'           => $request->user()->id,
            ]);

            // Record the collection to the Ledger — previously this only ever
            // touched FinancePayment/SaleFinancePlan/SaleInvoice rows, so EMI
            // cash collected here was invisible to Cashbook/Entity Ledger/Bank
            // balances even though the money was really received.
            $this->transactionService->recordForModel($payment, [
                'type'             => 'IN',
                'category'         => 'SHOP_FINANCE_EMI_COLLECTION',
                'amount'           => $data['amount'],
                'payment_mode'     => $data['payment_mode'] ?? 'CASH',
                'payment_lines'    => $data['payment_lines'] ?? null,
                'entity_name'      => $financePlan->customer->name ?? null,
                'transaction_date' => $data['payment_date'],
                'shop_id'          => $financePlan->saleInvoice->shop_id,
                'description'      => "EMI payment for Sale Invoice #{$financePlan->saleInvoice->invoice_no}" . (!empty($data['emi_number']) ? " (EMI #{$data['emi_number']})" : ''),
            ]);

            // Update plan's total_paid
            $financePlan->total_paid = DB::table('finance_payments')
                ->where('sale_finance_plan_id', $financePlan->id)
                ->sum('amount');

            $remaining = (in_array($financePlan->type, ['PERSONAL', 'PROCESSING_FEE']) ? $financePlan->total_payable : $financePlan->principal)
                         - $financePlan->total_paid;

            if ($remaining <= 0.01) {
                $financePlan->status     = 'SETTLED';
                $financePlan->settled_at = now();
            } else {
                $financePlan->refreshStatus();
            }
            $financePlan->saveQuietly();

            // Mirror payment onto the sale invoice's total_paid so payment_status stays accurate
            $invoice = SaleInvoice::lockForUpdate()->findOrFail($financePlan->sale_invoice_id);
            $invoice->total_paid += $data['amount'];
            $invoice->updatePaymentStatus();

            return response()->json([
                'message'     => 'Payment recorded successfully',
                'payment'     => $payment,
                'total_paid'  => $financePlan->total_paid,
                'remaining'   => max(0, $remaining),
                'status'      => $financePlan->status,
            ]);
        });
    }

    public function settle(Request $request, SaleFinancePlan $financePlan)
    {
        $financePlan->loadMissing('saleInvoice');
        if (!$request->user()->hasFullAccess() && $financePlan->saleInvoice?->shop_id !== $request->user()->shop_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if ($financePlan->status === 'SETTLED') {
            return response()->json(['message' => 'Already settled'], 422);
        }

        $remaining = (in_array($financePlan->type, ['PERSONAL', 'PROCESSING_FEE']) ? $financePlan->total_payable : $financePlan->principal)
                     - $financePlan->total_paid;

        return DB::transaction(function () use ($financePlan, $remaining, $request) {
            // Record the final payment if any amount remains
            if ($remaining > 0.01) {
                $data = request()->validate([
                    'payment_date' => 'nullable|date',
                    'payment_mode' => 'nullable|string|max:50',
                    'payment_lines' => 'nullable|array|min:2',
                    'payment_lines.*.payment_mode' => 'required_with:payment_lines|string',
                    'payment_lines.*.amount'       => 'required_with:payment_lines|numeric|min:0.01',
                    'notes'        => 'nullable|string|max:500',
                ]);

                if (!\App\Services\TransactionService::paymentLinesSumMatches($data['payment_lines'] ?? null, (float) $remaining)) {
                    return response()->json(['message' => 'Split payment lines must add up to the remaining amount'], 422);
                }

                $payment = FinancePayment::create([
                    'sale_finance_plan_id' => $financePlan->id,
                    'amount'               => $remaining,
                    'payment_date'         => $data['payment_date'] ?? today()->toDateString(),
                    'payment_mode'         => $data['payment_mode'] ?? 'CASH',
                    'notes'                => $data['notes'] ?? 'Final settlement',
                    'created_by'           => $request->user()->id,
                ]);

                $this->transactionService->recordForModel($payment, [
                    'type'             => 'IN',
                    'category'         => 'SHOP_FINANCE_EMI_COLLECTION',
                    'amount'           => $remaining,
                    'payment_mode'     => $data['payment_mode'] ?? 'CASH',
                    'payment_lines'    => $data['payment_lines'] ?? null,
                    'entity_name'      => $financePlan->customer->name ?? null,
                    'transaction_date' => $data['payment_date'] ?? today()->toDateString(),
                    'shop_id'          => $financePlan->saleInvoice->shop_id,
                    'description'      => "Final EMI settlement for Sale Invoice #{$financePlan->saleInvoice->invoice_no}",
                ]);

                $invoice = SaleInvoice::lockForUpdate()->findOrFail($financePlan->sale_invoice_id);
                $invoice->total_paid += $remaining;
                $invoice->updatePaymentStatus();

                $financePlan->total_paid += $remaining;
            }

            $financePlan->status     = 'SETTLED';
            $financePlan->settled_at = now();
            $financePlan->saveQuietly();

            return response()->json(['message' => 'Finance plan settled successfully', 'plan' => $financePlan]);
        });
    }

    // ── Helper ──────────────────────────────────────────────────────────────

    /**
     * Returns [monthlyEmi, totalPayable] for a given annual rate.
     * If rate=0 or tenure=0, returns [principal/tenure, principal].
     *
     * FLAT: simple interest on the original principal for the full tenure —
     * common for informal shop financing ("pay back principal + a flat 20%").
     * REDUCING: standard amortizing loan formula (interest recalculated on
     * the outstanding balance each month) — this was the only mode before
     * flat-rate support was added, so it stays the default everywhere.
     */
    public static function calcEmi(float $principal, float $annualRate, int $months, string $interestType = 'REDUCING'): array
    {
        if ($months <= 0) return [0, $principal];

        if ($annualRate <= 0) {
            $emi = round($principal / $months, 2);
            return [$emi, $principal];
        }

        if ($interestType === 'FLAT') {
            $totalInterest = $principal * ($annualRate / 100) * ($months / 12);
            $totalPayable  = round($principal + $totalInterest, 2);
            $emi           = round($totalPayable / $months, 2);
            return [$emi, $totalPayable];
        }

        $r   = $annualRate / 12 / 100;
        $emi = $principal * $r * pow(1 + $r, $months) / (pow(1 + $r, $months) - 1);
        $emi = round($emi, 2);

        return [$emi, round($emi * $months, 2)];
    }

    /**
     * Reverse of calcEmi(): given a target total payable instead of a rate,
     * returns [monthlyEmi, totalPayable, impliedAnnualRate]. Lets staff who
     * already agreed a fixed repayment total with the customer (e.g. "pay
     * back ₹12,000 for a ₹10,000 loan over 3 months") enter that directly
     * instead of guessing an interest rate that produces it.
     */
    public static function calcEmiFromTotalPayable(float $principal, float $totalPayable, int $months, string $interestType = 'REDUCING'): array
    {
        if ($months <= 0 || $principal <= 0) return [0, $principal, 0];

        $totalPayable = max($totalPayable, $principal);
        $emi          = round($totalPayable / $months, 2);

        if ($totalPayable <= $principal) {
            return [$emi, round($totalPayable, 2), 0];
        }

        if ($interestType === 'FLAT') {
            $interest   = $totalPayable - $principal;
            $annualRate = round(($interest * 12) / ($principal * $months) * 100, 4);
        } else {
            $annualRate = round(self::solveReducingRate($principal, $emi, $months), 4);
        }

        return [$emi, round($totalPayable, 2), $annualRate];
    }

    /**
     * Numerically solves for the monthly reducing-balance rate r that makes
     * P*r*(1+r)^n/((1+r)^n-1) == emi. No closed form exists for r, so this
     * bisects — emi is strictly increasing in r for r >= 0, so it converges
     * reliably. Returns the rate annualized as a percentage.
     */
    private static function solveReducingRate(float $principal, float $emi, int $months): float
    {
        if ($emi <= $principal / $months) return 0.0;

        $lo = 0.0;
        $hi = 5.0; // 500%/month upper bound — comfortably above any real input
        for ($i = 0; $i < 100; $i++) {
            $mid     = ($lo + $hi) / 2;
            $calcEmi = $mid == 0
                ? $principal / $months
                : $principal * $mid * pow(1 + $mid, $months) / (pow(1 + $mid, $months) - 1);
            if ($calcEmi < $emi) { $lo = $mid; } else { $hi = $mid; }
        }

        return (($lo + $hi) / 2) * 12 * 100;
    }
}
