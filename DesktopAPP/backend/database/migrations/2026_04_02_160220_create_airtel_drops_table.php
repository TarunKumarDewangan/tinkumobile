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
        Schema::create('airtel_drops', function (Blueprint $table) {
            $table->id();
            $table->foreignId('retailer_id')->index()->constrained()->onDelete('cascade');
            $table->decimal('amount', 12, 2);
            $table->decimal('paid_amount', 12, 2)->default(0);
            $table->dateTime('refill_date')->index();
            $table->enum('status', ['pending', 'recovered'])->default('pending');
            $table->foreignId('recovery_user_id')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamp('recovered_at')->nullable();
            $table->string('reason')->nullable();
            $table->date('next_recovery_date')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('airtel_drops');
    }
};
