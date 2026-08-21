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

    /**
     * Same list the 9 AM scheduled command sends, but lets the caller pick
     * which Telegram target(s) to actually deliver to right now — the
     * dedicated Pending Balance group, the main owner chat/channel, or both.
     */
    public function sendPendingBalanceSummary(Request $request, ReportNotificationService $service, \App\Services\TelegramService $telegram)
    {
        $user = $request->user();
        if (!($user->is_owner || $user->hasRole('Admin'))) {
            return response()->json(['message' => 'Only owner or admin can send reports manually'], 403);
        }

        $data = $request->validate([
            'channels' => 'required|array|min:1',
            'channels.*' => 'in:pending_group,owner',
        ]);

        // Sent as three separate lists (Pending Balance, Promise to Pay,
        // Personal Finance Due), each possibly split into several messages
        // of 25 rows so nothing is ever silently cut off with "+N more". A
        // short gap between every single send avoids Telegram's brief
        // rate-limiting of rapid back-to-back sends from the same bot to
        // the same chat — and every message is attempted regardless of
        // whether an earlier one failed, so one hiccup doesn't hide the rest.
        $allMessages = array_merge(
            $service->buildPendingBalanceListMessages(),
            $service->buildPromiseListMessages(),
            $service->buildPersonalFinanceDueListMessages()
        );

        $sendAll = function (callable $send) use ($allMessages) {
            $ok = true;
            foreach ($allMessages as $i => $msg) {
                if ($i > 0) sleep(1);
                $ok = $send($msg) && $ok;
            }
            return $ok;
        };

        $pendingGroupSent = false;
        $ownerSent = false;
        if (in_array('pending_group', $data['channels'])) {
            $pendingGroupSent = $sendAll(fn ($msg) => $telegram->sendToPendingGroup($msg));
        }
        if (in_array('owner', $data['channels'])) {
            $ownerSent = $sendAll(fn ($msg) => $telegram->sendToOwner($msg));
        }

        ActivityLog::log('MANUAL_PENDING_BALANCE_SUMMARY_SENT', $user, "Pending Balance summary manually sent by {$user->name}");

        return response()->json([
            'message' => implode("\n\n", $allMessages),
            'pending_group' => $pendingGroupSent,
            'owner' => $ownerSent,
        ]);
    }
}
