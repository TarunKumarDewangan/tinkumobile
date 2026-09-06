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

        // The chunked text messages (Pending Balance, Promise to Pay,
        // Personal Finance Due as separate 25-row-max messages) are turned
        // off for now — only the one-file HTML report below goes to the
        // group. Commented out, not deleted, in case they're wanted back:
        //
        // $allMessages = array_merge(
        //     $service->buildPendingBalanceListMessages(),
        //     $service->buildPromiseListMessages(),
        //     $service->buildPersonalFinanceDueListMessages()
        // );
        //
        // $allSent = true;
        // foreach ($allMessages as $i => $msg) {
        //     if ($i > 0) sleep(1);
        //     $allSent = $telegram->sendToPendingGroup($msg) && $allSent;
        // }

        $filename = 'daily-report-' . now()->format('Y-m-d') . '.html';
        $allSent = $telegram->sendDocumentToPendingGroup($filename, $service->buildFullReportHtml(), '📄 Full report (one file)');

        if ($allSent) {
            $this->info('Pending Balance group summary sent successfully.');
        } else {
            $this->error('Failed to send one or more Pending Balance group messages.');
        }
    }
}
