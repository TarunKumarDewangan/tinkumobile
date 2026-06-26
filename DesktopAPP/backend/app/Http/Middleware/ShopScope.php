<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

/**
 * ShopScope – automatically restricts queries to the authenticated user's shop.
 * Owner (is_owner=1) has no restriction: request()->shopId() returns null.
 * All other users get their shop_id injected into the request.
 */
class ShopScope
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();

        if ($user && ! $user->is_owner) {
            // Merge the user's shop_id into the request so controllers can use it
            $request->merge(['_shop_id' => $user->shop_id]);
        }

        return $next($request);
    }
}
