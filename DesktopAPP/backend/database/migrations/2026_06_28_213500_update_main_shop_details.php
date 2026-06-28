<?php

use Illuminate\Database\Migrations\Migration;
use App\Models\Shop;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Update the main shop branch with correct details
        Shop::where('is_main', true)->update([
            'name'    => 'Tinku Mobile Dhamtari',
            'address' => 'Nehru Gardan Complex, Dhamtari',
            'phone'   => '9098795200',
            'gstin'   => '22CHZPD5946A1ZC'
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Shop::where('is_main', true)->update([
            'name'    => 'TinkuMobiles Main Branch',
            'address' => '123 Main Street, City',
            'phone'   => '9876543210',
            'gstin'   => null
        ]);
    }
};
