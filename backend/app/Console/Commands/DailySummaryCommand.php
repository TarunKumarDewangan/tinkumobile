<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\SaleInvoice;
use App\Models\PurchaseInvoice;
use App\Models\AirtelRecovery;
use App\Models\RepairRequest;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;

class DailySummaryCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'report:daily-summary';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Send daily summary report to the owner via WhatsApp at 9 PM';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $today = Carbon::today();
        $dateStr = $today->format('d M Y');

        // Core counts
        $saleCount = SaleInvoice::whereDate('sale_date', $today)->count();
        $repairCount = RepairRequest::whereDate('submitted_date', $today)->count();
        $recoveryCount = AirtelRecovery::whereDate('recovered_at', $today)->count();
        
        // Financial Breakdown from Transactions
        // IN (Collections)
        $cashIn = \App\Models\Transaction::whereDate('transaction_date', $today)
            ->where('type', 'IN')
            ->where('payment_mode', 'CASH')
            ->sum('amount');
            
        $bankIn = \App\Models\Transaction::whereDate('transaction_date', $today)
            ->where('type', 'IN')
            ->where('payment_mode', '!=', 'CASH')
            ->sum('amount');

        // OUT (Payments/Purchases/Expenses)
        $cashOut = \App\Models\Transaction::whereDate('transaction_date', $today)
            ->where('type', 'OUT')
            ->where('payment_mode', 'CASH')
            ->sum('amount');
            
        $bankOut = \App\Models\Transaction::whereDate('transaction_date', $today)
            ->where('type', 'OUT')
            ->where('payment_mode', '!=', 'CASH')
            ->sum('amount');

        $totalIn = $cashIn + $bankIn;
        $totalOut = $cashOut + $bankOut;

        $msg = "📊 *Daily Business Summary ({$dateStr})*\n";
        $msg .= "---------------------------\n";
        $msg .= "📝 *Activity Counts:*\n";
        $msg .= "• Sales Invoices: {$saleCount}\n";
        $msg .= "• Repairs Booked: {$repairCount}\n";
        $msg .= "• Airtel Recoveries: {$recoveryCount}\n\n";
        
        $msg .= "💰 *Collections (IN):*\n";
        $msg .= "• Cash: ₹" . number_format($cashIn, 2) . "\n";
        $msg .= "• Bank/UPI: ₹" . number_format($bankIn, 2) . "\n";
        $msg .= "• *Total IN: ₹" . number_format($totalIn, 2) . "*\n\n";

        $msg .= "💸 *Payments (OUT):*\n";
        $msg .= "• Cash: ₹" . number_format($cashOut, 2) . "\n";
        $msg .= "• Bank/UPI: ₹" . number_format($bankOut, 2) . "\n";
        $msg .= "• *Total OUT: ₹" . number_format($totalOut, 2) . "*\n";
        $msg .= "---------------------------\n";
        $msg .= "✨ *Closing Status:*\n";
        $msg .= "• Net Day Cash: ₹" . number_format($cashIn - $cashOut, 2) . "\n";
        $msg .= "---------------------------\n";
        $msg .= "_Tinku Mobiles Management System_";

        try {
            app(\App\Services\WhatsAppService::class)->sendToOwner($msg);
            $this->info('Detailed daily summary sent successfully.');
        } catch (\Exception $e) {
            Log::error('Failed to send Daily Summary WhatsApp', ['error' => $e->getMessage()]);
            $this->error('Failed to send daily summary.');
        }
    }
}
