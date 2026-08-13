<?php

namespace App\Traits;

use App\Jobs\MirrorRecordToSupabase;

/**
 * Opt-in per model: queues a copy of every save/delete to Supabase, for the
 * Next.js app (/webapp) to read. Add `use MirrorsToSupabase;` to a model and
 * it starts mirroring — no-ops until SUPABASE_URL/SUPABASE_SERVICE_KEY are
 * set, so it's safe to add ahead of the Supabase project existing.
 *
 * Override supabaseTable() if the model name doesn't match the target table.
 */
trait MirrorsToSupabase
{
    public static function bootMirrorsToSupabase(): void
    {
        static::saved(function ($model) {
            MirrorRecordToSupabase::dispatch(
                $model->supabaseTable(),
                'upsert',
                $model->toArray(),
            );
        });

        static::deleted(function ($model) {
            MirrorRecordToSupabase::dispatch(
                $model->supabaseTable(),
                'delete',
                [],
                $model->id,
            );
        });
    }

    public function supabaseTable(): string
    {
        return $this->getTable();
    }
}
