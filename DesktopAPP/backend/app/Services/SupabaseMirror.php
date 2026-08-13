<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * One-way mirror: pushes rows this app already saved into Supabase, for the
 * Next.js app (/webapp) to read. This app is always the source of truth —
 * Supabase never feeds data back here. Every call is best-effort: a failure
 * here must never affect the real save, so everything is caught and logged.
 */
class SupabaseMirror
{
    public function enabled(): bool
    {
        return filled(config('services.supabase.url')) && filled(config('services.supabase.service_key'));
    }

    public function upsert(string $table, array $row): void
    {
        if (! $this->enabled()) {
            return;
        }

        try {
            Http::withHeaders([...$this->headers(), 'Prefer' => 'resolution=merge-duplicates'])
                ->post(config('services.supabase.url')."/rest/v1/{$table}", $row)
                ->throw();
        } catch (\Throwable $e) {
            Log::warning("SupabaseMirror upsert failed for {$table}", [
                'error' => $e->getMessage(),
                'id' => $row['id'] ?? null,
            ]);
        }
    }

    public function delete(string $table, int|string $id): void
    {
        if (! $this->enabled()) {
            return;
        }

        try {
            Http::withHeaders($this->headers())
                ->delete(config('services.supabase.url')."/rest/v1/{$table}?id=eq.{$id}")
                ->throw();
        } catch (\Throwable $e) {
            Log::warning("SupabaseMirror delete failed for {$table}", [
                'error' => $e->getMessage(),
                'id' => $id,
            ]);
        }
    }

    private function headers(): array
    {
        $key = config('services.supabase.service_key');

        return [
            'apikey' => $key,
            'Authorization' => "Bearer {$key}",
            'Content-Type' => 'application/json',
        ];
    }
}
