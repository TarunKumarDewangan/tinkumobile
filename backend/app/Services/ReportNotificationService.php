<?php

namespace App\Services;

use App\Models\SaleInvoice;
use App\Models\AirtelRecovery;
use App\Models\RepairRequest;
use App\Models\Inventory;
use App\Models\SaleFinancePlan;
use App\Models\Transaction;
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
        $recoveryCount = AirtelRecovery::whereDate('recovered_at', $today)->count();
        $recoveryAmount = AirtelRecovery::whereDate('recovered_at', $today)->sum('amount');

        $cashIn = Transaction::whereDate('transaction_date', $today)->where('type', 'IN')->where('payment_mode', 'CASH')->sum('amount');
        $bankIn = Transaction::whereDate('transaction_date', $today)->where('type', 'IN')->where('payment_mode', '!=', 'CASH')->sum('amount');
        $cashOut = Transaction::whereDate('transaction_date', $today)->where('type', 'OUT')->where('payment_mode', 'CASH')->sum('amount');
        $bankOut = Transaction::whereDate('transaction_date', $today)->where('type', 'OUT')->where('payment_mode', '!=', 'CASH')->sum('amount');

        $totalIn = $cashIn + $bankIn;
        $totalOut = $cashOut + $bankOut;

        $totalStockAvailable = Inventory::where('stock', '>', 0)->sum('stock');
        $lowStockCount = Inventory::where('stock', '<=', 5)->where('stock', '>', 0)->count();
        $outOfStockItems = Inventory::with('product.brand')->where('stock', '<=', 0)->whereHas('product')->get();
        $outOfStockCount = $outOfStockItems->count();

        $msg = "{$header}\n";
        $msg .= "---------------------------\n";
        $msg .= "📝 *Activity Counts:*\n";
        $msg .= "• Sales Invoices: {$saleCount}\n";
        $msg .= "• Repairs Booked: {$repairCount}\n";
        $msg .= "• Airtel Recoveries: {$recoveryCount} (Total: ₹" . number_format($recoveryAmount, 2) . ")\n\n";

        $msg .= "💰 *Collections (IN):*\n";
        $msg .= "• Cash: ₹" . number_format($cashIn, 2) . "\n";
        $msg .= "• Bank/UPI: ₹" . number_format($bankIn, 2) . "\n";
        $msg .= "• *Total IN: ₹" . number_format($totalIn, 2) . "*\n\n";

        $msg .= "💸 *Payments (OUT):*\n";
        $msg .= "• Cash: ₹" . number_format($cashOut, 2) . "\n";
        $msg .= "• Bank/UPI: ₹" . number_format($bankOut, 2) . "\n";
        $msg .= "• *Total OUT: ₹" . number_format($totalOut, 2) . "*\n";
        $msg .= "---------------------------\n";
        $msg .= "📦 *Stock Alerts:*\n";
        $msg .= "• Total Stock Available: " . number_format($totalStockAvailable) . " units\n";
        $msg .= "• Low Stock (≤5): {$lowStockCount}\n";
        $msg .= "• Out of Stock: {$outOfStockCount}\n";
        if ($outOfStockCount > 0) {
            $msg .= "\n⛔ *OUT OF STOCK ITEMS:*\n";
            $msg .= $this->buildOutOfStockTable($outOfStockItems);
        }
        $msg .= "---------------------------\n";
        $msg .= "✨ *Closing Status:*\n";
        $msg .= "• Net Day Cash: ₹" . number_format($cashIn - $cashOut, 2) . "\n";
        $msg .= "---------------------------\n";
        $msg .= "_Tinku Mobiles Management System_";

        return $msg;
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
