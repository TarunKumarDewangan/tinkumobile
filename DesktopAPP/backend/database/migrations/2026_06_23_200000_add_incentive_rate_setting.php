<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('settings')->insertOrIgnore([
            'key'   => 'incentive_rate_percent',
            'value' => '1',
        ]);
    }

    public function down(): void
    {
        DB::table('settings')->where('key', 'incentive_rate_percent')->delete();
    }
};
