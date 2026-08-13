<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

/**
 * Enforces that a destructive/high-risk action was actually preceded by a
 * successful PIN check (SettingsController::verifyPin), server-side —
 * closing the gap where the frontend's PIN modal was UX-only and any
 * direct API call could skip it entirely.
 *
 * The client must send the `pin_token` returned by /settings/verify-pin in
 * an `X-Pin-Token` header. The token is single-use (consumed via
 * Cache::pull) and expires after 60 seconds, and must belong to the same
 * user making this request.
 */
class RequireActionPin
{
    public function handle(Request $request, Closure $next)
    {
        $token = $request->header('X-Pin-Token');

        if (!$token) {
            return response()->json(['message' => 'PIN verification required for this action.'], 403);
        }

        $userId = Cache::pull("pin_token:{$token}");

        if (!$userId || $userId !== $request->user()?->id) {
            return response()->json(['message' => 'PIN verification required or expired. Please try again.'], 403);
        }

        return $next($request);
    }
}
