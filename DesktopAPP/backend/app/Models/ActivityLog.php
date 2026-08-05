<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Request;

class ActivityLog extends Model
{
    protected $fillable = [
        'user_id',
        'action',
        'model_type',
        'model_id',
        'description',
        'ip_address',
        'user_agent'
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Static helper to log activities
     */
    public static function log($action, $model = null, $description = null)
    {
        $log = self::create([
            'user_id' => auth()->id() ?: 1, // Fallback to system admin if not logged in
            'action' => $action,
            'model_type' => $model ? get_class($model) : null,
            'model_id' => $model ? $model->id : null,
            'description' => $description,
            'ip_address' => Request::ip(),
            'user_agent' => Request::userAgent()
        ]);

        static::notifyOwnerIfNonAdmin($log);

        return $log;
    }

    /**
     * Every action already funnels through log() above, so this is the one
     * place that can catch "anything a non-owner/non-admin user does" without
     * touching the ~66 call sites scattered across the app. Owner/Admin
     * actions are not reported — the owner only wants to be alerted about
     * staff activity, not their own.
     */
    protected static function notifyOwnerIfNonAdmin(self $log): void
    {
        $user = auth()->user();
        if (!$user || $user->hasFullAccess()) {
            return;
        }

        try {
            $roleLabel = $user->getRoleNames()->implode(', ') ?: 'Staff';
            $message = "👤 *Staff Activity*\n"
                . "User: {$user->name} (ID: {$user->id}, {$roleLabel})\n"
                . "Action: {$log->action}"
                . ($log->description ? "\nDetails: {$log->description}" : '')
                . "\nTime: " . now()->format('d M Y, h:i A');

            app(\App\Services\TelegramService::class)->sendToOwner($message);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('ActivityLog Telegram notify failed', ['error' => $e->getMessage()]);
        }
    }
}
