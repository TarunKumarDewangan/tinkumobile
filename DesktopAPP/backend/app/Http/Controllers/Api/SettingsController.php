<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

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
        $data = $request->all();

        foreach ($data as $key => $value) {
            \App\Models\Setting::updateOrCreate(
                ['key' => $key],
                ['value' => $value]
            );
        }

        return response()->json(['message' => 'Settings updated successfully']);
    }

    public function testWhatsApp()
    {
        $res = app(\App\Services\WhatsAppService::class)->sendToOwner("🧪 *WhatsApp Test Message*\nYour Tinku Mobiles configuration is working perfectly!\n\n_System Date: " . now()->format('d M Y H:i') . "_");
        
        if ($res) {
            return response()->json(['message' => 'Test message sent successfully']);
        }

        return response()->json(['message' => 'Failed to send test message. Check logs.'], 500);
    }
}
