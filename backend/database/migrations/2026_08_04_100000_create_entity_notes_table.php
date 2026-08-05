<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('entity_notes', function (Blueprint $table) {
            $table->id();
            // Nullable — some Pending Balance rows (e.g. Personal Finance
            // without a resolvable Entity) don't have a real entity_id, so
            // name/phone are kept alongside as the reliable fallback.
            $table->foreignId('entity_id')->nullable()->constrained('entities')->nullOnDelete();
            $table->string('name');
            $table->string('phone')->nullable();
            $table->string('category')->nullable(); // CUSTOMER, SHOP_CUSTOMER, PERSONAL_FINANCE, COMPANY_FINANCE
            $table->date('promise_date');
            $table->text('note')->nullable();
            $table->decimal('balance_at_time', 12, 2)->nullable();
            $table->foreignId('shop_id')->nullable()->constrained('shops')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('promise_date');
            $table->index('entity_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('entity_notes');
    }
};
