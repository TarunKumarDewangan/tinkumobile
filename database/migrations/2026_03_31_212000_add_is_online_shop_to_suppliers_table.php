<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('suppliers', function (Blueprint $col) {
            $col->boolean('is_online_shop')->default(false)->after('address');
        });
    }

    public function down(): void
    {
        Schema::table('suppliers', function (Blueprint $col) {
            $col->dropColumn('is_online_shop');
        });
    }
};
