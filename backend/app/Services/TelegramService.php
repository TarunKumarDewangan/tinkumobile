<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class TelegramService
{
    protected $botToken;
    protected $chatId;

    public function __construct()
    {
        $settings = \App\Models\Setting::whereIn('key', ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'])->pluck('value', 'key');

        $this->botToken = $settings['TELEGRAM_BOT_TOKEN'] ?? env('TELEGRAM_BOT_TOKEN');
        $this->chatId = $settings['TELEGRAM_CHAT_ID'] ?? env('TELEGRAM_CHAT_ID');
    }

    public function isConfigured()
    {
        return !empty($this->botToken) && !empty($this->chatId);
    }

    /**
     * Send a message to the configured owner chat.
     *
     * @param string $message The text message to send (Markdown formatting supported)
     * @return bool
     */
    public function sendToOwner($message)
    {
        if (!$this->isConfigured()) {
            Log::warning('Telegram bot not configured. Message not sent.');
            return false;
        }

        try {
            $url = "https://api.telegram.org/bot{$this->botToken}/sendMessage";

            $response = Http::post($url, [
                'chat_id' => $this->chatId,
                'text' => $message,
                'parse_mode' => 'Markdown',
            ]);

            if ($response->successful() && ($response->json('ok') === true)) {
                return true;
            }

            Log::error('Telegram API Error Response', ['response' => $response->json()]);
            return false;

        } catch (\Exception $e) {
            Log::error('Telegram API Exception', ['error' => $e->getMessage()]);
            return false;
        }
    }
}
