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
     * Enroll (or re-enroll) the current user's face. The server only
     * receives the resulting descriptor, not raw video.
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
     * Streams a check-in/out (or enrollment) photo directly from the
     * `public` disk, instead of relying on the /storage symlink — shared
     * hosting doesn't always allow creating that symlink, and it has to be
     * redone after any deploy that replaces the public/ folder. Restricted
     * to the attendance/ prefix so this can't be used to read arbitrary
     * files off the disk.
     */
    public function servePhoto(string $path)
    {
        if (!str_starts_with($path, 'attendance/') || str_contains($path, '..')) {
            abort(404);
        }
        if (!Storage::disk('public')->exists($path)) {
            abort(404);
        }
        return Storage::disk('public')->response($path);
    }

    /**
     * Admin — month-wise Present/Absent summary per staff member. A day
     * counts Absent only if it's on/after their joining_date and strictly
     * before today (today and future days are left out of the count, not
     * marked absent, since the day isn't over yet / hasn't happened).
     */
    public function summary(Request $request)
    {
        $user = $request->user();
        if (!$user->hasFullAccess() && !$user->hasRole('Admin')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $data = $request->validate([
            'month'   => 'required|date_format:Y-m',
            'user_id' => 'nullable|exists:users,id',
            'shop_id' => 'nullable|exists:shops,id',
        ]);

        $monthStart = \Carbon\Carbon::createFromFormat('Y-m', $data['month'])->startOfMonth();
        $monthEnd = $monthStart->copy()->endOfMonth();
        $yesterday = today()->subDay();
        $effectiveEnd = $monthEnd->greaterThan($yesterday) ? $yesterday : $monthEnd;

        $staff = \App\Models\User::whereNotNull('joining_date')
            ->when($data['user_id'] ?? null, fn ($q, $id) => $q->where('id', $id))
            ->when($data['shop_id'] ?? null, fn ($q, $id) => $q->where('shop_id', $id))
            ->with('shop:id,name')
            ->get(['id', 'name', 'emp_id', 'shop_id', 'joining_date']);

        $userIds = $staff->pluck('id');

        $presentDates = AttendanceLog::whereIn('user_id', $userIds)
            ->where('type', 'IN')
            ->whereBetween('logged_at', [$monthStart, $monthEnd->copy()->endOfDay()])
            ->get(['user_id', 'logged_at'])
            ->groupBy('user_id')
            ->map(fn ($logs) => $logs->map(fn ($l) => \Carbon\Carbon::parse($l->logged_at)->toDateString())->unique());

        $result = [];
        foreach ($staff as $s) {
            $joinDate = \Carbon\Carbon::parse($s->joining_date)->startOfDay();
            $rangeStart = $joinDate->greaterThan($monthStart) ? $joinDate : $monthStart->copy();

            $days = [];
            $presentCount = 0;
            $absentCount = 0;

            if ($rangeStart->lessThanOrEqualTo($effectiveEnd)) {
                $userPresent = $presentDates->get($s->id, collect());
                for ($d = $rangeStart->copy(); $d->lessThanOrEqualTo($effectiveEnd); $d->addDay()) {
                    $dateStr = $d->toDateString();
                    $isPresent = $userPresent->contains($dateStr);
                    $days[] = ['date' => $dateStr, 'status' => $isPresent ? 'present' : 'absent'];
                    $isPresent ? $presentCount++ : $absentCount++;
                }
            }

            $result[] = [
                'user_id'        => $s->id,
                'name'           => $s->name,
                'emp_id'         => $s->emp_id,
                'shop_name'      => $s->shop->name ?? null,
                'joining_date'   => $s->joining_date,
                'present_count'  => $presentCount,
                'absent_count'   => $absentCount,
                'days_considered' => $presentCount + $absentCount,
                'days'           => $days,
            ];
        }

        return response()->json(['month' => $data['month'], 'staff' => $result]);
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
