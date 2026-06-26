<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('emp_id_sequences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shop_id')->unique()->constrained('shops')->onDelete('cascade');
            $table->unsignedInteger('last_seq')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('emp_id_sequences');
    }
};
