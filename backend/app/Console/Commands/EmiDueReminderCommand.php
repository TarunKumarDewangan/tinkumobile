<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\SaleFinancePlan;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;

class EmiDueReminderCommand extends Command
{
    protected $signature = 'report:emi-due-reminder';

    protected $description = 'Send an alert (WhatsApp + Telegram) listing Personal EMI installments that are overdue or due within the next 2 days';

    public function handle()
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
                $msg .= $this->buildTable($overdue);
                $msg .= "\n";
            }
            if (!empty($dueSoon)) {
                $msg .= "🔔 *DUE IN NEXT 2 DAYS (" . count($dueSoon) . "):*\n";
                $msg .= $this->buildTable($dueSoon);
            }
        }

        $msg .= "\n---------------------------\n";
        $msg .= "_Tinku Mobiles Management System_";

        $whatsappOk = false;
        $telegramOk = false;

        try {
            $whatsappOk = app(\App\Services\WhatsAppService::class)->sendToOwner($msg);
        } catch (\Exception $e) {
            Log::error('Failed to send EMI Due Reminder WhatsApp', ['error' => $e->getMessage()]);
        }

        try {
            $telegramOk = app(\App\Services\TelegramService::class)->sendToOwner($msg);
        } catch (\Exception $e) {
            Log::error('Failed to send EMI Due Reminder Telegram', ['error' => $e->getMessage()]);
        }

        if ($whatsappOk || $telegramOk) {
            $this->info('EMI due reminder sent successfully (WhatsApp: ' . ($whatsappOk ? 'yes' : 'no') . ', Telegram: ' . ($telegramOk ? 'yes' : 'no') . ').');
        } else {
            $this->error('Failed to send EMI due reminder via any channel.');
        }
    }

    /**
     * Renders a numbered, column-aligned table inside a Telegram/WhatsApp monospace
     * code block (```). Uses plain ASCII "..." for truncation, not a unicode ellipsis —
     * sprintf/str_pad count bytes, so a multi-byte character would silently break
     * column alignment.
     */
    private function buildTable(array $rows): string
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
