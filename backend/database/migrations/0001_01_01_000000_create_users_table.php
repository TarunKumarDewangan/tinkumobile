<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shops', function (Blueprint $table) {
            $table->id();
            $table->string('name', 150);
            $table->text('address');
            $table->string('phone', 20);
            $table->string('email', 100)->nullable();
            $table->boolean('is_main')->default(false);
            $table->timestamps();
        });

        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100);
            $table->string('email', 100)->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password');
            $table->foreignId('shop_id')->nullable()->constrained('shops')->nullOnDelete();
            $table->boolean('is_owner')->default(false);
            $table->string('phone', 20)->nullable();
            $table->text('address')->nullable();
            $table->string('designation', 100)->nullable();
            $table->decimal('base_salary', 10, 2)->default(0);
            $table->date('joining_date')->nullable();
            $table->string('aadhaar_no', 20)->nullable();
            $table->string('status', 20)->default('active'); // active, inactive
            $table->rememberToken();
            $table->timestamps();
        });

        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->foreignId('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sessions');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('users');
        Schema::dropIfExists('shops');
    }
};
