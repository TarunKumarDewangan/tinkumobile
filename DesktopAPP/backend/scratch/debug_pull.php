<?php

// Bootstrap Laravel
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use App\Http\Controllers\Api\SystemBackupController;
use Illuminate\Http\Request;
use App\Models\User;

try {
    echo "1. Authenticating with live website...\n";
    $liveUrl = "https://api.tinkumobile.in";
    $email = "owner@tinkumobile.in";
    $password = "password";

    $loginResponse = Http::withoutVerifying()->post("{$liveUrl}/api/login", [
        'email'    => $email,
        'password' => $password,
    ]);

    if (!$loginResponse->successful()) {
        throw new \Exception("Live server login failed: " . $loginResponse->body());
    }

    $token = $loginResponse->json('token');
    echo "Authentication successful! Token obtained.\n";

    echo "2. Downloading backup from live server...\n";
    $backupResponse = Http::withoutVerifying()->timeout(300)
        ->withToken($token)
        ->get("{$liveUrl}/api/system/backup");

    if (!$backupResponse->successful()) {
        throw new \Exception("Failed to download backup: " . $backupResponse->body());
    }

    $backupData = $backupResponse->json();
    echo "Backup downloaded successfully. Tables count: " . count($backupData) . "\n";

    echo "3. Attempting to restore locally...\n";
    $tempFile = tempnam(sys_get_temp_dir(), 'cloud_sync_debug_') . '.json';
    file_put_contents($tempFile, json_encode($backupData));

    $owner = User::where('is_owner', 1)->first();
    if (!$owner) {
        $owner = User::first();
    }

    $restoreController = app(SystemBackupController::class);
    $fakeFile = new \Illuminate\Http\UploadedFile($tempFile, 'cloud_sync.json', 'application/json', null, true);
    $fakeRequest = new Request();
    $fakeRequest->setUserResolver(fn() => $owner);
    $fakeRequest->files->set('backup_file', $fakeFile);

    $restoreResponse = $restoreController->restoreBackup($fakeRequest);
    @unlink($tempFile);

    echo "Status code: " . $restoreResponse->getStatusCode() . "\n";
    echo "Response content: " . $restoreResponse->getContent() . "\n";

} catch (\Exception $e) {
    echo "CRITICAL ERROR: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString() . "\n";
}
