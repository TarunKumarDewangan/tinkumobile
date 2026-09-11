<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AttendanceFaceProfile;
use App\Models\AttendanceLog;
use App\Models\Shop;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class AttendanceController extends Controller
{
    /**
     * Haversine distance in meters between two lat/lng points.
     */
    private function distanceMeters(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $earthRadius = 6371000; // meters
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;
        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));
        return $earthRadius * $c;
    }

    /**
     * Euclidean distance between two face-api.js descriptors — the standard
     * way that library's own matching works. Lower = more similar; below
     * ~0.6 is generally considered the same face.
     */
    private function descriptorDistance(array $a, array $b): float
    {
        $sum = 0;
        $n = min(count($a), count($b));
        for ($i = 0; $i < $n; $i++) {
            $sum += ($a[$i] - $b[$i]) ** 2;
        }
        return sqrt($sum);
    }

    private function saveSnapshot(?string $base64, string $prefix): ?string
    {
        if (!$base64) return null;
        if (!preg_match('/^data:image\/(\w+);base64,/', $base64, $m)) return null;
        $ext = $m[1] === 'jpeg' ? 'jpg' : $m[1];
        $data = base64_decode(substr($base64, strpos($base64, ',') + 1));
        if ($data === false) return null;
        $path = "attendance/{$prefix}-" . now()->format('Ymd-His') . '-' . Str::random(6) . ".{$ext}";
        Storage::disk('public')->put($path, $data);
        return $path;
    }

    /**
     * Does the current user already have a face profile, and what's their
     * open attendance state today (so the frontend knows whether the next
     * action is Check In or Check Out)?
     */
    public function status(Request $request)
    {
        $user = $request->user();
        $hasProfile = AttendanceFaceProfile::where('user_id', $user->id)->exists();

        $lastToday = AttendanceLog::where('user_id', $user->id)
            ->whereDate('logged_at', today())
            ->orderByDesc('logged_at')
            ->first();

        return response()->json([
            'enrolled' => $hasProfile,
            'next_action' => (!$lastToday || $lastToday->type === 'OUT') ? 'IN' : 'OUT',
            'last_log' => $lastToday,
            'shop' => $user->shop ? [
                'id' => $user->shop->id,
                'name' => $user->shop->name,
                'latitude' => $user->shop->latitude,
                'longitude' => $user->shop->longitude,
                'radius' => $user->shop->attendance_radius_meters,
            ] : null,
        ]);
    }

    /**
     * Enroll (or re-enroll) the current user's face. A blink must already
     * have been verified client-side before this is called — the server
     * only receives the resulting descriptor, not raw video, so liveness
     * itself is a client-side guarantee, not something this endpoint can
     * re-check.
     */
    public function enroll(Request $request)
    {
        $data = $request->validate([
            'descriptor' => 'required|array|size:128',
            'descriptor.*' => 'numeric',
            'photo' => 'nullable|string',
            'user_id' => 'nullable|exists:users,id', // admin re-enrolling someone else
        ]);

        $user = $request->user();
        $targetUserId = $data['user_id'] ?? $user->id;
        if ($targetUserId !== $user->id && !$user->hasFullAccess()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $photoPath = $this->saveSnapshot($data['photo'] ?? null, 'enroll-' . $targetUserId);

        $profile = AttendanceFaceProfile::updateOrCreate(
            ['user_id' => $targetUserId],
            [
                'descriptor' => $data['descriptor'],
                'enrollment_photo_path' => $photoPath,
                'enrolled_at' => now(),
                'enrolled_by' => $user->id,
            ]
        );

        return response()->json(['message' => 'Face enrolled successfully', 'profile' => $profile], 201);
    }

    /**
     * Check in or out: match the live descriptor against the enrolled one,
     * verify GPS is within the shop's radius, and log it. Both checks must
     * pass — there is deliberately no fallback path (PIN, manual override)
     * for a failed match; the user just retries with better lighting/angle.
     */
    public function checkInOut(Request $request)
    {
        $data = $request->validate([
            'descriptor' => 'required|array|size:128',
            'descriptor.*' => 'numeric',
            'latitude' => 'required|numeric|between:-90,90',
            'longitude' => 'required|numeric|between:-180,180',
            'photo' => 'nullable|string',
        ]);

        $user = $request->user();
        $shop = $user->shop;
        if (!$shop) {
            return response()->json(['message' => 'No shop assigned to your account.'], 422);
        }
        if ($shop->latitude === null || $shop->longitude === null) {
            return response()->json(['message' => 'This shop has no location set up yet — ask an owner/admin to set it in Settings.'], 422);
        }

        $profile = AttendanceFaceProfile::where('user_id', $user->id)->first();
        if (!$profile) {
            return response()->json(['message' => 'No face enrolled yet — enroll your face first.'], 422);
        }

        $distance = $this->descriptorDistance($profile->descriptor, $data['descriptor']);
        // face-api.js convention: distance below ~0.6 is the same person.
        $matchScore = max(0, 1 - $distance);
        if ($distance > 0.6) {
            return response()->json([
                'message' => 'Face did not match. Please try again with better lighting.',
                'match_score' => round($matchScore, 4),
            ], 422);
        }

        $meters = $this->distanceMeters($shop->latitude, $shop->longitude, $data['latitude'], $data['longitude']);
        if ($meters > $shop->attendance_radius_meters) {
            return response()->json([
                'message' => "You're " . round($meters) . "m from {$shop->name} — must be within {$shop->attendance_radius_meters}m to check in/out.",
                'distance_meters' => round($meters, 2),
            ], 422);
        }

        $lastToday = AttendanceLog::where('user_id', $user->id)
            ->whereDate('logged_at', today())
            ->orderByDesc('logged_at')
            ->first();
        $type = (!$lastToday || $lastToday->type === 'OUT') ? 'IN' : 'OUT';

        $photoPath = $this->saveSnapshot($data['photo'] ?? null, 'log-' . $user->id);

        $log = AttendanceLog::create([
            'user_id' => $user->id,
            'shop_id' => $shop->id,
            'type' => $type,
            'logged_at' => now(),
            'latitude' => $data['latitude'],
            'longitude' => $data['longitude'],
            'distance_meters' => $meters,
            'face_match_score' => $matchScore,
            'snapshot_path' => $photoPath,
            'is_manual' => false,
        ]);

        return response()->json([
            'message' => "Checked {$type} successfully",
            'log' => $log,
        ], 201);
    }

    /**
     * Admin report — filterable by user/shop/date range.
     */
    public function index(Request $request)
    {
        $user = $request->user();
        if (!$user->hasFullAccess() && !$user->hasRole('Admin')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $query = AttendanceLog::with(['user:id,name,emp_id', 'shop:id,name', 'createdBy:id,name'])
            ->orderByDesc('logged_at');

        if ($request->user_id) $query->where('user_id', $request->user_id);
        if ($request->shop_id) $query->where('shop_id', $request->shop_id);
        if ($request->from) $query->whereDate('logged_at', '>=', $request->from);
        if ($request->to) $query->whereDate('logged_at', '<=', $request->to);

        return response()->json($query->paginate($request->per_page ?? 100));
    }

    /**
     * Admin: add a manual entry (e.g. a missed checkout) or correct one.
     * Skips face/GPS verification entirely — flagged is_manual so the
     * report always shows it wasn't a live-verified entry.
     */
    public function storeManual(Request $request)
    {
        $user = $request->user();
        if (!$user->hasFullAccess() && !$user->hasRole('Admin')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $data = $request->validate([
            'user_id' => 'required|exists:users,id',
            'shop_id' => 'required|exists:shops,id',
            'type' => 'required|in:IN,OUT',
            'logged_at' => 'required|date',
        ]);

        $log = AttendanceLog::create([
            'user_id' => $data['user_id'],
            'shop_id' => $data['shop_id'],
            'type' => $data['type'],
            'logged_at' => $data['logged_at'],
            'latitude' => 0,
            'longitude' => 0,
            'distance_meters' => 0,
            'face_match_score' => 0,
            'is_manual' => true,
            'created_by' => $user->id,
        ]);

        return response()->json(['message' => 'Manual entry added', 'log' => $log], 201);
    }

    public function destroy(Request $request, AttendanceLog $attendanceLog)
    {
        $user = $request->user();
        if (!$user->hasFullAccess() && !$user->hasRole('Admin')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        $attendanceLog->delete();
        return response()->json(['message' => 'Entry deleted']);
    }
}
