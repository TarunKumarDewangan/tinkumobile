<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('repair_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shop_id')->constrained('shops');
            $table->string('customer_name', 150);
            $table->string('customer_phone', 20);
            $table->string('customer_email', 100)->nullable();
            $table->string('device_model', 150);
            $table->text('issue_description');
            $table->enum('status', ['pending', 'assigned', 'in_progress', 'completed', 'delivered'])->default('pending');
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->date('estimated_delivery_date')->nullable();
            $table->date('actual_delivery_date')->nullable();
            $table->enum('created_by', ['customer', 'staff'])->default('customer');
            $table->foreignId('staff_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('follow_ups', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->constrained('customers');
            $table->json('interested_product_ids')->nullable();
            $table->text('address')->nullable();
            $table->date('follow_up_date');
            $table->text('notes')->nullable();
            $table->enum('status', ['pending', 'completed', 'cancelled'])->default('pending');
            $table->date('completed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('follow_ups');
        Schema::dropIfExists('repair_requests');
    }
};
