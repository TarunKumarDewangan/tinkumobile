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
        Schema::table('repair_requests', function (Blueprint $table) {
            $table->foreignId('customer_id')->nullable()->after('shop_id')->constrained('customers')->nullOnDelete();
        });

        // Optional: Attempt to link existing repairs to customers by phone
        $repairs = DB::table('repair_requests')->whereNull('customer_id')->get();
        foreach ($repairs as $repair) {
            $customer = DB::table('customers')->where('phone', $repair->customer_phone)->first();
            if ($customer) {
                DB::table('repair_requests')->where('id', $repair->id)->update(['customer_id' => $customer->id]);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('repair_requests', function (Blueprint $table) {
            $table->dropForeign(['customer_id']);
            $table->dropColumn('customer_id');
        });
    }
};
