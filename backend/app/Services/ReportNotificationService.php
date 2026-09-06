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
            ->whereIn('type', ['PERSONAL', 'PROCESSING_FEE'])
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
     * auto-detection of bare digit strings as phone numbers. Uses only the
     * digits (never the raw, uncleaned phone field) for both the display
     * text and the URL — Telegram rejects the ENTIRE message if any [ ] ( )
     * character sneaks into a Markdown link's text, which real phone data
     * (extra spaces, dashes, a stray bracket) can easily contain.
     */
    private function telegramPhoneLink(?string $phone): string
    {
        if (!$phone) return '';
        $digits = preg_replace('/[^0-9+]/', '', $phone);
        if ($digits === '') return '';
        return " - [{$digits}](tel:{$digits})";
    }

    /**
     * Legacy Telegram Markdown treats _ * ` [ as formatting characters —
     * escape them in any user-entered text (customer/entity names) before
     * inserting it into a Markdown-formatted message, otherwise a single
     * name containing one of these breaks parsing for the WHOLE message,
     * not just that row (confirmed live: "Can't find end of the entity").
     */
    private function escapeTelegramMarkdown(string $text): string
    {
        return str_replace(['_', '*', '`', '['], ['\\_', '\\*', '\\`', '\\['], $text);
    }

    /**
     * Splits a long list into several full Telegram messages (each with its
     * own header/footer/Total) instead of one message with a "+N more"
     * trailer — Telegram caps messages at ~4096 characters, and a shop this
     * size routinely has 50+ pending entries, so a single unbounded message
     * would silently fail to send. Each chunk is its own complete message so
     * every entry is actually visible, just spread across multiple sends.
     *
     * @param \Illuminate\Support\Collection $items
     * @param callable $formatRow fn($row): string — one already-formatted row line
     */
    private function chunkListMessages(string $emoji, string $title, string $todayLabel, $items, callable $formatRow, float $total, string $emptyLine, int $chunkSize = 10): array
    {
        $header = "{$emoji} *{$title} ({$todayLabel}) — {$items->count()}*\n---------------------------\n";
        $footer = "---------------------------\n_Tinku Mobiles Management System_";

        if ($items->isEmpty()) {
            return [$header . $emptyLine . "\n" . $footer];
        }

        $chunks = $items->chunk($chunkSize)->values();
        $totalChunks = $chunks->count();
        $messages = [];

        foreach ($chunks as $idx => $chunk) {
            $page = $totalChunks > 1 ? ' (Part ' . ($idx + 1) . "/{$totalChunks})" : '';
            $msg = "{$emoji} *{$title}{$page} ({$todayLabel}) — {$items->count()}*\n---------------------------\n";
            $startNum = $idx * $chunkSize;
            foreach ($chunk->values() as $i => $row) {
                $msg .= ($startNum + $i + 1) . '. ' . $formatRow($row) . "\n";
            }
            if ($idx === $totalChunks - 1) {
                $msg .= '*Total: ₹' . number_format($total, 0) . "*\n";
            }
            $msg .= $footer;
            $messages[] = $msg;
        }

        return $messages;
    }

    /**
     * Plain Name - Mobile - Balance list of every Customer (not Shop Customer
     * — a separate relationship) with a pending balance — same shape as the
     * "Copy List" button on that page. Sent as its own set of Telegram
     * messages, split into chunks so nothing is silently cut off (see
     * buildPromiseListMessages for the companion Promise to Pay one) so
     * either can be read/forwarded independently.
     *
     * @return string[]
     */
    /**
     * Raw rows behind buildPendingBalanceListMessages() — shared with
     * buildFullReportHtml() so the Telegram messages and the one-file HTML
     * export can never drift apart.
     */
    private function getPendingBalanceRows()
    {
        $allEntities = collect(
            app(\App\Http\Controllers\Api\LedgerController::class)
                ->entityBalances(new \Illuminate\Http\Request())
                ->getData(true)
        );

        return $allEntities
            ->filter(fn ($e) => $e['type'] === 'CUSTOMER')
            ->filter(fn ($e) => (float) $e['net_balance'] > 0.01)
            ->sortByDesc('net_balance')
            ->values();
    }

    public function buildPendingBalanceListMessages(int $chunkSize = 10): array
    {
        $today = Carbon::today();
        $pending = $this->getPendingBalanceRows();
        $total = $pending->sum(fn ($e) => (float) $e['net_balance']);

        return $this->chunkListMessages(
            '💰',
            'Pending Balance',
            $today->format('d M Y'),
            $pending,
            fn ($e) => $this->escapeTelegramMarkdown($e['name']) . $this->telegramPhoneLink($e['phone']) . ' - ₹' . number_format($e['net_balance'], 0),
            $total,
            '✅ Nothing pending.',
            $chunkSize
        );
    }

    /**
     * Plain Name - Mobile - Balance - Promised Date list of every open
     * Promise to Pay note — the companion set of messages to
     * buildPendingBalanceListMessages, sent separately.
     *
     * @return string[]
     */
    /**
     * Raw rows behind buildPromiseListMessages() — shared with
     * buildFullReportHtml().
     */
    private function getPromiseRows()
    {
        EntityNote::reconcilePending();
        return EntityNote::where('status', 'PENDING')->orderBy('promise_date')->get();
    }

    public function buildPromiseListMessages(int $chunkSize = 10): array
    {
        $today = Carbon::today();
        $promises = $this->getPromiseRows();
        $total = $promises->sum(fn ($n) => (float) ($n->balance_at_time ?? 0));

        return $this->chunkListMessages(
            '🤝',
            'Promise to Pay',
            $today->format('d M Y'),
            $promises,
            function ($n) use ($today) {
                $amount = $n->balance_at_time !== null ? '₹' . number_format($n->balance_at_time, 0) : '—';
                $overdueTag = $n->promise_date->lt($today) ? ' (OVERDUE)' : '';
                return $this->escapeTelegramMarkdown($n->name) . $this->telegramPhoneLink($n->phone) . " - {$amount} - Promised: " . $n->promise_date->format('d M') . $overdueTag;
            },
            $total,
            '✅ Nothing pending.',
            $chunkSize
        );
    }

    /**
     * Plain Name - Mobile - Installment Amount - Due Date list of every
     * overdue or soon-due Personal EMI installment — same data as
     * buildEmiDueReminderMessage's Overdue/Due-in-2-days sections, just
     * flattened into the simple list shape used by the Pending Balance and
     * Promise to Pay messages, sent as its own set of Telegram messages.
     *
     * @return string[]
     */
    /**
     * Raw rows behind buildPersonalFinanceDueListMessages() — shared with
     * buildFullReportHtml().
     */
    private function getPersonalFinanceDueRows()
    {
        $today = Carbon::today();
        $cutoff = $today->copy()->addDays(2);

        $plans = SaleFinancePlan::with(['customer'])
            ->whereIn('type', ['PERSONAL', 'PROCESSING_FEE'])
            ->where('status', '!=', 'SETTLED')
            ->get();

        $rows = collect();
        foreach ($plans as $plan) {
            foreach ($plan->buildSchedule() as $emi) {
                if ($emi['status'] === 'PAID') continue;

                $dueDate = Carbon::parse($emi['due_date']);
                if ($emi['status'] !== 'OVERDUE' && !$dueDate->between($today, $cutoff)) continue;

                $rows->push([
                    'name' => $plan->customer?->name ?? 'Unknown',
                    'phone' => $plan->customer?->phone,
                    'amount' => (float) $emi['amount'],
                    'due_date' => $dueDate,
                    'overdue' => $emi['status'] === 'OVERDUE',
                ]);
            }
        }
        return $rows->sortBy('due_date')->values();
    }

    public function buildPersonalFinanceDueListMessages(int $chunkSize = 10): array
    {
        $today = Carbon::today();
        $rows = $this->getPersonalFinanceDueRows();
        $total = $rows->sum('amount');

        return $this->chunkListMessages(
            '📅',
            'Personal Finance Due',
            $today->format('d M Y'),
            $rows,
            function ($r) {
                $overdueTag = $r['overdue'] ? ' (OVERDUE)' : '';
                return $this->escapeTelegramMarkdown($r['name']) . $this->telegramPhoneLink($r['phone'])
                    . ' - ₹' . number_format($r['amount'], 0) . ' - Due: ' . $r['due_date']->format('d M') . $overdueTag;
            },
            $total,
            '✅ Nothing due.',
            $chunkSize
        );
    }

    /**
     * One self-contained HTML file with all three lists (Pending Balance,
     * Promise to Pay, Personal Finance Due) as proper tables — an alternative
     * to reading them as several chunked Telegram text messages. Sent as a
     * document attachment via TelegramService::sendDocumentToPendingGroup().
     * Pulls from the exact same row-builders as the text messages above so
     * the two can never show different numbers.
     */
    public function buildFullReportHtml(): string
    {
        $today = Carbon::today()->format('d M Y');
        $esc = fn ($v) => htmlspecialchars((string) ($v ?? ''), ENT_QUOTES, 'UTF-8');

        $pending = $this->getPendingBalanceRows();
        $promises = $this->getPromiseRows();
        $financeDue = $this->getPersonalFinanceDueRows();

        // Last few purchases per pending-balance entity — one batched query
        // covering every entity in the list, instead of one query each.
        $entityIds = $pending->pluck('id')->filter()->all();
        $recentByEntity = [];
        if (!empty($entityIds)) {
            $recentInvoices = SaleInvoice::where('is_cancelled', false)
                ->whereIn('accounting_entity_id', $entityIds)
                ->with('items.product')
                ->orderByDesc('sale_date')->orderByDesc('id')
                ->get();
            foreach ($recentInvoices->groupBy('accounting_entity_id') as $entId => $invoices) {
                $recentByEntity[$entId] = $invoices->take(3);
            }
        }

        $renderTable = function (string $title, string $emptyLabel, $rows, array $headers, callable $rowHtml, ?float $total = null, ?callable $subRowHtml = null) use ($esc) {
            $html = "<h2>{$esc($title)} <span class=\"count\">({$rows->count()})</span></h2>";
            if ($rows->isEmpty()) {
                return $html . "<p class=\"empty\">{$esc($emptyLabel)}</p>";
            }
            $colspan = count($headers) + 1;
            $html .= '<table><thead><tr><th>#</th>';
            foreach ($headers as $h) $html .= "<th>{$esc($h)}</th>";
            $html .= '</tr></thead><tbody>';
            foreach ($rows->values() as $i => $row) {
                $html .= '<tr><td>' . ($i + 1) . '</td>' . $rowHtml($row) . '</tr>';
                $sub = $subRowHtml ? $subRowHtml($row) : null;
                if ($sub) {
                    $html .= "<tr class=\"sub-row\"><td></td><td colspan=\"{$colspan}\">{$sub}</td></tr>";
                }
            }
            $html .= '</tbody>';
            if ($total !== null) {
                $html .= "<tfoot><tr><td></td><td colspan=\"{$colspan}\">Total: ₹" . number_format($total, 0) . '</td></tr></tfoot>';
            }
            $html .= '</table>';
            return $html;
        };

        $body = $renderTable(
            '💰 Pending Balance', '✅ Nothing pending.', $pending,
            ['Name', 'Mobile', 'Balance'],
            fn ($e) => '<td>' . $esc($e['name']) . '</td><td>' . $esc($e['phone']) . '</td><td>₹' . number_format($e['net_balance'], 0) . '</td>',
            $pending->sum(fn ($e) => (float) $e['net_balance']),
            function ($e) use ($esc, $recentByEntity) {
                $invoices = $recentByEntity[$e['id']] ?? collect();
                if ($invoices->isEmpty()) return null;
                $lines = $invoices->map(function ($inv) use ($esc) {
                    $items = $inv->items->map(fn ($it) => ($it->product->name ?? 'Unknown') . ($it->quantity > 1 ? " x{$it->quantity}" : ''))->implode(', ');
                    return $esc(Carbon::parse($inv->sale_date)->format('d M Y')) . ' — ' . $esc($items) . ' — ₹' . number_format($inv->grand_total, 0) . ' (#' . $esc($inv->invoice_no) . ')';
                })->implode('<br>');
                return "<span class=\"recent-label\">Last purchases:</span><br>{$lines}";
            }
        );

        $body .= $renderTable(
            '🤝 Promise to Pay', '✅ Nothing pending.', $promises,
            ['Name', 'Mobile', 'Balance', 'Promised'],
            function ($n) use ($esc) {
                $amount = $n->balance_at_time !== null ? '₹' . number_format($n->balance_at_time, 0) : '—';
                $overdue = $n->promise_date->lt(Carbon::today());
                $dateCell = $esc($n->promise_date->format('d M')) . ($overdue ? ' <span class="overdue">(OVERDUE)</span>' : '');
                return '<td>' . $esc($n->name) . '</td><td>' . $esc($n->phone) . '</td><td>' . $amount . '</td><td>' . $dateCell . '</td>';
            },
            $promises->sum(fn ($n) => (float) ($n->balance_at_time ?? 0))
        );

        $body .= $renderTable(
            '📅 Personal Finance Due', '✅ Nothing due.', $financeDue,
            ['Name', 'Mobile', 'Amount', 'Due Date'],
            function ($r) use ($esc) {
                $dateCell = $esc($r['due_date']->format('d M')) . ($r['overdue'] ? ' <span class="overdue">(OVERDUE)</span>' : '');
                return '<td>' . $esc($r['name']) . '</td><td>' . $esc($r['phone']) . '</td><td>₹' . number_format($r['amount'], 0) . '</td><td>' . $dateCell . '</td>';
            },
            $financeDue->sum('amount')
        );

        return <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Daily Report — {$today}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; margin: 24px; color: #1e293b; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  .subtitle { color: #64748b; margin-bottom: 24px; }
  h2 { font-size: 16px; margin-top: 28px; margin-bottom: 8px; border-bottom: 2px solid #cbd5e1; padding-bottom: 4px; }
  .count { color: #64748b; font-weight: normal; font-size: 13px; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 8px; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 10px; text-align: left; font-size: 13px; }
  th { background: #f1f5f9; text-transform: uppercase; font-size: 11px; }
  tfoot td { font-weight: bold; background: #f8fafc; }
  .empty { color: #16a34a; font-weight: bold; }
  .overdue { color: #dc2626; font-weight: bold; }
  .sub-row td { background: #fafafa; border-top: none; font-size: 12px; color: #475569; padding: 4px 10px 8px 24px; }
  .recent-label { text-transform: uppercase; font-size: 10px; letter-spacing: 0.04em; color: #94a3b8; font-weight: bold; }
</style>
</head>
<body>
<h1>Tinku Mobiles — Daily Report</h1>
<div class="subtitle">{$today}</div>
{$body}
</body>
</html>
HTML;
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
