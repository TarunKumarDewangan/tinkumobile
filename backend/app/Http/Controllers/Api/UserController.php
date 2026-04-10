<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;

class UserController extends Controller
{
    /** List users scoped to the requesting user's shop (or all for owner) */
    public function index(Request $request)
    {
        $user = $request->user();
        $query = User::with('shop', 'roles')->where('id', '!=', $user->id);

        if (! $user->hasFullAccess()) {
            $query->where('shop_id', $user->shop_id);
        }

        // Strictly hide Admin users from everyone except the actual root Admins
        if (! $user->is_admin) {
            $query->whereDoesntHave('roles', function($q) {
                $q->where('name', 'Admin');
            });
        }

        return response()->json($query->get());
    }

    public function store(Request $request)
    {
        $authUser = $request->user();

        $data = $request->validate([
            'name'          => 'required|string|max:100',
            'email'         => 'required|email|unique:users,email',
            'password'      => 'required|min:6',
            'shop_id'       => 'required|exists:shops,id',
            'role'          => 'required|string',
            'phone'         => 'nullable|string|max:20',
            'address'       => 'nullable|string',
            'designation'   => 'nullable|string|max:100',
            'base_salary'   => 'nullable|numeric|min:0',
            'joining_date'  => 'nullable|date',
            'aadhaar_no'    => 'nullable|string|max:20',
            'status'        => 'nullable|string|in:active,inactive',
        ]);

        // Non-full access managers can only create users in their own shop
        if (! $authUser->hasFullAccess() && $data['shop_id'] != $authUser->shop_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $user = User::create([
            'name'          => $data['name'],
            'email'         => $data['email'],
            'password'      => Hash::make($data['password']),
            'shop_id'       => $data['shop_id'],
            'phone'         => $data['phone'] ?? null,
            'address'       => $data['address'] ?? null,
            'designation'   => $data['designation'] ?? null,
            'base_salary'   => $data['base_salary'] ?? 0,
            'joining_date'  => $data['joining_date'] ?? null,
            'aadhaar_no'    => $data['aadhaar_no'] ?? null,
            'status'        => $data['status'] ?? 'active',
        ]);

        $role = Role::firstOrCreate(['name' => $data['role'], 'guard_name' => 'web']);
        $user->assignRole($role);

        return response()->json($user->load('shop', 'roles'), 201);
    }

    public function show(Request $request, User $user)
    {
        $authUser = $request->user();
        if (! $authUser->is_admin && $user->hasRole('Admin')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        if (! $authUser->hasFullAccess() && $authUser->shop_id !== $user->shop_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        return response()->json($user->load('shop', 'roles'));
    }

    public function update(Request $request, User $user)
    {
        $authUser = $request->user();
        if (! $authUser->is_admin && $user->hasRole('Admin')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        if (! $authUser->hasFullAccess() && $authUser->shop_id !== $user->shop_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $data = $request->validate([
            'name'          => 'sometimes|string|max:100',
            'email'         => 'sometimes|email|unique:users,email,' . $user->id,
            'password'      => 'sometimes|min:6',
            'shop_id'       => 'sometimes|exists:shops,id',
            'role'          => 'sometimes|string',
            'phone'         => 'nullable|string|max:20',
            'address'       => 'nullable|string',
            'designation'   => 'nullable|string|max:100',
            'base_salary'   => 'nullable|numeric|min:0',
            'joining_date'  => 'nullable|date',
            'aadhaar_no'    => 'nullable|string|max:20',
            'status'        => 'nullable|string|in:active,inactive',
        ]);

        if (isset($data['password'])) {
            $data['password'] = Hash::make($data['password']);
        }

        $user->update($data);

        if (isset($data['role'])) {
            $role = Role::firstOrCreate(['name' => $data['role'], 'guard_name' => 'web']);
            $user->syncRoles([$role->name]);
        }

        return response()->json($user->fresh()->load('shop', 'roles'));
    }

    public function destroy(Request $request, User $user)
    {
        $authUser = $request->user();
        if (! $authUser->is_admin && $user->hasRole('Admin')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        if (! $authUser->hasFullAccess() && $authUser->shop_id !== $user->shop_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        $user->delete();
        return response()->json(['message' => 'User deleted']);
    }
}
