<?php

namespace App\Jobs;

use App\Services\SupabaseMirror;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class MirrorRecordToSupabase implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $backoff = 30;

    public function __construct(
        private readonly string $table,
        private readonly string $action, // 'upsert' | 'delete'
        private readonly array $row = [],
        private readonly int|string|null $id = null,
    ) {
    }

    public function handle(SupabaseMirror $mirror): void
    {
        if ($this->action === 'delete') {
            $mirror->delete($this->table, $this->id);
            return;
        }

        $mirror->upsert($this->table, $this->row);
    }
}
