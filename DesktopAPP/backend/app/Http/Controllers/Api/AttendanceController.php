<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\AttendanceFaceProfile;
use App\Models\AttendanceLog;
use App\Models\Shop;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class AttendanceController extends Controller
{
    /**
     * The app runs in UTC (config('app.timezone')), but the shop, its shift
     * times, and "today" for attendance purposes are all India-local. Every
     * day-boundary check and shift-time comparison in this controller must
     * go through these helpers — a bare whereDate('logged_at', today()) or
     * Carbon::parse($date.' '.$shiftTime) silently compares against UTC's
     * calendar day / UTC's clock instead, which is wrong by 5.5 hours (and
     * wrong by a whole day for anything within 5.5h of midnight IST).
     */
    private const TZ = 'Asia/Kolkata';

    private function nowLocal(): \Carbon\Carbon
    {
        return \Carbon\Carbon::now(self::TZ);
    }

    /** The IST calendar date a UTC-stored timestamp actually falls on. */
    private function localDateOf($datetime): string
    {
        return \Carbon\Carbon::parse($datetime)->setTimezone(self::TZ)->toDateString();
    }

    /** [utcStart, utcEnd] spanning 00:00:00–23:59:59.999999 IST on $localDate — use with whereBetween('logged_at', ...) instead of whereDate(). */
    private function localDateRangeUtc(string $localDate): array
    {
        return [
            \Carbon\Carbon::parse($localDate . ' 00:00:00', self::TZ)->utc(),
            \Carbon\Carbon::parse($localDate . ' 23:59:59.999999', self::TZ)->utc(),
        ];
    }

    /** A shift_start_time/shift_end_time ("10:30:00") as an absolute instant on $localDate, IST. */
    private function localClockOn(string $localDate, string $time): \Carbon\Carbon
    {
        return \Carbon\Carbon::parse($localDate . ' ' . $time, self::TZ);
    }

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

    const LUNCH_MINUTES = 45;

    /**
     * Today's state machine, derived purely from the last log of the day:
     *   no log / last = OUT        -> not_in     (only "Check In" allowed)
     *   last = IN or LUNCH_IN      -> checked_in  ("Check Out" or "Lunch" allowed)
     *   last = LUNCH_OUT           -> on_lunch    (only "Back from Lunch" allowed)
     */
    private function stateFor(?AttendanceLog $lastToday): string
    {
        if (!$lastToday || $lastToday->type === 'OUT') return 'not_in';
        if ($lastToday->type === 'LUNCH_OUT') return 'on_lunch';
        return 'checked_in'; // IN or LUNCH_IN
    }

    /**
     * Does the current user already have a face profile, and what's their
     * open attendance state today (so the frontend knows which action
     * buttons to show)?
     */
    public function status(Request $request)
    {
        $user = $request->user();
        $hasProfile = AttendanceFaceProfile::where('user_id', $user->id)->exists();

        $lastToday = AttendanceLog::where('user_id', $user->id)
            ->whereBetween('logged_at', $this->localDateRangeUtc($this->nowLocal()->toDateString()))
            ->orderByDesc('logged_at')
            ->first();

        $state = $this->stateFor($lastToday);

        return response()->json([
            'enrolled' => $hasProfile,
            'state' => $state,
            'lunch_deadline' => $state === 'on_lunch'
                ? \Carbon\Carbon::parse($lastToday->logged_at)->addMinutes(self::LUNCH_MINUTES)->toIso8601String()
                : null,
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
            'action' => 'required|in:IN,OUT,LUNCH_OUT,LUNCH_IN',
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
            ->whereBetween('logged_at', $this->localDateRangeUtc($this->nowLocal()->toDateString()))
            ->orderByDesc('logged_at')
            ->first();
        $state = $this->stateFor($lastToday);

        // Which action is legal from which state — validated server-side so
        // a stale client (or a direct API call) can't skip lunch's return
        // step or start a second lunch mid-lunch.
        $allowed = [
            'not_in'     => ['IN'],
            'checked_in' => ['OUT', 'LUNCH_OUT'],
            'on_lunch'   => ['LUNCH_IN'],
        ];
        if (!in_array($data['action'], $allowed[$state])) {
            return response()->json([
                'message' => "\"{$data['action']}\" isn't valid right now — " .
                    ($state === 'on_lunch' ? 'you need to come back from lunch first.' : "you're already \"{$state}\"."),
            ], 422);
        }

        $photoPath = $this->saveSnapshot($data['photo'] ?? null, 'log-' . $user->id);

        $log = AttendanceLog::create([
            'user_id' => $user->id,
            'shop_id' => $shop->id,
            'type' => $data['action'],
            'logged_at' => now(),
            'latitude' => $data['latitude'],
            'longitude' => $data['longitude'],
            'distance_meters' => $meters,
            'face_match_score' => $matchScore,
            'snapshot_path' => $photoPath,
            'is_manual' => false,
        ]);

        $labels = ['IN' => 'Checked In', 'OUT' => 'Checked Out', 'LUNCH_OUT' => 'Lunch started', 'LUNCH_IN' => 'Back from lunch'];
        return response()->json([
            'message' => "{$labels[$data['action']]} successfully",
            'log' => $log,
        ], 201);
    }

    /**
     * Admin report — filterable by user/shop/date range. Each row is
     * annotated with delay/early-leave/lunch-late-return flags (computed
     * against the shop's shift times), and matching AttendanceLeave rows
     * for the same filters are included alongside so the frontend can build
     * one combined per-staff/per-day timeline from a single response.
     */
    /**
     * True for owner/admin, who can view any staff's report. Anyone else
     * (a Sales Person, say) can still call index()/summary() but only ever
     * sees their own records — used to give staff read-only access to their
     * own attendance without opening these endpoints up generally.
     */
    private function isReportAdmin($user): bool
    {
        return $user->hasFullAccess() || $user->hasRole('Admin');
    }

    public function index(Request $request)
    {
        $user = $request->user();
        $isAdmin = $this->isReportAdmin($user);
        $userIdFilter = $isAdmin ? $request->user_id : $user->id;

        $query = AttendanceLog::with(['user:id,name,emp_id', 'shop:id,name', 'createdBy:id,name'])
            ->orderByDesc('logged_at');

        if ($userIdFilter) $query->where('user_id', $userIdFilter);
        if ($isAdmin && $request->shop_id) $query->where('shop_id', $request->shop_id);
        if ($request->from) $query->where('logged_at', '>=', $this->localDateRangeUtc($request->from)[0]);
        if ($request->to) $query->where('logged_at', '<=', $this->localDateRangeUtc($request->to)[1]);

        $page = $query->paginate($request->per_page ?? 100);
        $this->annotateDayFlags($page->getCollection());

        $leaves = \App\Models\AttendanceLeave::with('user:id,name,emp_id')
            ->when($userIdFilter, fn ($q, $id) => $q->where('user_id', $id))
            ->when($request->from, fn ($q, $d) => $q->where('date', '>=', $d))
            ->when($request->to, fn ($q, $d) => $q->where('date', '<=', $d))
            ->orderByDesc('date')
            ->get();

        return response()->json(array_merge($page->toArray(), ['leaves' => $leaves, 'is_admin' => $isAdmin]));
    }

    /**
     * Attaches, to each log in $items:
     *  - IN:       is_first_of_day + delay_minutes (vs shop shift_start_time)
     *  - OUT:      is_last_of_day + early_leave_minutes (vs shop shift_end_time)
     *  - LUNCH_IN: lunch_late_minutes (vs its matching LUNCH_OUT + 45 min)
     * Groups the affected (user, date) pairs and re-fetches each day's full
     * log set once (not per-row), so this stays cheap even for a full page.
     */
    private function annotateDayFlags($items): void
    {
        $pairs = [];
        foreach ($items as $log) {
            $date = $this->localDateOf($log->logged_at);
            $pairs[$log->user_id . '|' . $date] = ['user_id' => $log->user_id, 'date' => $date];
        }
        if (empty($pairs)) return;

        $shops = Shop::all(['id', 'shift_start_time', 'shift_end_time'])->keyBy('id');

        $dayLogsCache = [];
        foreach ($pairs as $key => $p) {
            $dayLogsCache[$key] = AttendanceLog::where('user_id', $p['user_id'])
                ->whereBetween('logged_at', $this->localDateRangeUtc($p['date']))
                ->orderBy('logged_at')
                ->get(['id', 'type', 'logged_at', 'shop_id']);
        }

        foreach ($items as $log) {
            $date = $this->localDateOf($log->logged_at);
            $dayLogs = $dayLogsCache[$log->user_id . '|' . $date];
            $shop = $shops->get($log->shop_id);

            if ($log->type === 'IN') {
                $firstIn = $dayLogs->firstWhere('type', 'IN');
                $log->is_first_of_day = $firstIn && $firstIn->id === $log->id;
                if ($log->is_first_of_day && $shop) {
                    $shiftStart = $this->localClockOn($date, $shop->shift_start_time);
                    $loggedAt = \Carbon\Carbon::parse($log->logged_at);
                    $log->delay_minutes = max(0, (int) round(($loggedAt->getTimestamp() - $shiftStart->getTimestamp()) / 60));
                }
            } elseif ($log->type === 'OUT') {
                $lastOut = $dayLogs->where('type', 'OUT')->last();
                $log->is_last_of_day = $lastOut && $lastOut->id === $log->id;
                if ($log->is_last_of_day && $shop) {
                    $shiftEnd = $this->localClockOn($date, $shop->shift_end_time);
                    $loggedAt = \Carbon\Carbon::parse($log->logged_at);
                    $log->early_leave_minutes = max(0, (int) round(($shiftEnd->getTimestamp() - $loggedAt->getTimestamp()) / 60));
                }
            } elseif ($log->type === 'LUNCH_IN') {
                $precedingLunchOut = $dayLogs->filter(fn ($l) => $l->type === 'LUNCH_OUT' && $l->logged_at < $log->logged_at)->last();
                if ($precedingLunchOut) {
                    $deadline = \Carbon\Carbon::parse($precedingLunchOut->logged_at)->addMinutes(self::LUNCH_MINUTES);
                    $loggedAt = \Carbon\Carbon::parse($log->logged_at);
                    $log->lunch_late_minutes = max(0, (int) round(($loggedAt->getTimestamp() - $deadline->getTimestamp()) / 60));
                }
            }
        }
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
        $isAdmin = $this->isReportAdmin($user);

        $data = $request->validate([
            'month'   => 'required|date_format:Y-m',
            'user_id' => 'nullable|exists:users,id',
            'shop_id' => 'nullable|exists:shops,id',
        ]);

        $monthStart = \Carbon\Carbon::createFromFormat('Y-m', $data['month'], self::TZ)->startOfMonth();
        $monthEnd = $monthStart->copy()->endOfMonth();
        $yesterday = $this->nowLocal()->startOfDay()->subDay();
        $effectiveEnd = $monthEnd->greaterThan($yesterday) ? $yesterday : $monthEnd;

        $staff = \App\Models\User::whereNotNull('joining_date')
            ->when(!$isAdmin, fn ($q) => $q->where('id', $user->id))
            ->when($isAdmin && ($data['user_id'] ?? null), fn ($q, $id) => $q->where('id', $id))
            ->when($isAdmin && ($data['shop_id'] ?? null), fn ($q, $id) => $q->where('shop_id', $id))
            ->with('shop:id,name')
            ->get(['id', 'name', 'emp_id', 'shop_id', 'joining_date']);

        $userIds = $staff->pluck('id');

        $presentDates = AttendanceLog::whereIn('user_id', $userIds)
            ->where('type', 'IN')
            ->whereBetween('logged_at', [$monthStart->copy()->utc(), $monthEnd->copy()->utc()])
            ->get(['user_id', 'logged_at'])
            ->groupBy('user_id')
            ->map(fn ($logs) => $logs->map(fn ($l) => $this->localDateOf($l->logged_at))->unique());

        // A manually marked Leave always overrides the auto-computed Absent
        // for that day — it's a deliberate admin decision, not a guess.
        $leaveDates = \App\Models\AttendanceLeave::whereIn('user_id', $userIds)
            ->whereBetween('date', [$monthStart->toDateString(), $monthEnd->toDateString()])
            ->get(['user_id', 'date', 'type'])
            ->groupBy('user_id')
            ->map(fn ($rows) => $rows->keyBy(fn ($r) => $r->date->toDateString()));

        $result = [];
        foreach ($staff as $s) {
            $joinDate = \Carbon\Carbon::parse($s->joining_date, self::TZ)->startOfDay();
            $rangeStart = $joinDate->greaterThan($monthStart) ? $joinDate : $monthStart->copy();

            $days = [];
            $presentCount = 0;
            $absentCount = 0;
            $leaveFullCount = 0;
            $leaveHalfFrontCount = 0;
            $leaveHalfLaterCount = 0;

            if ($rangeStart->lessThanOrEqualTo($effectiveEnd)) {
                $userPresent = $presentDates->get($s->id, collect());
                $userLeaves = $leaveDates->get($s->id, collect());
                for ($d = $rangeStart->copy(); $d->lessThanOrEqualTo($effectiveEnd); $d->addDay()) {
                    $dateStr = $d->toDateString();
                    $leave = $userLeaves->get($dateStr);
                    $isPresent = $userPresent->contains($dateStr);

                    if ($leave) {
                        $status = 'leave_' . $leave->type; // leave_full | leave_half_front | leave_half_later
                        match ($leave->type) {
                            'full' => $leaveFullCount++,
                            'half_front' => $leaveHalfFrontCount++,
                            'half_later' => $leaveHalfLaterCount++,
                            default => null,
                        };
                    } else {
                        $status = $isPresent ? 'present' : 'absent';
                        $isPresent ? $presentCount++ : $absentCount++;
                    }
                    $days[] = ['date' => $dateStr, 'status' => $status];
                }
            }

            $result[] = [
                'user_id'               => $s->id,
                'name'                  => $s->name,
                'emp_id'                => $s->emp_id,
                'shop_name'             => $s->shop->name ?? null,
                'joining_date'          => $s->joining_date,
                'present_count'         => $presentCount,
                'absent_count'          => $absentCount,
                'leave_full_count'      => $leaveFullCount,
                'leave_half_front_count' => $leaveHalfFrontCount,
                'leave_half_later_count' => $leaveHalfLaterCount,
                'days_considered'       => $presentCount + $absentCount + $leaveFullCount + $leaveHalfFrontCount + $leaveHalfLaterCount,
                'days'                  => $days,
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

    /**
     * Admin: mark a staff member's day as a Full or Half day Leave. Instant,
     * no approval workflow — same spirit as the Manual Entry tool. Marking
     * the same staff+date again just replaces the previous marking.
     */
    public function leaveStore(Request $request)
    {
        $user = $request->user();
        if (!$user->hasFullAccess() && !$user->hasRole('Admin')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $data = $request->validate([
            'user_id' => 'required|exists:users,id',
            'date' => 'required|date',
            'type' => 'required|in:full,half_front,half_later',
            'notes' => 'nullable|string|max:255',
        ]);

        $target = \App\Models\User::find($data['user_id']);
        $limit = $target->shop->monthly_leave_limit ?? 2;
        $monthStart = \Carbon\Carbon::parse($data['date'], self::TZ)->startOfMonth()->toDateString();
        $monthEnd = \Carbon\Carbon::parse($data['date'], self::TZ)->endOfMonth()->toDateString();

        $existingThisMonth = \App\Models\AttendanceLeave::where('user_id', $data['user_id'])
            ->whereBetween('date', [$monthStart, $monthEnd])
            ->where('date', '!=', $data['date']) // re-marking the same day isn't a new day against the limit
            ->count();

        if ($existingThisMonth >= $limit) {
            return response()->json([
                'message' => "Monthly leave limit ({$limit}) already reached for {$target->name} this month. Raise the limit in Shops Manager if this one should still be allowed.",
            ], 422);
        }

        $leave = \App\Models\AttendanceLeave::updateOrCreate(
            ['user_id' => $data['user_id'], 'date' => $data['date']],
            ['type' => $data['type'], 'notes' => $data['notes'] ?? null, 'created_by' => $user->id]
        );

        ActivityLog::log('ATTENDANCE_LEAVE_MARKED', $user, "Marked {$data['type']} leave for user #{$data['user_id']} on {$data['date']}");

        return response()->json(['message' => 'Leave marked', 'leave' => $leave->load('user:id,name,emp_id')], 201);
    }

    public function leaveDestroy(Request $request, \App\Models\AttendanceLeave $attendanceLeave)
    {
        $user = $request->user();
        if (!$user->hasFullAccess() && !$user->hasRole('Admin')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        $attendanceLeave->delete();
        return response()->json(['message' => 'Leave marking removed']);
    }
}
