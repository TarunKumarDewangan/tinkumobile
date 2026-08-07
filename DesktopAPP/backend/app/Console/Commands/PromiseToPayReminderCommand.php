<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\ReportNotificationService;

class PromiseToPayReminderCommand extends Command
{
    protected $signature = 'report:promise-to-pay-reminder';

    protected $description = 'Send a daily list (WhatsApp + Telegram) of promise-to-pay notes due today or overdue';

    public function handle(ReportNotificationService $service)
    {
        $msg = $service->buildPromiseToPayReminderMessage();
        $result = $service->sendToChannels($msg);

        if ($result['whatsapp'] || $result['telegram']) {
            $this->info('Promise-to-pay reminder sent successfully (WhatsApp: ' . ($result['whatsapp'] ? 'yes' : 'no') . ', Telegram: ' . ($result['telegram'] ? 'yes' : 'no') . ').');
        } else {
            $this->error('Failed to send promise-to-pay reminder via any channel.');
        }
    }
}
