<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Spatie\Permission\PermissionRegistrar;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // spatie/laravel-permission caches its role/permission list independently
        // of Laravel's database refresh between tests. Without clearing it here,
        // every permission/role created by a migration or RefreshDatabase in this
        // test run is invisible to Spatie until the cache is forgotten, causing
        // spurious "There is no permission named ..." failures.
        if ($this->app) {
            $this->app->make(PermissionRegistrar::class)->forgetCachedPermissions();
        }
    }
}
