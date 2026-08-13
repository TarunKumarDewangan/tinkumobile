<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class SettingsController extends Controller
{
    public function index()
    {
        return response()->json(
            \App\Models\Setting::pluck('value', 'key')->toArray()
        );
    }

    public function update(Request $request)
    {
        $user = $request->user();
        if (!($user->is_owner || $user->hasRole('Admin'))) {
            return response()->json(['message' => 'Only owner or admin can update settings'], 403);
        }

        $data = $request->all();
        // action_pin can only be changed via changePin(), which requires verifying
        // the current PIN first — allowing it here would let this endpoint bypass
        // that check entirely.
        unset($data['action_pin']);

        foreach ($data as $key => $value) {
            \App\Models\Setting::updateOrCreate(
                ['key' => $key],
                ['value' => $value]
            );
        }

        ActivityLog::log('SETTINGS_UPDATED', null, "Settings updated by {$user->name}: " . implode(', ', array_keys($data)));

        return response()->json(['message' => 'Settings updated successfully']);
    }

    public function verifyPin(Request $request)
    {
        $request->validate(['pin' => 'required|string']);
        $stored = \App\Models\Setting::where('key', 'action_pin')->value('value');
        if (!$stored || !\Illuminate\Support\Facades\Hash::check($request->pin, $stored)) {
            return response()->json(['message' => 'Incorrect PIN'], 403);
        }

        // Issue a short-lived, one-time token proving this specific user just
        // verified the PIN. Destructive routes (see RequireActionPin
        // middleware) require this token — previously a verified PIN in the
        // UI wasn't actually checked by the action endpoint itself, so
        // anyone calling the API directly could skip the PIN entirely.
        $token = Str::random(40);
        Cache::put("pin_token:{$token}", $request->user()->id, now()->addSeconds(60));

        return response()->json(['message' => 'ok', 'pin_token' => $token]);
    }

    public function changePin(Request $request)
    {
        $user = $request->user();
        if (!($user->is_owner || $user->hasRole('Admin'))) {
            return response()->json(['message' => 'Only owner or admin can change the PIN'], 403);
        }
        $request->validate([
            'old_pin' => 'required|string',
            'new_pin' => 'required|string|min:4|max:8',
        ]);
        $stored = \App\Models\Setting::where('key', 'action_pin')->value('value');
        if (!$stored || !\Illuminate\Support\Facades\Hash::check($request->old_pin, $stored)) {
            return response()->json(['message' => 'Current PIN is incorrect'], 403);
        }
        \App\Models\Setting::updateOrCreate(
            ['key' => 'action_pin'],
            ['value' => \Illuminate\Support\Facades\Hash::make($request->new_pin)]
        );
        ActivityLog::log('PIN_CHANGED', null, "System action PIN changed by {$user->name}");
        return response()->json(['message' => 'PIN updated successfully']);
    }

    public function testWhatsApp()
    {
        $res = app(\App\Services\WhatsAppService::class)->sendToOwner("🧪 *WhatsApp Test Message*\nYour Tinku Mobiles configuration is working perfectly!\n\n_System Date: " . now()->format('d M Y H:i') . "_");

        if ($res) {
            return response()->json(['message' => 'Test message sent successfully']);
        }

        return response()->json(['message' => 'Failed to send test message. Check logs.'], 500);
    }

    public function testTelegram()
    {
        $res = app(\App\Services\TelegramService::class)->sendToOwner("🧪 *Telegram Test Message*\nYour Tinku Mobiles configuration is working perfectly!\n\n_System Date: " . now()->format('d M Y H:i') . "_");

        if ($res) {
            return response()->json(['message' => 'Test message sent successfully']);
        }

        return response()->json(['message' => 'Failed to send test message. Check logs.'], 500);
    }
}
