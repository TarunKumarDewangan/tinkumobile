<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attendance_face_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            // face-api.js descriptor: 128 floats, stored as JSON — never the raw
            // photo is used for matching, only this numeric vector.
            $table->json('descriptor');
            $table->string('enrollment_photo_path')->nullable();
            $table->timestamp('enrolled_at');
            $table->foreignId('enrolled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendance_face_profiles');
    }
};
