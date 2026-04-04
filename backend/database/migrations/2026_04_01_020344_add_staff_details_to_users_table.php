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
        Schema::table('users', function (Blueprint $table) {
            $table->string('phone', 20)->nullable();
            $table->text('address')->nullable();
            $table->string('designation', 100)->nullable();
            $table->decimal('base_salary', 10, 2)->default(0);
            $table->date('joining_date')->nullable();
            $table->string('aadhaar_no', 20)->nullable();
            $table->string('status', 20)->default('active'); // active, inactive
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['phone', 'address', 'designation', 'base_salary', 'joining_date', 'aadhaar_no', 'status']);
        });
    }
};
