<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Slugs were being uppercased by the UppercaseStrings trait; normalize them to lowercase
        DB::table('categories')->get()->each(function ($cat) {
            $lower = strtolower($cat->slug);
            if ($cat->slug !== $lower) {
                DB::table('categories')->where('id', $cat->id)->update(['slug' => $lower]);
            }
        });
    }

    public function down(): void
    {
        // No rollback — lowercase slugs are correct
    }
};
