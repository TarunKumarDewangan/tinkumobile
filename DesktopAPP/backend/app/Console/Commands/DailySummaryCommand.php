<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\ReportNotificationService;

class DailySummaryCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'report:daily-summary {--slot=night : afternoon or night, controls only the message header}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Send daily summary report to the owner via WhatsApp and Telegram at 5 PM and 9 PM';

    /**
     * Execute the console command.
     */
    public function handle(ReportNotificationService $service)
    {
        $msg = $service->buildDailySummaryMessage($this->option('slot'));
        $result = $service->sendToChannels($msg);

        if ($result['whatsapp'] || $result['telegram']) {
            $this->info('Daily summary sent successfully (WhatsApp: ' . ($result['whatsapp'] ? 'yes' : 'no') . ', Telegram: ' . ($result['telegram'] ? 'yes' : 'no') . ').');
        } else {
            $this->error('Failed to send daily summary via any channel.');
        }
    }
}
