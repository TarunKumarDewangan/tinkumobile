<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class WhatsAppService
{
    protected $host;
    protected $apiKey;
    protected $ownerMobile;

    public function __construct()
    {
        $settings = \App\Models\Setting::whereIn('key', ['WAPP_HOST', 'WAPP_API_KEY', 'OWNER_MOBILE'])->pluck('value', 'key');
        
        $this->host = $settings['WAPP_HOST'] ?? env('WAPP_HOST');
        $this->apiKey = $settings['WAPP_API_KEY'] ?? env('WAPP_API_KEY');
        $this->ownerMobile = $settings['OWNER_MOBILE'] ?? env('OWNER_MOBILE');
    }

    /**
     * Format number to include 91 prefix and remove + or spaces
     */
    protected function formatNumber($number)
    {
        // Remove all non-numeric characters
        $clean = preg_replace('/[^0-9]/', '', $number);
        
        // If it's 10 digits, prepend 91
        if (strlen($clean) === 10) {
            return '91' . $clean;
        }
        
        // If it starts with 0 and is 11 digits (e.g. 0999...), remove 0 and prepend 91
        if (strlen($clean) === 11 && strpos($clean, '0') === 0) {
            return '91' . substr($clean, 1);
        }

        return $clean;
    }

    /**
     * Determine if the service is configured.
     *
     * @return bool
     */
    public function isConfigured()
    {
        return !empty($this->host) && !empty($this->apiKey);
    }

    /**
     * Send a WhatsApp message using the JSON API.
     *
     * @param string $mobile Number to send to
     * @param string $message The text message to send
     * @return bool True if successful, false otherwise
     */
    public function sendMessage($mobile, $message)
    {
        if (!$this->isConfigured()) {
            Log::warning('WhatsApp API not configured. Message not sent.', ['mobile' => $mobile]);
            return false;
        }

        $formattedMobile = $this->formatNumber($mobile);

        if (empty($formattedMobile)) {
            Log::warning('Attempted to send WhatsApp message to empty number.', ['message' => $message]);
            return false;
        }

        try {
            $url = "https://{$this->host}/wapp/api/send/json";

            $response = Http::withHeaders([
                'X-API-KEY' => $this->apiKey,
                'Content-Type' => 'application/json'
            ])->post($url, [
                'mobile' => $formattedMobile,
                'msg' => $message
            ]);

            if ($response->successful()) {
                $data = $response->json();
                if (isset($data['status']) && (strtolower($data['status']) === 'success' || strtolower($data['status']) === 'ok')) {
                    return true;
                }
                
                Log::error('WhatsApp API Error Response', ['response' => $data]);
                return false;
            }

            Log::error('WhatsApp API HTTP Error', ['status' => $response->status(), 'body' => $response->body()]);
            return false;

        } catch (\Exception $e) {
            Log::error('WhatsApp API Exception', ['error' => $e->getMessage()]);
            return false;
        }
    }

    /**
     * Send a message to the configured owner mobile number.
     *
     * @param string $message The text message to send
     * @return bool
     */
    public function sendToOwner($message)
    {
        if (empty($this->ownerMobile)) {
            Log::warning('Owner mobile not configured. Owner message not sent.', ['message' => $message]);
            return false;
        }

        return $this->sendMessage($this->ownerMobile, $message);
    }
}
