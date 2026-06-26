<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Run the sync on all retailers to backfill paid_amount and status for all past records
        try {
            app(\App\Services\AirtelSyncService::class)->syncAllRetailers();
        } catch (\Exception $e) {
            // Log warning but don't crash migration if run in a test environment without full tables
            info("Airtel FIFO sync warning during migration: " . $e->getMessage());
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Set all paid_amount to 0 on down migration if needed
        try {
            \App\Models\AirtelDrop::query()->update([
                'paid_amount' => 0.00,
                'status' => 'pending',
                'recovered_at' => null,
                'recovery_user_id' => null
            ]);
        } catch (\Exception $e) {
            info("Airtel FIFO sync reverse warning: " . $e->getMessage());
        }
    }
};
