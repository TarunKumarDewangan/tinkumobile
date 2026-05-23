<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sale_invoices', function (Blueprint $table) {
            // Finance company entity
            $table->unsignedBigInteger('financer_id')->nullable()->after('accounting_entity_id');
            $table->foreign('financer_id')->references('id')->on('entities')->nullOnDelete();

            // Amount paid by customer upfront
            $table->decimal('down_payment', 15, 2)->nullable()->default(0)->after('financer_id');

            // Amount to be paid / paid by finance company
            $table->decimal('finance_amount', 15, 2)->nullable()->default(0)->after('down_payment');

            // Track whether financer has transferred the money
            // RECEIVED = paid same day, PENDING = will come later
            $table->string('finance_payment_status')->nullable()->after('finance_amount'); // RECEIVED | PENDING
        });
    }

    public function down(): void
    {
        Schema::table('sale_invoices', function (Blueprint $table) {
            $table->dropForeign(['financer_id']);
            $table->dropColumn(['financer_id', 'down_payment', 'finance_amount', 'finance_payment_status']);
        });
    }
};
