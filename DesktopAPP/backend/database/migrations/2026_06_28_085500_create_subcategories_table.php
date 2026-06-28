<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('subcategories')) {
            Schema::create('subcategories', function (Blueprint $table) {
                $table->id();
                $table->string('name')->unique();
                $table->timestamps();
            });

            // Seed default subcategories
            $defaults = [
                'Neck Band',
                'Pendrive',
                'Charger',
                'Glass Guard',
                'USB Cable',
                'Earphone',
                'Ear Buds',
                'Power Bank',
                'Phone Case',
                'Smart Watch',
                'Memory Card',
                'OTG Adapter',
                'Bluetooth Speaker'
            ];

            foreach ($defaults as $name) {
                DB::table('subcategories')->insert([
                    'name' => $name,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }

        if (Schema::hasTable('products') && !Schema::hasColumn('products', 'subcategory')) {
            Schema::table('products', function (Blueprint $table) {
                $table->string('subcategory', 100)->nullable()->after('category_id');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('products') && Schema::hasColumn('products', 'subcategory')) {
            Schema::table('products', function (Blueprint $table) {
                $table->dropColumn('subcategory');
            });
        }
        Schema::dropIfExists('subcategories');
    }
};
