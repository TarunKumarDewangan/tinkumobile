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
        Schema::create('ledgers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('entity_id')->constrained('entities')->onDelete('cascade');
            $table->foreignId('shop_id')->nullable()->constrained()->onDelete('set null');
            $table->foreignId('user_id')->nullable()->constrained()->onDelete('set null');
            
            $table->date('date')->index();
            $table->string('voucher_type')->index(); // SALE, PURCHASE, RECEIPT, PAYMENT, JOURNAL, AIRTEL_DROP, REPAIR
            $table->unsignedBigInteger('voucher_id')->nullable()->index(); // ID of the source record
            
            $table->string('particulars');
            
            $table->decimal('debit', 15, 2)->default(0); // Increases Receivable (Customer owes more)
            $table->decimal('credit', 15, 2)->default(0); // Increases Payable (We owe more)
            
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ledgers');
    }
};
