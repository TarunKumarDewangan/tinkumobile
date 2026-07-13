<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('report:daily-summary --slot=afternoon')->dailyAt('17:00');
Schedule::command('report:daily-summary --slot=night')->dailyAt('21:00');
