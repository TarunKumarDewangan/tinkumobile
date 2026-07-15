<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// The server's app timezone is UTC, but 5 PM/9 PM are meant as India time —
// without ->timezone() here, dailyAt('17:00') fires at 5 PM UTC (10:30 PM IST).
Schedule::command('report:daily-summary --slot=afternoon')->dailyAt('17:00')->timezone('Asia/Kolkata');
Schedule::command('report:daily-summary --slot=night')->dailyAt('21:00')->timezone('Asia/Kolkata');

Schedule::command('report:emi-due-reminder')->dailyAt('10:00')->timezone('Asia/Kolkata');
Schedule::command('report:emi-due-reminder')->dailyAt('14:00')->timezone('Asia/Kolkata');
