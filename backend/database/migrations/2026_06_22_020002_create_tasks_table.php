<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tasks', function (Blueprint $table) {
            $table->id();
            $table->string('title', 255);
            $table->text('description')->nullable();
            $table->foreignId('assigned_by')->constrained('users')->onDelete('cascade');
            $table->foreignId('assigned_to')->constrained('users')->onDelete('cascade');
            $table->foreignId('shop_id')->constrained('shops')->onDelete('cascade');
            $table->string('related_type')->nullable()->comment('repair|sale|customer|airtel_retailer');
            $table->unsignedBigInteger('related_id')->nullable();
            $table->string('priority', 20)->default('medium')->comment('low|medium|high|urgent');
            $table->string('status', 20)->default('pending')->comment('pending|in_progress|completed|cancelled');
            $table->date('due_date')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['shop_id', 'status']);
            $table->index(['assigned_to', 'status']);
            $table->index(['related_type', 'related_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tasks');
    }
};
