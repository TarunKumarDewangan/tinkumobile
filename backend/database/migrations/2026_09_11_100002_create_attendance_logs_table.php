<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attendance_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->foreignId('shop_id')->constrained()->onDelete('cascade');
            $table->enum('type', ['IN', 'OUT']);
            $table->timestamp('logged_at');
            $table->decimal('latitude', 10, 7);
            $table->decimal('longitude', 10, 7);
            $table->decimal('distance_meters', 8, 2);
            // 0-1 similarity score from face-api.js's descriptor distance —
            // kept even though only passing attempts are ever saved, so a
            // borderline-but-accepted match can still be reviewed later.
            $table->decimal('face_match_score', 5, 4);
            $table->string('snapshot_path')->nullable();
            // Manual corrections (a missed checkout fixed by an admin) skip
            // the face/GPS checks entirely — flagged here so the report can
            // show they were not verified live.
            $table->boolean('is_manual')->default(false);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['user_id', 'logged_at']);
            $table->index(['shop_id', 'logged_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendance_logs');
    }
};
