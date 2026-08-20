<?php

namespace App\Services;

use App\Models\SaleInvoice;
use App\Models\SaleItem;
use App\Models\RepairRequest;
use App\Models\Inventory;
use App\Models\SaleFinancePlan;
use App\Models\FinancePayment;
use App\Models\Transaction;
use App\Models\Category;
use App\Models\EntityNote;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;

/**
 * Builds and sends the recurring WhatsApp/Telegram reports. Shared by the scheduled
 * Artisan commands (DailySummaryCommand, EmiDueReminderCommand) AND the manual
 * "send now" buttons in Settings — both must produce byte-identical messages, so all
 * the actual logic lives here once instead of being duplicated in two places.
 */
class ReportNotificationService
{
    /**
     * Toggle for the per-model "OUT OF STOCK" tables in the daily summary —
     * turned off per owner request (kept noisy for a long out-of-stock list),
     * but the rendering code (buildOutOfStockTable) is left intact below in
     * case it's wanted again later. Flip to true to restore it.
     */
    private const SHOW_OUT_OF_STOCK_TABLES = false;

    /**
     * Send a message to every configured owner channel. Never throws — failures are
     * logged and reflected in the returned flags instead.
     */
    public function sendToChannels(string $message): array
    {
        $whatsappOk = false;
        $telegramOk = false;

        try {
            $whatsappOk = app(WhatsAppService::class)->sendToOwner($message);
        } catch (\Exception $e) {
            Log::error('Failed to send report via WhatsApp', ['error' => $e->getMessage()]);
        }

        try {
            $telegramOk = app(TelegramService::class)->sendToOwner($message);
        } catch (\Exception $e) {
            Log::error('Failed to send report via Telegram', ['error' => $e->getMessage()]);
        }

        return ['whatsapp' => $whatsappOk, 'telegram' => $telegramOk];
    }

    /**
     * @param string $slot 'afternoon' or 'night' — controls only the message header.
     */
    public function buildDailySummaryMessage(string $slot = 'night'): string
    {
        $today = Carbon::today();
        $dateStr = $today->format('d M Y');
        $header = $slot === 'afternoon' ? "🕔 *Afternoon Update ({$dateStr})*" : "🌙 *Night Closing Summary ({$dateStr})*";

        $saleCount = SaleInvoice::whereDate('sale_date', $today)->count();
        $repairCount = RepairRequest::whereDate('submitted_date', $today)->count();

        // EXCHANGE (old-mobile trade-in credit) and FINANCE (EMI/financer receivable)
        // are accounting adjustments, not real cash/bank movement — they must not be
        // counted as "collections" or the owner would think money hit the bank that didn't.
        $nonCashModes = ['EXCHANGE', 'FINANCE', 'PAYABLE'];

        // is_internal_transfer rows are the mirrored bank-side postings of a payment
        // already counted once against the customer/supplier/party — excluding them
        // here prevents double-counting the same money as a collection.
        $cashIn = Transaction::whereDate('transaction_date', $today)->where('type', 'IN')->where('payment_mode', 'CASH')->where('is_internal_transfer', false)->sum('amount');
        $bankIn = Transaction::whereDate('transaction_date', $today)->where('type', 'IN')->whereNotIn('payment_mode', array_merge(['CASH'], $nonCashModes))->where('is_internal_transfer', false)->sum('amount');
        $exchangeIn = Transaction::whereDate('transaction_date', $today)->where('type', 'IN')->where('payment_mode', 'EXCHANGE')->where('is_internal_transfer', false)->sum('amount');
        $financeIn = Transaction::whereDate('transaction_date', $today)->where('type', 'IN')->where('payment_mode', 'FINANCE')->where('is_internal_transfer', false)->sum('amount');
        $cashOut = Transaction::whereDate('transaction_date', $today)->where('type', 'OUT')->where('payment_mode', 'CASH')->where('is_internal_transfer', false)->sum('amount');
        $bankOut = Transaction::whereDate('transaction_date', $today)->where('type', 'OUT')->whereNotIn('payment_mode', array_merge(['CASH'], $nonCashModes))->where('is_internal_transfer', false)->sum('amount');

        $totalIn = $cashIn + $bankIn;
        $totalOut = $cashOut + $bankOut;

        $newMobileCatId = Category::mobileNewId();
        $oldMobileCatId = Category::mobileOldId();
        $mobileCatIds = array_values(array_filter([$newMobileCatId, $oldMobileCatId]));

        // Mobiles sold today, with the buyer's name/phone — the owner wants to see
        // WHO bought WHAT, not just a count.
        $soldMobiles = SaleItem::with(['product.brand', 'invoice.customer'])
            ->whereHas('invoice', fn($q) => $q->whereDate('sale_date', $today)->where('is_cancelled', false))
            ->whereHas('product', fn($q) => $q->whereIn('category_id', $mobileCatIds))
            ->get();

        // Repairs booked today, with the device/problem and the customer's name/phone.
        $todaysRepairs = RepairRequest::whereDate('submitted_date', $today)->get();

        // Personal Finance (in-house Shop Finance — Personal EMI/Favor): down payments
        // from plans created today, plus any EMI installment collected today for ANY
        // plan (old or new) — both are real money that came in through this channel today.
        $personalFinanceEntries = [];

        $personalPlansToday = SaleFinancePlan::with(['saleInvoice.items.product.brand', 'saleInvoice.customer'])
            ->whereHas('saleInvoice', fn($q) => $q->whereDate('sale_date', $today)->where('is_cancelled', false))
            ->where('down_payment', '>', 0)
            ->get();
        foreach ($personalPlansToday as $plan) {
            if (!$plan->saleInvoice) continue;
            $personalFinanceEntries[] = $this->financeEntryLine($plan->saleInvoice, $plan->down_payment, 'Down Payment');
        }

        $installmentsToday = FinancePayment::with(['plan.saleInvoice.items.product.brand', 'plan.saleInvoice.customer'])
            ->whereDate('payment_date', $today)
            ->get();
        foreach ($installmentsToday as $payment) {
            if (!$payment->plan?->saleInvoice) continue;
            $personalFinanceEntries[] = $this->financeEntryLine($payment->plan->saleInvoice, $payment->amount, 'EMI Payment');
        }

        $personalFinanceDone = $personalPlansToday->sum('down_payment') + $installmentsToday->sum('amount');

        // Company Finance (external financer — Bajaj/HDB/etc): money received today
        // from today's sales financed through them.
        $companyFinanceEntries = [];
        $companyFinanceToday = SaleInvoice::with(['items.product.brand', 'customer', 'financer'])
            ->whereDate('sale_date', $today)
            ->where('is_cancelled', false)
            ->where('finance_payment_status', 'RECEIVED')
            ->where('finance_amount', '>', 0)
            ->get();
        foreach ($companyFinanceToday as $invoice) {
            $financerName = $invoice->financer?->name ?? 'Financer';
            $companyFinanceEntries[] = $this->financeEntryLine($invoice, $invoice->finance_amount, $financerName);
        }

        $companyFinanceDone = $companyFinanceToday->sum('finance_amount');

        $newMobileStock = Inventory::whereHas('product', fn($q) => $q->where('category_id', $newMobileCatId))->where('stock', '>', 0)->sum('stock');
        $oldMobileStock = Inventory::whereHas('product', fn($q) => $q->where('category_id', $oldMobileCatId))->where('stock', '>', 0)->sum('stock');
        $otherStock     = Inventory::whereHas('product', fn($q) => $q->whereNotIn('category_id', $mobileCatIds))->where('stock', '>', 0)->sum('stock');
        $totalStockAvailable = $newMobileStock + $oldMobileStock + $otherStock;

        $lowStockCount = Inventory::where('stock', '<=', 5)->where('stock', '>', 0)->count();

        $newMobileOutOfStock = Inventory::with('product.brand')->where('stock', '<=', 0)->whereHas('product', fn($q) => $q->where('category_id', $newMobileCatId))->get();
        $oldMobileOutOfStock = Inventory::with('product.brand')->where('stock', '<=', 0)->whereHas('product', fn($q) => $q->where('category_id', $oldMobileCatId))->get();
        $otherOutOfStockCount = Inventory::where('stock', '<=', 0)->whereHas('product', fn($q) => $q->whereNotIn('category_id', $mobileCatIds))->count();

        $rule = str_repeat('━', 22);
        $title = $slot === 'afternoon' ? '🕔 *AFTERNOON UPDATE*' : '🌙 *NIGHT CLOSING SUMMARY*';

        $msg  = "{$title}\n";
        $msg .= "📅 {$dateStr}\n";
        $msg .= "{$rule}\n\n";

        // ── Sales & Repairs ──
        $totalSetsSold = $soldMobiles->sum('quantity');
        $msg .= "🛍️ *SALES* · {$saleCount} invoice" . ($saleCount === 1 ? '' : 's') . " · {$totalSetsSold} set" . ($totalSetsSold === 1 ? '' : 's') . " sold\n";
        if ($soldMobiles->isEmpty()) {
            $msg .= "   _No mobiles sold today_\n";
        } else {
            foreach ($soldMobiles as $item) {
                $customer = $item->invoice->customer;
                $name = $customer->name ?? $item->invoice->customer_name ?? 'Walk-in';
                $phone = $customer->phone ?? $item->invoice->customer_phone ?? '—';
                $product = $item->product;
                $brand = $product?->brand?->name ?: ($product?->attributes['brand'] ?? '');
                $model = trim("{$brand} " . ($product?->name ?? 'Unknown'));
                $msg .= "   • {$model} — {$name} ({$phone})\n";
            }
        }
        $msg .= "\n";

        $msg .= "🔧 *REPAIRS* · {$repairCount} booked\n";
        if ($todaysRepairs->isEmpty()) {
            $msg .= "   _No repairs booked today_\n";
        } else {
            foreach ($todaysRepairs as $r) {
                $problem = is_array($r->issue_description) ? implode(', ', $r->issue_description) : $r->issue_description;
                $msg .= "   • {$r->device_model} ({$problem}) — {$r->customer_name} ({$r->customer_phone})\n";
            }
        }
        $msg .= "\n{$rule}\n\n";

        // ── Money ──
        $msg .= "💰 *MONEY IN*\n";
        $msg .= $this->buildLedgerBlock(['Cash' => $cashIn, 'Bank/UPI' => $bankIn], 'TOTAL', $totalIn);
        if ($exchangeIn > 0 || $financeIn > 0) {
            $msg .= "ℹ️ _Not counted above (no real cash movement):_\n";
            if ($exchangeIn > 0) $msg .= "   _• Old Mobile Exchange Credit: ₹" . number_format($exchangeIn, 2) . "_\n";
            if ($financeIn > 0) $msg .= "   _• Finance/EMI Receivable: ₹" . number_format($financeIn, 2) . "_\n";
        }
        $msg .= "\n💸 *MONEY OUT*\n";
        $msg .= $this->buildLedgerBlock(['Cash' => $cashOut, 'Bank/UPI' => $bankOut], 'TOTAL', $totalOut);
        $msg .= "\n🧮 *Net Day Cash: ₹" . number_format($cashIn - $cashOut, 2) . "*\n";
        $msg .= "\n{$rule}\n\n";

        // ── Finance ──
        $msg .= "💳 *FINANCE*\n";
        $msg .= "*Personal Finance* · " . count($personalFinanceEntries) . " done\n";
        if (empty($personalFinanceEntries)) {
            $msg .= "   _None today_\n";
        } else {
            foreach ($personalFinanceEntries as $line) $msg .= "   • {$line}\n";
        }
        $msg .= "\n*Company Finance* · " . count($companyFinanceEntries) . " done\n";
        if (empty($companyFinanceEntries)) {
            $msg .= "   _None today_\n";
        } else {
            foreach ($companyFinanceEntries as $line) $msg .= "   • {$line}\n";
        }
        $msg .= "\n";
        $msg .= $this->buildLedgerBlock([
            'Personal' => $personalFinanceDone,
            'Company'  => $companyFinanceDone,
        ], 'TOTAL', $personalFinanceDone + $companyFinanceDone);
        $msg .= "\n{$rule}\n\n";

        // ── Stock ──
        $msg .= "📦 *STOCK*\n";
        $msg .= $this->buildLedgerBlock([
            'New Mobile' => $newMobileStock,
            '2nd Hand'   => $oldMobileStock,
            'Other'      => $otherStock,
        ], 'AVAILABLE', $totalStockAvailable, false);
        $msg .= "⚠️ Low Stock (≤5): {$lowStockCount}\n";
        $msg .= "⛔ Out of Stock: New {$newMobileOutOfStock->count()} · 2nd Hand {$oldMobileOutOfStock->count()} · Other {$otherOutOfStockCount}\n";

        if (self::SHOW_OUT_OF_STOCK_TABLES) {
            if ($newMobileOutOfStock->count() > 0) {
                $msg .= "\n⛔ *NEW MOBILE — OUT OF STOCK*\n";
                $msg .= $this->buildOutOfStockTable($newMobileOutOfStock, 20);
            }
            if ($oldMobileOutOfStock->count() > 0) {
                $msg .= "\n⛔ *2ND HAND — OUT OF STOCK*\n";
                $msg .= $this->buildOutOfStockTable($oldMobileOutOfStock, 20);
            }
        }

        $msg .= "\n{$rule}\n";
        $msg .= "_Tinku Mobiles Management System_";

        return $msg;
    }

    /**
     * "Model — CustomerName (Phone) — ₹Amount (label)" style line for a Finance
     * entry — matches the "who bought what" format already used for the sold-
     * mobiles list, so the owner can see at a glance which set/customer a
     * finance payment belongs to, not just a bare total.
     */
    private function financeEntryLine(\App\Models\SaleInvoice $invoice, float $amount, string $label): string
    {
        $customer = $invoice->customer;
        $name = $customer->name ?? $invoice->customer_name ?? 'Walk-in';
        $phone = $customer->phone ?? $invoice->customer_phone ?? '—';
        $model = $invoice->items->map(function ($item) {
            $product = $item->product;
            $brand = $product?->brand?->name ?: ($product?->attributes['brand'] ?? '');
            return trim("{$brand} " . ($product?->name ?? 'Unknown'));
        })->implode(', ');

        return "{$model} — {$name} ({$phone}) — ₹" . number_format($amount, 2) . " ({$label})";
    }

    /**
     * Renders a small aligned label/value block inside a monospace code block —
     * a divider line, then a bold total row. Set $currency=false for plain unit
     * counts (e.g. stock), true (default) to prefix values with ₹.
     */
    private function buildLedgerBlock(array $rows, string $totalLabel, float $total, bool $currency = true): string
    {
        $fmt = fn($v) => $currency ? '₹' . number_format($v, 2) : number_format($v);
        $lines = [];
        foreach ($rows as $label => $value) {
            $lines[] = sprintf('%-12s %12s', $label, $fmt($value));
        }
        $lines[] = str_repeat('─', 25);
        $lines[] = sprintf('%-12s %12s', $totalLabel, $fmt($total));
        return "```\n" . implode("\n", $lines) . "\n```\n";
    }

    public function buildEmiDueReminderMessage(): string
    {
        $today = Carbon::today();
        $cutoff = $today->copy()->addDays(2);

        $plans = SaleFinancePlan::with(['customer', 'saleInvoice'])
            ->where('type', 'PERSONAL')
            ->where('status', '!=', 'SETTLED')
            ->get();

        $overdue = [];
        $dueSoon = [];

        foreach ($plans as $plan) {
            foreach ($plan->buildSchedule() as $emi) {
                if ($emi['status'] === 'PAID') continue;

                $dueDate = Carbon::parse($emi['due_date']);
                $row = [
                    'customer' => $plan->customer?->name ?? 'Unknown',
                    'phone'    => $plan->customer?->phone ?? '—',
                    'invoice'  => $plan->saleInvoice?->invoice_no ?? '—',
                    'emi_no'   => $emi['emi_no'],
                    'due_date' => $dueDate->format('d M Y'),
                    'amount'   => $emi['amount'],
                ];

                if ($emi['status'] === 'OVERDUE') {
                    $overdue[] = $row;
                } elseif ($dueDate->between($today, $cutoff)) {
                    $dueSoon[] = $row;
                }
            }
        }

        $msg = "📅 *EMI Due Reminder ({$today->format('d M Y')})*\n";
        $msg .= "---------------------------\n";

        if (empty($overdue) && empty($dueSoon)) {
            $msg .= "✅ No EMIs overdue or due in the next 2 days.";
        } else {
            if (!empty($overdue)) {
                $msg .= "⚠️ *OVERDUE (" . count($overdue) . "):*\n";
                $msg .= $this->buildEmiTable($overdue);
                $msg .= "\n";
            }
            if (!empty($dueSoon)) {
                $msg .= "🔔 *DUE IN NEXT 2 DAYS (" . count($dueSoon) . "):*\n";
                $msg .= $this->buildEmiTable($dueSoon);
            }
        }

        $msg .= "\n---------------------------\n";
        $msg .= "_Tinku Mobiles Management System_";

        return $msg;
    }

    /**
     * Full list of every repair not yet delivered — sent every 2 hours as a
     * nudge to keep statuses current, not just a count. Capped defensively
     * for Telegram's ~4096 character limit, same as the other list builders
     * in this file.
     */
    public function buildRepairStatusReminderMessage(int $limit = 40): string
    {
        $now = Carbon::now();
        $repairs = RepairRequest::where('status', '!=', 'delivered')
            ->orderBy('submitted_date')
            ->get();

        $msg = "⏰ *Repair Status Reminder ({$now->format('d M Y, h:i A')})*\n";
        $msg .= "---------------------------\n";

        if ($repairs->isEmpty()) {
            $msg .= "✅ No repairs pending — every job is delivered.";
        } else {
            $msg .= "🔧 *{$repairs->count()} repair(s) need a status update:*\n\n";
            foreach ($repairs->take($limit) as $r) {
                $forwarded = ($r->is_forwarded && $r->forwarded_to)
                    ? " — Forwarded: {$r->forwarded_to}" . ($r->forwarded_phone ? " ({$r->forwarded_phone})" : '')
                    : '';
                $msg .= "#{$r->id} {$r->device_model} — {$r->customer_name} ({$r->customer_phone})\n";
                $msg .= "   Status: " . strtoupper($r->status) . $forwarded . "\n\n";
            }
            if ($repairs->count() > $limit) {
                $msg .= "... +" . ($repairs->count() - $limit) . " more\n";
            }
        }

        $msg .= "---------------------------\n";
        $msg .= "_Tinku Mobiles Management System_";

        return $msg;
    }

    /**
     * Every open "promise to pay" note, split into today's and overdue —
     * fulfilled/superseded notes are excluded since they no longer need chasing.
     */
    public function buildPromiseToPayReminderMessage(): string
    {
        $today = Carbon::today();

        // Re-verify against live balances first — otherwise a customer who
        // already paid (through any route other than the one specific invoice
        // the note was linked to) keeps getting chased for a debt that's gone.
        EntityNote::reconcilePending();

        $notes = EntityNote::where('status', 'PENDING')
            ->where('promise_date', '<=', $today)
            ->orderBy('promise_date')
            ->get();

        $dueToday = $notes->filter(fn ($n) => $n->promise_date->isSameDay($today));
        $overdue = $notes->filter(fn ($n) => $n->promise_date->lt($today));

        $msg = "🤝 *Promise to Pay Reminder ({$today->format('d M Y')})*\n";
        $msg .= "---------------------------\n";

        if ($notes->isEmpty()) {
            $msg .= "✅ No promises due today or overdue.";
        } else {
            $render = function ($rows) use (&$msg, $today) {
                foreach ($rows as $n) {
                    $daysOverdue = $n->promise_date->lt($today) ? $n->promise_date->diffInDays($today) : 0;
                    $amount = $n->balance_at_time !== null ? '₹' . number_format($n->balance_at_time, 0) : '—';
                    $phone = $n->phone ? " ({$n->phone})" : '';
                    $msg .= "• {$n->name}{$phone} — {$amount}" . ($daysOverdue > 0 ? " — {$daysOverdue}d overdue" : '') . "\n";
                }
            };

            if ($dueToday->isNotEmpty()) {
                $msg .= "\n📌 *Due Today ({$dueToday->count()}):*\n";
                $render($dueToday);
            }
            if ($overdue->isNotEmpty()) {
                $msg .= "\n🔴 *Overdue ({$overdue->count()}):*\n";
                $render($overdue);
            }
        }

        $msg .= "\n---------------------------\n";
        $msg .= "_Tinku Mobiles Management System_";

        return $msg;
    }

    /**
     * A phone number rendered as an explicit tel: link, so it's reliably
     * clickable in Telegram regardless of the client's own (inconsistent)
     * auto-detection of bare digit strings as phone numbers.
     */
    private function telegramPhoneLink(?string $phone): string
    {
        if (!$phone) return '';
        $digits = preg_replace('/[^0-9+]/', '', $phone);
        return " - [{$phone}](tel:{$digits})";
    }

    /**
     * Plain Name - Mobile - Balance list of every Customer (not Shop Customer
     * — a separate relationship) with a pending balance — same shape as the
     * "Copy List" button on that page. Sent as its own Telegram message
     * (see buildPromiseListMessage for the companion Promise to Pay one) so
     * either can be read/forwarded independently.
     */
    public function buildPendingBalanceListMessage(int $limit = 40): string
    {
        $today = Carbon::today();

        $allEntities = collect(
            app(\App\Http\Controllers\Api\LedgerController::class)
                ->entityBalances(new \Illuminate\Http\Request())
                ->getData(true)
        );

        $pending = $allEntities
            ->filter(fn ($e) => $e['type'] === 'CUSTOMER')
            ->filter(fn ($e) => (float) $e['net_balance'] > 0.01)
            ->sortByDesc('net_balance')
            ->values();

        $msg = "💰 *Pending Balance ({$today->format('d M Y')}) — {$pending->count()}*\n";
        $msg .= "---------------------------\n";

        if ($pending->isEmpty()) {
            $msg .= "✅ Nothing pending.\n";
        } else {
            // Telegram caps messages at ~4096 characters — with a shop this
            // size routinely having 50+ entries, an unbounded list silently
            // fails to send at all. Cap the DISPLAYED rows (highest balances
            // first, so what's cut is the least urgent), but keep the Total
            // accurate across every entry, not just the shown ones.
            $total = $pending->sum(fn ($e) => (float) $e['net_balance']);
            foreach ($pending->take($limit) as $i => $e) {
                $msg .= ($i + 1) . ". {$e['name']}" . $this->telegramPhoneLink($e['phone']) . " - ₹" . number_format($e['net_balance'], 0) . "\n";
            }
            if ($pending->count() > $limit) {
                $msg .= "... +" . ($pending->count() - $limit) . " more\n";
            }
            $msg .= "*Total: ₹" . number_format($total, 0) . "*\n";
        }

        $msg .= "---------------------------\n";
        $msg .= "_Tinku Mobiles Management System_";

        return $msg;
    }

    /**
     * Plain Name - Mobile - Balance - Promised Date list of every open
     * Promise to Pay note — the companion message to
     * buildPendingBalanceListMessage, sent separately.
     */
    public function buildPromiseListMessage(int $limit = 30): string
    {
        $today = Carbon::today();

        EntityNote::reconcilePending();
        $promises = EntityNote::where('status', 'PENDING')->orderBy('promise_date')->get();

        $msg = "🤝 *Promise to Pay ({$today->format('d M Y')}) — {$promises->count()}*\n";
        $msg .= "---------------------------\n";

        if ($promises->isEmpty()) {
            $msg .= "✅ Nothing pending.\n";
        } else {
            $promiseTotal = $promises->sum(fn ($n) => (float) ($n->balance_at_time ?? 0));
            foreach ($promises->take($limit) as $i => $n) {
                $amount = $n->balance_at_time !== null ? '₹' . number_format($n->balance_at_time, 0) : '—';
                $overdueTag = $n->promise_date->lt($today) ? ' (OVERDUE)' : '';
                $msg .= ($i + 1) . ". {$n->name}" . $this->telegramPhoneLink($n->phone) . " - {$amount} - Promised: " . $n->promise_date->format('d M') . "{$overdueTag}\n";
            }
            if ($promises->count() > $limit) {
                $msg .= "... +" . ($promises->count() - $limit) . " more\n";
            }
            $msg .= "*Total: ₹" . number_format($promiseTotal, 0) . "*\n";
        }

        $msg .= "---------------------------\n";
        $msg .= "_Tinku Mobiles Management System_";

        return $msg;
    }

    /**
     * Renders a numbered, column-aligned table of out-of-stock items inside a
     * Telegram/WhatsApp monospace code block. Capped defensively — Telegram messages
     * have a ~4096 character limit, so a shop with a huge out-of-stock list would
     * otherwise silently fail to send the whole message.
     */
    private function buildOutOfStockTable($items, int $limit = 40): string
    {
        $lines = [];
        $lines[] = sprintf('%-3s %-14s %s', '#', 'COMPANY', 'MODEL / CONFIG');
        $lines[] = str_repeat('-', 45);

        foreach ($items->take($limit) as $i => $inv) {
            $product = $inv->product;
            $brand = $product->brand?->name ?: ($product->attributes['brand'] ?? '—');
            $brand = strlen($brand) > 14 ? substr($brand, 0, 12) . '..' : $brand;

            $model = $product->name;
            $specs = collect([$product->attributes['ram'] ?? null, $product->attributes['storage'] ?? null, $product->attributes['color'] ?? null])
                ->filter()->implode('/');
            $modelLine = $specs ? "{$model} ({$specs})" : $model;
            $modelLine = strlen($modelLine) > 28 ? substr($modelLine, 0, 26) . '..' : $modelLine;

            $lines[] = sprintf('%-3d %-14s %s', $i + 1, $brand, $modelLine);
        }

        if ($items->count() > $limit) {
            $lines[] = '... +' . ($items->count() - $limit) . ' more';
        }

        return "```\n" . implode("\n", $lines) . "\n```\n";
    }

    /**
     * Renders a numbered, column-aligned EMI table inside a monospace code block.
     * Uses plain ASCII "..." for truncation, not a unicode ellipsis — sprintf/str_pad
     * count bytes, so a multi-byte character would silently break column alignment.
     */
    private function buildEmiTable(array $rows): string
    {
        $lines = [];
        $lines[] = sprintf('%-2s %-14s %-10s %8s  %s', '#', 'CUSTOMER', 'PHONE', 'AMOUNT', 'DUE DATE');
        $lines[] = str_repeat('-', 50);

        foreach ($rows as $i => $r) {
            $name = strlen($r['customer']) > 14 ? substr($r['customer'], 0, 12) . '..' : $r['customer'];
            $lines[] = sprintf('%-2d %-14s %-10s %8s  %s', $i + 1, $name, $r['phone'], number_format($r['amount'], 0), $r['due_date']);
        }

        return "```\n" . implode("\n", $lines) . "\n```\n";
    }
}
