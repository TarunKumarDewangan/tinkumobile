<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Drop unique constraint on customers.phone — soft-deleted customers should not block reuse
        Schema::table('customers', function (Blueprint $table) {
            $table->dropUnique(['phone']);
        });

        // Drop unique constraint on users.email — soft-deleted users should not block reuse
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['email']);
        });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->string('phone', 20)->unique()->change();
        });

        Schema::table('users', function (Blueprint $table) {
            $table->string('email')->unique()->change();
        });
    }
};
