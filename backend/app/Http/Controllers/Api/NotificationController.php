<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Services\ReportNotificationService;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    /**
     * Manually trigger the same reports the scheduler sends automatically — for
     * Settings > Notifications "Send Now" buttons. Completely separate from the
     * cron schedule; this never changes when the automatic ones fire.
     */
    public function sendDailySummary(Request $request, ReportNotificationService $service)
    {
        $user = $request->user();
        if (!($user->is_owner || $user->hasRole('Admin'))) {
            return response()->json(['message' => 'Only owner or admin can send reports manually'], 403);
        }

        $data = $request->validate([
            'slot' => 'nullable|in:afternoon,night',
        ]);

        $msg = $service->buildDailySummaryMessage($data['slot'] ?? 'night');
        $result = $service->sendToChannels($msg);

        ActivityLog::log('MANUAL_DAILY_SUMMARY_SENT', $user, "Daily summary manually sent by {$user->name}");

        return response()->json([
            'message' => $msg,
            'whatsapp' => $result['whatsapp'],
            'telegram' => $result['telegram'],
        ]);
    }

    public function sendEmiDueReminder(Request $request, ReportNotificationService $service)
    {
        $user = $request->user();
        if (!($user->is_owner || $user->hasRole('Admin'))) {
            return response()->json(['message' => 'Only owner or admin can send reports manually'], 403);
        }

        $msg = $service->buildEmiDueReminderMessage();
        $result = $service->sendToChannels($msg);

        ActivityLog::log('MANUAL_EMI_REMINDER_SENT', $user, "EMI due reminder manually sent by {$user->name}");

        return response()->json([
            'message' => $msg,
            'whatsapp' => $result['whatsapp'],
            'telegram' => $result['telegram'],
        ]);
    }

    public function sendRepairStatusReminder(Request $request, ReportNotificationService $service)
    {
        $user = $request->user();
        if (!($user->is_owner || $user->hasRole('Admin'))) {
            return response()->json(['message' => 'Only owner or admin can send reports manually'], 403);
        }

        $msg = $service->buildRepairStatusReminderMessage();
        $result = $service->sendToChannels($msg);

        ActivityLog::log('MANUAL_REPAIR_REMINDER_SENT', $user, "Repair status reminder manually sent by {$user->name}");

        return response()->json([
            'message' => $msg,
            'whatsapp' => $result['whatsapp'],
            'telegram' => $result['telegram'],
        ]);
    }
}
