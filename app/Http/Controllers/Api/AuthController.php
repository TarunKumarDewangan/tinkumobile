<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
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

        $token = $user->createToken('api-token')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => [
                'id'       => $user->id,
                'name'     => $user->name,
                'email'    => $user->email,
                'is_owner' => $user->is_owner,
                'is_admin' => $user->isAdmin(),
                'shop_id'  => $user->shop_id,
                'shop'     => $user->shop,
                'roles'    => $user->getRoleNames(),
                'permissions' => $user->getAllPermissions()->pluck('name'),
            ],
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Logged out successfully']);
    }

    public function me(Request $request)
    {
        $user = $request->user()->load('shop');
        return response()->json([
            'id'          => $user->id,
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
