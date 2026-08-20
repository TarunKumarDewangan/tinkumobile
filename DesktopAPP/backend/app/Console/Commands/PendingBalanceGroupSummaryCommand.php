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

        // Sent as three separate messages (not one combined one) so any one
        // can be read/forwarded on its own.
        $pendingSent = $telegram->sendToPendingGroup($service->buildPendingBalanceListMessage());
        $promiseSent = $telegram->sendToPendingGroup($service->buildPromiseListMessage());
        $financeSent = $telegram->sendToPendingGroup($service->buildPersonalFinanceDueListMessage());

        if ($pendingSent && $promiseSent && $financeSent) {
            $this->info('Pending Balance group summary sent successfully.');
        } else {
            $this->error('Failed to send one or more Pending Balance group messages.');
        }
    }
}
