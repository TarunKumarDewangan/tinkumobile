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
        // can be read/forwarded on its own. A short gap between each avoids
        // Telegram's brief rate-limiting of rapid back-to-back sends from the
        // same bot to the same chat.
        $pendingSent = $telegram->sendToPendingGroup($service->buildPendingBalanceListMessage());
        sleep(1);
        $promiseSent = $telegram->sendToPendingGroup($service->buildPromiseListMessage());
        sleep(1);
        $financeSent = $telegram->sendToPendingGroup($service->buildPersonalFinanceDueListMessage());

        if ($pendingSent && $promiseSent && $financeSent) {
            $this->info('Pending Balance group summary sent successfully.');
        } else {
            $this->error('Failed to send one or more Pending Balance group messages.');
        }
    }
}
