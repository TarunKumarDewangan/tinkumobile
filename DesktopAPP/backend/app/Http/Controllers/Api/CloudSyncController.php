<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class CloudSyncController extends Controller
{
    /**
     * Get the live server URL from settings.
     */
    private function getLiveServerUrl(): ?string
    {
        $url = \App\Models\Setting::where('key', 'cloud_sync_url')->value('value');
        if ($url) {
            return rtrim($url, '/');
        }
        return null;
    }

    /**
     * Test connection to the live server by attempting a login.
     */
    public function testConnection(Request $request): JsonResponse
    {
        $request->validate([
            'cloud_url'  => 'required|url',
            'email'      => 'required|email',
            'password'   => 'required|string',
        ]);

        $liveUrl = rtrim($request->cloud_url, '/');

        try {
            $response = Http::withoutVerifying()->timeout(15)->post("{$liveUrl}/api/login", [
                'email'    => $request->email,
                'password' => $request->password,
            ]);

            if ($response->successful() && $response->json('token')) {
                $user = $response->json('user');
                return response()->json([
                    'success' => true,
                    'message' => "✅ Connected to live server as: " . ($user['name'] ?? $request->email),
                ]);
            }

            return response()->json([
                'success' => false,
                'message' => 'Login failed. Check your email and password.',
            ], 422);

        } catch (\Exception $e) {
            Log::error('[CloudSync] Connection test failed: ' . $e->getMessage(), [
                'exception' => $e
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Cannot reach live server. Check the URL and your internet connection.',
                'detail'  => $e->getMessage(),
            ], 503);
        }
    }

    /**
     * Pull from Cloud: Download live database and restore it locally.
     * Live server data WINS — replaces everything in the local SQLite database.
     */
    public function pullFromCloud(Request $request): JsonResponse
    {
        $request->validate([
            'cloud_url'  => 'required|url',
            'email'      => 'required|email',
            'password'   => 'required|string',
        ]);

        if (!$request->user()->hasFullAccess()) {
            return response()->json(['message' => 'Only the owner can perform cloud sync.'], 403);
        }

        $liveUrl = rtrim($request->cloud_url, '/');

        // Step 1: Login to live server
        try {
            $loginResponse = Http::withoutVerifying()->timeout(30)->post("{$liveUrl}/api/login", [
                'email'    => $request->email,
                'password' => $request->password,
            ]);

            if (!$loginResponse->successful() || !$loginResponse->json('token')) {
                return response()->json(['message' => 'Login to live server failed. Check credentials.'], 422);
            }

            $token = $loginResponse->json('token');
        } catch (\Exception $e) {
            return response()->json(['message' => 'Cannot reach live server: ' . $e->getMessage()], 503);
        }

        // Step 2: Download full backup from live server
        try {
            Log::info('[CloudSync] Downloading backup from live server...');
            $backupResponse = Http::withoutVerifying()->timeout(300)
                ->withToken($token)
                ->get("{$liveUrl}/api/system/backup");

            if (!$backupResponse->successful()) {
                return response()->json(['message' => 'Failed to download backup from live server: ' . $backupResponse->body()], 500);
            }

            $backupData = $backupResponse->json();

            if (!isset($backupData['type']) || $backupData['type'] !== 'FULL_SYSTEM_BACKUP') {
                return response()->json(['message' => 'Invalid backup data received from live server.'], 422);
            }

            Log::info('[CloudSync] Backup downloaded. Restoring locally...');
        } catch (\Exception $e) {
            return response()->json(['message' => 'Failed to download backup: ' . $e->getMessage()], 503);
        }

        // Step 3: Restore into local SQLite via existing restore logic
        try {
            // Write backup to a temp file and call the restore endpoint locally
            $tempFile = tempnam(sys_get_temp_dir(), 'cloud_sync_') . '.json';
            file_put_contents($tempFile, json_encode($backupData));

            // Use the existing restoreBackup logic directly
            $restoreController = app(SystemBackupController::class);
            $fakeFile = new \Illuminate\Http\UploadedFile($tempFile, 'cloud_sync.json', 'application/json', null, true);
            $fakeRequest = new Request();
            $fakeRequest->setUserResolver(fn() => $request->user());
            $fakeRequest->files->set('backup_file', $fakeFile);

            $restoreResponse = $restoreController->restoreBackup($fakeRequest);

            @unlink($tempFile);

            $responseData = json_decode($restoreResponse->getContent(), true);

            if ($restoreResponse->getStatusCode() !== 200) {
                return response()->json(['message' => 'Restore failed: ' . ($responseData['message'] ?? 'Unknown error')], 500);
            }

            \App\Models\ActivityLog::log('CLOUD_SYNC_PULL', null, 'Cloud sync completed: pulled data from live server.');

            return response()->json(['message' => '✅ Cloud sync complete! Local database updated with live server data.']);

        } catch (\Exception $e) {
            Log::error('[CloudSync] Restore failed: ' . $e->getMessage());
            return response()->json(['message' => 'Restore failed: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Push to Cloud: Export local database and restore it on live server.
     * Local desktop data WINS — replaces everything on the live server.
     */
    public function pushToCloud(Request $request): JsonResponse
    {
        $request->validate([
            'cloud_url'  => 'required|url',
            'email'      => 'required|email',
            'password'   => 'required|string',
        ]);

        if (!$request->user()->hasFullAccess()) {
            return response()->json(['message' => 'Only the owner can perform cloud sync.'], 403);
        }

        $liveUrl = rtrim($request->cloud_url, '/');

        // Step 1: Login to live server
        try {
            $loginResponse = Http::withoutVerifying()->timeout(30)->post("{$liveUrl}/api/login", [
                'email'    => $request->email,
                'password' => $request->password,
            ]);

            if (!$loginResponse->successful() || !$loginResponse->json('token')) {
                return response()->json(['message' => 'Login to live server failed. Check credentials.'], 422);
            }

            $token = $loginResponse->json('token');
        } catch (\Exception $e) {
            return response()->json(['message' => 'Cannot reach live server: ' . $e->getMessage()], 503);
        }

        // Step 2: Export local backup
        try {
            Log::info('[CloudSync] Exporting local backup...');
            $backupController = app(SystemBackupController::class);
            $fakeRequest = new Request();
            $fakeRequest->setUserResolver(fn() => $request->user());
            $localBackupResponse = $backupController->backup($fakeRequest);
            $localBackupJson = $localBackupResponse->getContent();

            Log::info('[CloudSync] Local backup exported. Uploading to live server...');
        } catch (\Exception $e) {
            return response()->json(['message' => 'Failed to export local backup: ' . $e->getMessage()], 500);
        }

        // Step 3: Send backup to live server's restore endpoint
        try {
            $tempFile = tempnam(sys_get_temp_dir(), 'cloud_push_') . '.json';
            file_put_contents($tempFile, $localBackupJson);

            $uploadResponse = Http::withoutVerifying()->timeout(300)
                ->withToken($token)
                ->attach('backup_file', fopen($tempFile, 'r'), 'desktop_sync.json')
                ->post("{$liveUrl}/api/system/restore-backup");

            @unlink($tempFile);

            if ($uploadResponse->successful()) {
                \App\Models\ActivityLog::log('CLOUD_SYNC_PUSH', null, 'Cloud sync completed: pushed data to live server.');
                return response()->json(['message' => '✅ Cloud sync complete! Live server updated with local data.']);
            }

            return response()->json([
                'message' => 'Failed to restore on live server: ' . ($uploadResponse->json('message') ?? $uploadResponse->body()),
            ], 500);

        } catch (\Exception $e) {
            Log::error('[CloudSync] Push to cloud failed: ' . $e->getMessage());
            return response()->json(['message' => 'Push to cloud failed: ' . $e->getMessage()], 500);
        }
    }
}
