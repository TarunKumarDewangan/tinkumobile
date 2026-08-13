<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        \Illuminate\Http\Resources\Json\JsonResource::withoutWrapping();

        // Global super-admin bypass for owner
        \Illuminate\Support\Facades\Gate::before(function ($user, $ability) {
            return $user->isOwner() ? true : null;
        });
    }
}
