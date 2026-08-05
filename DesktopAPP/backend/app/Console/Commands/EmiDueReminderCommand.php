<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\ReportNotificationService;

class EmiDueReminderCommand extends Command
{
    protected $signature = 'report:emi-due-reminder';

    protected $description = 'Send an alert (WhatsApp + Telegram) listing Personal EMI installments that are overdue or due within the next 2 days';

    public function handle(ReportNotificationService $service)
    {
        $msg = $service->buildEmiDueReminderMessage();
        $result = $service->sendToChannels($msg);

        if ($result['whatsapp'] || $result['telegram']) {
            $this->info('EMI due reminder sent successfully (WhatsApp: ' . ($result['whatsapp'] ? 'yes' : 'no') . ', Telegram: ' . ($result['telegram'] ? 'yes' : 'no') . ').');
        } else {
            $this->error('Failed to send EMI due reminder via any channel.');
        }
    }
}
