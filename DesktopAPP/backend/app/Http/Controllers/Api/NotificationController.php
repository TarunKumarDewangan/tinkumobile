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

        // Sent as three separate messages (not one combined one) so any one
        // can be read/forwarded on its own. A short gap between each avoids
        // Telegram's brief rate-limiting of rapid back-to-back sends from the
        // same bot to the same chat — and each is attempted regardless of
        // whether an earlier one failed, so one hiccup doesn't hide the rest.
        $pendingMsg = $service->buildPendingBalanceListMessage();
        $promiseMsg = $service->buildPromiseListMessage();
        $financeMsg = $service->buildPersonalFinanceDueListMessage();

        $sendThree = function (callable $send) {
            $r1 = $send(0);
            sleep(1);
            $r2 = $send(1);
            sleep(1);
            $r3 = $send(2);
            return $r1 && $r2 && $r3;
        };

        $pendingGroupSent = false;
        $ownerSent = false;
        if (in_array('pending_group', $data['channels'])) {
            $messages = [$pendingMsg, $promiseMsg, $financeMsg];
            $pendingGroupSent = $sendThree(fn ($i) => $telegram->sendToPendingGroup($messages[$i]));
        }
        if (in_array('owner', $data['channels'])) {
            $messages = [$pendingMsg, $promiseMsg, $financeMsg];
            $ownerSent = $sendThree(fn ($i) => $telegram->sendToOwner($messages[$i]));
        }

        ActivityLog::log('MANUAL_PENDING_BALANCE_SUMMARY_SENT', $user, "Pending Balance summary manually sent by {$user->name}");

        return response()->json([
            'message' => $pendingMsg . "\n\n" . $promiseMsg . "\n\n" . $financeMsg,
            'pending_group' => $pendingGroupSent,
            'owner' => $ownerSent,
        ]);
    }
}
