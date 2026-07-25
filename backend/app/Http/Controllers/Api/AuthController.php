<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use App\Models\ActivityLog;
use App\Services\TelegramService;

class AuthController extends Controller
{
    private function otpCacheKey(int $userId): string
    {
        return "login_otp_{$userId}";
    }

    private function issueOtp(User $user): void
    {
        $otp = (string) random_int(100000, 999999);
        Cache::put($this->otpCacheKey($user->id), $otp, now()->addMinutes(5));

        $message = "🔐 *Login OTP*\nUser: {$user->name} ({$user->email})\nCode: *{$otp}*\nValid for 5 minutes.";
        app(TelegramService::class)->sendToOwner($message);
    }

    private function userPayload(User $user): array
    {
        return [
            'id'       => $user->id,
            'emp_id'   => $user->emp_id,
            'name'     => $user->name,
            'email'    => $user->email,
            'is_owner' => $user->is_owner,
            'is_admin' => $user->isAdmin(),
            'shop_id'  => $user->shop_id,
            'shop'     => $user->shop,
            'roles'    => $user->getRoleNames(),
            'permissions' => $user->getAllPermissions()->pluck('name'),
        ];
    }

    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        $user = User::where('email', $request->email)->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        if ($user->require_login_otp) {
            $this->issueOtp($user);
            return response()->json(['otp_required' => true, 'email' => $user->email]);
        }

        $token = $user->createToken('api-token')->plainTextToken;

        ActivityLog::log('LOGIN', $user, 'User logged in: ' . $user->name);

        return response()->json([
            'token' => $token,
            'user' => $this->userPayload($user),
        ]);
    }

    public function resendOtp(Request $request)
    {
        $request->validate(['email' => 'required|email']);

        $user = User::where('email', $request->email)->first();
        if (! $user || ! $user->require_login_otp) {
            return response()->json(['message' => 'Invalid request.'], 422);
        }

        $this->issueOtp($user);
        return response()->json(['message' => 'A new OTP has been sent.']);
    }

    public function verifyOtp(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'otp' => 'required|string',
        ]);

        $user = User::where('email', $request->email)->first();
        if (! $user || ! $user->require_login_otp) {
            throw ValidationException::withMessages(['otp' => ['Invalid request.']]);
        }

        $cachedOtp = Cache::get($this->otpCacheKey($user->id));
        if (! $cachedOtp || $cachedOtp !== $request->otp) {
            throw ValidationException::withMessages(['otp' => ['Invalid or expired code.']]);
        }

        Cache::forget($this->otpCacheKey($user->id));

        $token = $user->createToken('api-token')->plainTextToken;

        ActivityLog::log('LOGIN', $user, 'User logged in: ' . $user->name);

        return response()->json([
            'token' => $token,
            'user' => $this->userPayload($user),
        ]);
    }

    public function logout(Request $request)
    {
        $user = $request->user();
        $user->currentAccessToken()->delete();
        ActivityLog::log('LOGOUT', $user, 'User logged out: ' . $user->name);
        return response()->json(['message' => 'Logged out successfully']);
    }

    public function me(Request $request)
    {
        $user = $request->user()->load('shop');
        return response()->json([
            'id'          => $user->id,
            'emp_id'      => $user->emp_id,
            'name'        => $user->name,
            'email'       => $user->email,
            'is_owner'    => $user->is_owner,
            'is_admin'    => $user->isAdmin(),
            'shop_id'     => $user->shop_id,
            'shop'        => $user->shop,
            'roles'       => $user->getRoleNames(),
            'permissions' => $user->getAllPermissions()->pluck('name'),
        ]);
    }
}
