<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\ActivityLog;

class PruneActivityLogsCommand extends Command
{
    protected $signature = 'activitylogs:prune';

    protected $description = 'Delete activity log entries older than 7 days';

    public function handle()
    {
        $deleted = ActivityLog::where('created_at', '<', now()->subDays(7))->delete();

        $this->info("Pruned {$deleted} activity log entries older than 7 days.");
    }
}
