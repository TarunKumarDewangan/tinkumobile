<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sale_invoices', function (Blueprint $table) {
            // Update enum to include 'manual'
            $table->enum('rounding_mode', ['auto', 'up', 'down', 'manual'])->default('auto')->change();
        });
    }

    public function down(): void
    {
        Schema::table('sale_invoices', function (Blueprint $table) {
            $table->enum('rounding_mode', ['auto', 'up', 'down'])->default('auto')->change();
        });
    }
};
