<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\ReportNotificationService;

class RepairStatusReminderCommand extends Command
{
    protected $signature = 'report:repair-status-reminder';

    protected $description = 'Send a full list (WhatsApp + Telegram) of every repair not yet delivered, as a reminder to update statuses';

    public function handle(ReportNotificationService $service)
    {
        $msg = $service->buildRepairStatusReminderMessage();
        $result = $service->sendToChannels($msg);

        if ($result['whatsapp'] || $result['telegram']) {
            $this->info('Repair status reminder sent successfully (WhatsApp: ' . ($result['whatsapp'] ? 'yes' : 'no') . ', Telegram: ' . ($result['telegram'] ? 'yes' : 'no') . ').');
        } else {
            $this->error('Failed to send repair status reminder via any channel.');
        }
    }
}
