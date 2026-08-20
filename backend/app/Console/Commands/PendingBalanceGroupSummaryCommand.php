<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\ReportNotificationService;
use App\Services\TelegramService;

class PendingBalanceGroupSummaryCommand extends Command
{
    protected $signature = 'report:pending-balance-group-summary';

    protected $description = 'Send the daily Pending Balance + Promise to Pay list to the dedicated Telegram group';

    public function handle(ReportNotificationService $service, TelegramService $telegram)
    {
        if (!$telegram->isPendingGroupConfigured()) {
            $this->warn('Pending Balance Telegram group is not configured — skipping.');
            return;
        }

        $msg = $service->buildPendingBalanceAndPromiseListMessage();
        $sent = $telegram->sendToPendingGroup($msg);

        if ($sent) {
            $this->info('Pending Balance group summary sent successfully.');
        } else {
            $this->error('Failed to send Pending Balance group summary.');
        }
    }
}
