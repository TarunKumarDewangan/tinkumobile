<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class TelegramService
{
    protected $botToken;
    protected $chatId;
    protected $channelId;

    public function __construct()
    {
        $settings = \App\Models\Setting::whereIn('key', ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'TELEGRAM_CHANNEL_ID'])->pluck('value', 'key');

        $this->botToken  = $settings['TELEGRAM_BOT_TOKEN'] ?? env('TELEGRAM_BOT_TOKEN');
        $this->chatId    = $settings['TELEGRAM_CHAT_ID'] ?? env('TELEGRAM_CHAT_ID');
        $this->channelId = $settings['TELEGRAM_CHANNEL_ID'] ?? env('TELEGRAM_CHANNEL_ID');
    }

    public function isConfigured()
    {
        return !empty($this->botToken) && (!empty($this->chatId) || !empty($this->channelId));
    }

    /**
     * Send a message to a specific chat/channel ID.
     *
     * @param string $chatId Telegram chat ID, or @channelusername for public channels
     * @param string $message The text message to send (Markdown formatting supported)
     * @return bool
     */
    protected function sendMessage($chatId, $message)
    {
        try {
            $url = "https://api.telegram.org/bot{$this->botToken}/sendMessage";

            $response = Http::post($url, [
                'chat_id' => $chatId,
                'text' => $message,
                'parse_mode' => 'Markdown',
            ]);

            if ($response->successful() && ($response->json('ok') === true)) {
                return true;
            }

            Log::error('Telegram API Error Response', ['chat_id' => $chatId, 'response' => $response->json()]);
            return false;

        } catch (\Exception $e) {
            Log::error('Telegram API Exception', ['chat_id' => $chatId, 'error' => $e->getMessage()]);
            return false;
        }
    }

    /**
     * Send a message to every configured recipient — the owner's personal chat and/or
     * a broadcast channel. Returns true if it reached at least one of them.
     *
     * @param string $message The text message to send (Markdown formatting supported)
     * @return bool
     */
    public function sendToOwner($message)
    {
        if (empty($this->botToken) || (empty($this->chatId) && empty($this->channelId))) {
            Log::warning('Telegram bot not configured. Message not sent.');
            return false;
        }

        $sent = false;
        if (!empty($this->chatId)) {
            $sent = $this->sendMessage($this->chatId, $message) || $sent;
        }
        if (!empty($this->channelId)) {
            $sent = $this->sendMessage($this->channelId, $message) || $sent;
        }

        return $sent;
    }
}
