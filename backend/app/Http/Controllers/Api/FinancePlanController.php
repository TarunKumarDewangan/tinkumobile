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
            'type'            => 'required|in:PERSONAL,FAVOR',
            'down_payment'    => 'nullable|numeric|min:0',
            'principal'       => 'required|numeric|min:0.01',
            'interest_rate'   => 'nullable|numeric|min:0',
            'tenure_months'   => 'nullable|integer|min:1|max:360',
            'emi_start_date'  => 'nullable|date',
        ]);

        $invoice = SaleInvoice::findOrFail($data['sale_invoice_id']);

        [$monthlyEmi, $totalPayable] = $this->calcEmi(
            $data['principal'],
            $data['interest_rate'] ?? 0,
            $data['tenure_months'] ?? 0
        );

        $plan = SaleFinancePlan::create([
            'sale_invoice_id' => $data['sale_invoice_id'],
            'customer_id'     => $invoice->customer_id,
            'type'            => $data['type'],
            'down_payment'    => $data['down_payment'] ?? 0,
            'principal'       => $data['principal'],
            'interest_rate'   => $data['interest_rate'] ?? null,
            'tenure_months'   => $data['tenure_months'] ?? null,
            'monthly_emi'     => $data['type'] === 'PERSONAL' ? $monthlyEmi : null,
            'emi_start_date'  => $data['type'] === 'PERSONAL' ? ($data['emi_start_date'] ?? now()->addMonth()->startOfMonth()) : null,
            'total_payable'   => $data['type'] === 'PERSONAL' ? $totalPayable : $data['principal'],
            'total_paid'      => 0,
            'status'          => 'ACTIVE',
            'created_by'      => $request->user()->id,
        ]);

        return response()->json($plan->load('saleInvoice', 'customer', 'payments'), 201);
    }

    public function show(SaleFinancePlan $financePlan)
    {
        $financePlan->refreshStatus();
        $financePlan->load('saleInvoice.items.product', 'customer', 'payments.createdBy');

        return response()->json([
            'plan'     => $financePlan,
            'schedule' => $financePlan->buildSchedule(),
        ]);
    }

    public function addPayment(Request $request, SaleFinancePlan $financePlan)
    {
        $data = $request->validate([
            'amount'       => 'required|numeric|min:0.01',
            'payment_date' => 'required|date',
            'payment_mode' => 'nullable|string|max:50',
            'emi_number'   => 'nullable|integer|min:1',
            'notes'        => 'nullable|string|max:500',
        ]);

        if ($financePlan->status === 'SETTLED') {
            return response()->json(['message' => 'This finance plan is already settled.'], 422);
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

            // Update plan's total_paid
            $financePlan->total_paid = DB::table('finance_payments')
                ->where('sale_finance_plan_id', $financePlan->id)
                ->sum('amount');

            $remaining = ($financePlan->type === 'PERSONAL' ? $financePlan->total_payable : $financePlan->principal)
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
        if ($financePlan->status === 'SETTLED') {
            return response()->json(['message' => 'Already settled'], 422);
        }

        $remaining = ($financePlan->type === 'PERSONAL' ? $financePlan->total_payable : $financePlan->principal)
                     - $financePlan->total_paid;

        return DB::transaction(function () use ($financePlan, $remaining, $request) {
            // Record the final payment if any amount remains
            if ($remaining > 0.01) {
                $data = request()->validate([
                    'payment_date' => 'nullable|date',
                    'payment_mode' => 'nullable|string|max:50',
                    'notes'        => 'nullable|string|max:500',
                ]);

                FinancePayment::create([
                    'sale_finance_plan_id' => $financePlan->id,
                    'amount'               => $remaining,
                    'payment_date'         => $data['payment_date'] ?? today()->toDateString(),
                    'payment_mode'         => $data['payment_mode'] ?? 'CASH',
                    'notes'                => $data['notes'] ?? 'Final settlement',
                    'created_by'           => $request->user()->id,
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
     * Returns [monthlyEmi, totalPayable].
     * If rate=0 or tenure=0, returns [principal/tenure, principal].
     */
    public static function calcEmi(float $principal, float $annualRate, int $months): array
    {
        if ($months <= 0) return [0, $principal];

        if ($annualRate <= 0) {
            $emi = round($principal / $months, 2);
            return [$emi, $principal];
        }

        $r   = $annualRate / 12 / 100;
        $emi = $principal * $r * pow(1 + $r, $months) / (pow(1 + $r, $months) - 1);
        $emi = round($emi, 2);

        return [$emi, round($emi * $months, 2)];
    }
}
