<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;

class RolePermissionController extends Controller
{
    public function index(Request $request)
    {
        if (!$request->user()->hasFullAccess()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $roles = Role::with('permissions')
            ->where('name', '!=', 'Admin')
            ->get()
            ->map(fn($r) => [
                'name'        => $r->name,
                'permissions' => $r->permissions->pluck('name')->values(),
            ]);

        $permissions = Permission::orderBy('name')->pluck('name');

        return response()->json([
            'roles'       => $roles,
            'permissions' => $permissions,
        ]);
    }

    public function sync(Request $request, string $roleName)
    {
        if (!$request->user()->hasFullAccess()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if (strtolower($roleName) === 'admin') {
            return response()->json(['message' => 'Cannot modify Admin role'], 403);
        }

        $data = $request->validate(['permissions' => 'present|array']);

        $role = Role::firstOrCreate(['name' => $roleName, 'guard_name' => 'web']);
        $role->syncPermissions($data['permissions']);

        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        return response()->json([
            'message'     => "Permissions updated for {$roleName}",
            'permissions' => $role->fresh()->permissions->pluck('name'),
        ]);
    }
}
