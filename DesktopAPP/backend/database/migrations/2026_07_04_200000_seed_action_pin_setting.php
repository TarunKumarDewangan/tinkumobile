<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Hash;
use App\Models\Setting;

return new class extends Migration
{
    public function up(): void
    {
        Setting::updateOrCreate(
            ['key' => 'action_pin'],
            ['value' => Hash::make('71727378')]
        );
    }

    public function down(): void
    {
        Setting::where('key', 'action_pin')->delete();
    }
};
