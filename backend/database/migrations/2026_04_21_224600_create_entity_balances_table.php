<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('entity_balances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('entity_id')->constrained()->onDelete('cascade');
            $table->decimal('in_worth', 15, 2)->default(0);
            $table->decimal('out_worth', 15, 2)->default(0);
            $table->decimal('unrealized', 15, 2)->default(0);
            $table->decimal('net_balance', 15, 2)->default(0);
            $table->decimal('repair_dues', 15, 2)->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('entity_balances');
    }
};
