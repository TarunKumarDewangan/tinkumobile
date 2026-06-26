<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('task_updates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('task_id')->constrained('tasks')->onDelete('cascade');
            $table->foreignId('updated_by')->constrained('users')->onDelete('cascade');
            $table->string('old_status', 20)->nullable();
            $table->string('new_status', 20)->nullable();
            $table->text('comment')->nullable();
            $table->timestamps();

            $table->index('task_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('task_updates');
    }
};
