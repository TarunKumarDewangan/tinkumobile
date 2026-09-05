<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\ReportNotificationService;
use App\Services\TelegramService;

class PendingBalanceGroupSummaryCommand extends Command
{
    protected $signature = 'report:pending-balance-group-summary';

    protected $description = 'Send the daily Pending Balance + Promise to Pay + Personal Finance Due lists to the dedicated Telegram group';

    public function handle(ReportNotificationService $service, TelegramService $telegram)
    {
        if (!$telegram->isPendingGroupConfigured()) {
            $this->warn('Pending Balance Telegram group is not configured — skipping.');
            return;
        }

        // Sent as three separate lists (Pending Balance, Promise to Pay,
        // Personal Finance Due), each possibly split into several messages
        // of 25 rows so nothing is ever silently cut off with "+N more". A
        // short gap between every single send avoids Telegram's brief
        // rate-limiting of rapid back-to-back sends from the same bot to
        // the same chat.
        $allMessages = array_merge(
            $service->buildPendingBalanceListMessages(),
            $service->buildPromiseListMessages(),
            $service->buildPersonalFinanceDueListMessages()
        );

        $allSent = true;
        foreach ($allMessages as $i => $msg) {
            if ($i > 0) sleep(1);
            $allSent = $telegram->sendToPendingGroup($msg) && $allSent;
        }

        // Also send everything as one HTML file — an easier-to-read
        // alternative to scrolling through several chunked text messages.
        // The short pause avoids Telegram briefly rate-limiting this send
        // for landing right after a burst of text messages to the same chat.
        if (count($allMessages) > 0) sleep(1);
        $filename = 'daily-report-' . now()->format('Y-m-d') . '.html';
        $allSent = $telegram->sendDocumentToPendingGroup($filename, $service->buildFullReportHtml(), '📄 Full report (one file)') && $allSent;

        if ($allSent) {
            $this->info('Pending Balance group summary sent successfully.');
        } else {
            $this->error('Failed to send one or more Pending Balance group messages.');
        }
    }
}
