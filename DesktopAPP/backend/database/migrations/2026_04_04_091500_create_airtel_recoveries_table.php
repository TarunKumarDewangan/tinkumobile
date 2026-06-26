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
        Schema::create('airtel_recoveries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('retailer_id')->constrained()->onDelete('cascade');
            $table->decimal('amount', 12, 2);
            $table->timestamp('recovered_at')->useCurrent();
            $table->foreignId('recovery_user_id')->nullable()->constrained('users')->onDelete('set null');
            $table->string('notes')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('airtel_recoveries');
    }
};
