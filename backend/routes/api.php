<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ShopController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\SupplierController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\PurchaseInvoiceController;
use App\Http\Controllers\Api\SaleInvoiceController;
use App\Http\Controllers\Api\RepairController;
use App\Http\Controllers\Api\LoanController;
use App\Http\Controllers\Api\LoanPayment;
use App\Http\Controllers\Api\RechargeController;
use App\Http\Controllers\Api\SimCardController;
use App\Http\Controllers\Api\OldMobileController;
use App\Http\Controllers\Api\GiftController;
use App\Http\Controllers\Api\FollowUpController;
use App\Http\Controllers\Api\IncentiveController;
use App\Http\Controllers\Api\CompanyOfferController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\StockAdjustmentController;
use App\Http\Controllers\Api\StockController;
use App\Http\Controllers\Api\EmployeeController;
use App\Http\Controllers\Api\SalaryPaymentController;
use App\Http\Controllers\Api\AirtelRetailerController;
use App\Http\Controllers\Api\ActivityLogController;
use App\Http\Controllers\Api\TrashController;
use App\Http\Controllers\Api\AirtelDropController;
use App\Http\Controllers\Api\TransactionController;
use App\Http\Controllers\Api\ExpenseCategoryController;
use App\Http\Controllers\Api\EntityLedgerController;
use App\Http\Controllers\Api\EntityController;
use App\Http\Controllers\Api\SystemBackupController;
use App\Http\Controllers\Api\FinancePlanController;
use App\Http\Controllers\Api\RolePermissionController;
use Illuminate\Support\Facades\Route;

// ── Public Routes ──────────────────────────────────────────────────────────
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:5,1');
Route::post('/login/verify-otp', [AuthController::class, 'verifyOtp'])->middleware('throttle:5,1');
Route::post('/login/resend-otp', [AuthController::class, 'resendOtp'])->middleware('throttle:3,1');
Route::post('/repair-request', [RepairController::class, 'publicStore'])->middleware('throttle:10,1'); // Customer submits repair
Route::get('/public/retailer/{msisdn}', [AirtelRetailerController::class, 'publicProfile'])->middleware('throttle:30,1');

// Customer Portal
Route::post('/customer/login', [CustomerController::class, 'portalLogin'])->middleware('throttle:5,1');

// ── Authenticated Routes (Sanctum) ──────────────────────────────────────────
Route::middleware(['auth:sanctum', \App\Http\Middleware\ShopScope::class])->group(function () {
    // Customer history moved inside auth guard (was public — IDOR vulnerability)
    Route::get('/customer/history/{customer}', [CustomerController::class, 'getHistory']);

    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/change-password', [AuthController::class, 'changePassword']);

    // Universal search
    Route::get('/search', [\App\Http\Controllers\Api\SearchController::class, 'index']);

    // Master data (shared / global – no shop filter needed)
    Route::apiResource('categories', CategoryController::class)->only(['index', 'store', 'update', 'destroy']);
    Route::apiResource('suppliers', SupplierController::class);
    Route::post('customers/send-offer', [CustomerController::class, 'sendOffer']);
    Route::apiResource('customers', CustomerController::class);
    Route::apiResource('brands', \App\Http\Controllers\Api\BrandController::class)->only(['index', 'store']);
    Route::apiResource('subcategories', \App\Http\Controllers\Api\SubcategoryController::class)->only(['index', 'store']);

    // Products
    Route::delete('/products/stock/{id}', [ProductController::class, 'deleteStock']);
    Route::put('/products/stock/{id}', [ProductController::class, 'updateStock']);
    Route::get('/products/sticker-list', [ProductController::class, 'stickerList']);
    Route::apiResource('products', ProductController::class);

    // Stock Adjustments (opening stock, corrections, backdated purchases)
    Route::get('/stock-levels', [StockAdjustmentController::class, 'stockLevels']);
    Route::get('/stock-adjustments', [StockAdjustmentController::class, 'index']);
    Route::post('/stock-adjustments', [StockAdjustmentController::class, 'store']);
    Route::post('/stock-adjustments/bulk', [StockAdjustmentController::class, 'bulkStore']);
    Route::post('/stock-adjustments/bulk-delete', [StockAdjustmentController::class, 'bulkDestroy']);
    Route::get('/stock-adjustments/duplicates', [StockAdjustmentController::class, 'duplicatesReport']);
    Route::post('/stock-adjustments/clear-duplicates', [StockAdjustmentController::class, 'clearDuplicates']);
    Route::post('/stock-adjustments/clear-all', [StockAdjustmentController::class, 'clearAllStocks']);
    Route::put('/stock-adjustments/{id}', [StockAdjustmentController::class, 'update']);
    Route::delete('/stock-adjustments/{id}', [StockAdjustmentController::class, 'destroy']);
    Route::get('/stocks/daily-ledger', [StockController::class, 'dailyLedger']);
    Route::get('/stocks/closing-stock-detail', [StockController::class, 'closingStockDetail']);
    Route::get('/stocks/backup', [StockController::class, 'backup']);
    Route::post('/stocks/restore-backup', [StockController::class, 'restoreBackup']);
    Route::patch('/stocks/{id}/location', [StockController::class, 'updateLocation']);

    // Stock Transfers (between shops)
    Route::get('/stock-transfers/shops', [\App\Http\Controllers\Api\StockTransferController::class, 'shopsList']);
    Route::get('/stock-transfers/products-at', [\App\Http\Controllers\Api\StockTransferController::class, 'productsAt']);
    Route::get('/stock-transfers/stock-at', [\App\Http\Controllers\Api\StockTransferController::class, 'stockAt']);
    Route::get('/stock-transfers', [\App\Http\Controllers\Api\StockTransferController::class, 'index']);
    Route::post('/stock-transfers', [\App\Http\Controllers\Api\StockTransferController::class, 'store']);
    Route::post('/stock-transfers/{stockTransfer}/receive', [\App\Http\Controllers\Api\StockTransferController::class, 'receive']);
    Route::post('/stock-transfers/{stockTransfer}/cancel', [\App\Http\Controllers\Api\StockTransferController::class, 'cancel']);

    // Shops – owner only
    Route::apiResource('shops', ShopController::class);

    // Users & role management
    Route::apiResource('users', UserController::class);

    // Role permission management (owner only)
    Route::get('role-permissions', [RolePermissionController::class, 'index']);
    Route::post('role-permissions/{roleName}/sync', [RolePermissionController::class, 'sync']);

    // Employees
    Route::apiResource('employees', EmployeeController::class);
    Route::apiResource('salary-payments', SalaryPaymentController::class)->only(['index', 'store', 'show', 'destroy']);

    // Purchases
    Route::get('purchase-invoices/backup', [PurchaseInvoiceController::class, 'backup']);
    Route::post('purchase-invoices/restore-backup', [PurchaseInvoiceController::class, 'restoreBackup']);
    Route::get('purchase-invoices/unique-imeis', [PurchaseInvoiceController::class, 'getUniqueImeis']);
    Route::get('purchase-invoices/pending-stocks', [PurchaseInvoiceController::class, 'pendingStocks']);
    Route::apiResource('purchase-invoices', PurchaseInvoiceController::class)->parameters([
        'purchase-invoices' => 'purchaseInvoice'
    ]);
    Route::post('/purchase-invoices/{purchaseInvoice}/receive', [PurchaseInvoiceController::class, 'markReceived']);
    Route::post('/purchase-invoices/{purchaseInvoice}/add-payment', [PurchaseInvoiceController::class, 'addPayment']);

    // Sales
    Route::get('sale-invoices/backup', [SaleInvoiceController::class, 'backup']);
    Route::post('sale-invoices/restore-backup', [SaleInvoiceController::class, 'restoreBackup']);
    Route::apiResource('sale-invoices', SaleInvoiceController::class);
    Route::post('sale-invoices/{sale_invoice}/add-payment', [SaleInvoiceController::class, 'addPayment']);
    Route::post('sale-invoices/{sale_invoice}/receive-finance', [SaleInvoiceController::class, 'receiveFinancePayment']);
    Route::post('/sale-invoices/{saleInvoice}/convert-to-pakka', [SaleInvoiceController::class, 'convertToPakka']);
    Route::post('/sale-invoices/{saleInvoice}/cancel', [SaleInvoiceController::class, 'cancel']);
    Route::post('/sale-invoices/{saleInvoice}/convert-to-new-sale', [SaleInvoiceController::class, 'convertToNewSale']);


    // Repairs
    Route::get('/repairs/backup', [RepairController::class, 'backup']);
    Route::post('/repairs/restore-backup', [RepairController::class, 'restoreBackup']);
    Route::get('/repairs/external-shops', [RepairController::class, 'getExternalShops']);
    Route::post('/repairs/{repair}/pay-cost', [RepairController::class, 'payForwardCost']);
    Route::apiResource('repairs', RepairController::class);

    // Follow-ups
    Route::apiResource('follow-ups', FollowUpController::class)->only(['index', 'store', 'update', 'destroy']);

    // Users
    Route::get('/users', [UserController::class, 'index']);
    Route::post('/users', [UserController::class, 'store']);
    Route::put('/users/{id}', [UserController::class, 'update']);
    Route::delete('/users/{id}', [UserController::class, 'destroy']);

    // Activity Logs
    Route::get('/activity-logs', [ActivityLogController::class, 'index']);
    Route::delete('/activity-logs/clear', [ActivityLogController::class, 'clear']);
    Route::delete('/activity-logs/{activityLog}', [ActivityLogController::class, 'destroy']);

    // Trash Management
    Route::get('/trash', [TrashController::class, 'index']);
    Route::post('/trash/restore', [TrashController::class, 'restore']);
    Route::post('/trash/force-delete', [TrashController::class, 'forceDelete']);

    // Loans
    Route::get('/loans', [LoanController::class, 'index']);
    Route::post('/loans', [LoanController::class, 'store']);
    Route::get('/loans/{loan}', [LoanController::class, 'show']);
    Route::post('/loan-payments/{loanPayment}/record', [LoanController::class, 'recordPayment']);

    // Recharge
    Route::get('/recharge-purchases', [RechargeController::class, 'purchaseIndex']);
    Route::post('/recharge-purchases', [RechargeController::class, 'purchaseStore']);
    Route::get('/recharge-sales', [RechargeController::class, 'saleIndex']);
    Route::post('/recharge-sales', [RechargeController::class, 'saleStore']);

    // SIM Cards
    Route::get('/sim-cards', [SimCardController::class, 'index']);
    Route::post('/sim-cards', [SimCardController::class, 'purchase']);
    Route::post('/sim-cards/{simCard}/sell', [SimCardController::class, 'sell']);

    // Old Mobiles
    Route::get('/old-mobiles', [OldMobileController::class, 'index']);
    Route::post('/old-mobiles', [OldMobileController::class, 'store']);
    Route::post('/old-mobiles/bulk', [OldMobileController::class, 'bulkStore']);
    Route::get('/old-mobiles/{oldMobilePurchase}', [OldMobileController::class, 'show']);
    Route::put('/old-mobiles/{oldMobilePurchase}', [OldMobileController::class, 'update']);
    Route::delete('/old-mobiles/{oldMobilePurchase}', [OldMobileController::class, 'destroy']);

    // Gifts
    Route::get('/gift-products', [GiftController::class, 'products']);
    Route::post('/gift-products', [GiftController::class, 'storeProduct']);
    Route::get('/gift-inventory', [GiftController::class, 'inventory']);
    Route::post('/gift-inventory/add-stock', [GiftController::class, 'addStock']);

    // Incentives
    Route::get('/incentives', [IncentiveController::class, 'index']);
    Route::post('/incentives/{incentive}/mark-paid', [IncentiveController::class, 'markPaid']);

    // Company Offers
    Route::get('/company-offers', [CompanyOfferController::class, 'index']);
    Route::post('/company-offers', [CompanyOfferController::class, 'store']);
    Route::put('/company-offers/{companyOffer}', [CompanyOfferController::class, 'update']);

    // Reports
    Route::prefix('reports')->group(function () {
        Route::get('/sales', [ReportController::class, 'sales']);
        Route::get('/combined-sales', [ReportController::class, 'combinedSalesReport']);
        Route::get('/set-sales-matrix', [ReportController::class, 'setSalesMatrix']);
        Route::get('/profit', [ReportController::class, 'profit']);
        Route::get('/stock', [ReportController::class, 'stock']);
        Route::get('/incentives', [ReportController::class, 'incentives']);
        Route::get('/repairs', [ReportController::class, 'repairs']);
        Route::get('/follow-ups', [ReportController::class, 'followups']);
        Route::get('/loans', [ReportController::class, 'loans']);
        Route::get('/gift-stock', [ReportController::class, 'giftStock']);
        Route::get('/bill-conversion', [ReportController::class, 'billConversion']);
        Route::get('/dashboard', [ReportController::class, 'dashboard']);
        Route::get('/financer', [ReportController::class, 'financerReport']);
        Route::get('/old-mobile-exchange', [ReportController::class, 'oldMobileExchangeReport']);
    });

    // Airtel Recovery System
    Route::get('airtel-retailers/backup', [AirtelRetailerController::class, 'backup']);
    Route::post('airtel-retailers/restore-backup', [AirtelRetailerController::class, 'restoreBackup']);
    Route::get('airtel-retailers/export', [AirtelRetailerController::class, 'export']);
    Route::apiResource('airtel-retailers', AirtelRetailerController::class);
    Route::get('airtel-drops', [AirtelDropController::class, 'index']);
    Route::post('airtel-drops/import', [AirtelDropController::class, 'import']);
    Route::post('airtel-drops/import-upi', [AirtelDropController::class, 'importUpi']);
    Route::post('airtel-drops/bulk-delete', [AirtelDropController::class, 'bulkDeleteByDate']);
    Route::post('airtel-drops/mark-recovered', [AirtelDropController::class, 'markAsRecovered']);
    Route::post('airtel-recoveries/bulk-delete', [AirtelRetailerController::class, 'bulkDeleteRecoveries']);
    Route::post('airtel-retailers/bulk-clear-opening-balances', [AirtelRetailerController::class, 'bulkClearOpeningBalances']);
    Route::post('airtel-retailers/bulk-full-reset', [AirtelRetailerController::class, 'bulkFullReset']);
    Route::post('airtel-retailers/{id}/record-recovery', [AirtelRetailerController::class, 'recordRecovery']);
    Route::delete('airtel-recoveries/{id}', [AirtelRetailerController::class, 'deleteRecovery']);
    Route::post('airtel-drops/update-follow-up', [AirtelDropController::class, 'updateFollowUp']);
    Route::get('airtel-drops/summary', [AirtelDropController::class, 'summary']);
    Route::get('airtel-drops/report', [AirtelDropController::class, 'report']);
    Route::get('airtel-drops/export-recovery-log', [AirtelDropController::class, 'exportRecoveryLog']);
    Route::delete('airtel-drops/{drop}', [AirtelDropController::class, 'destroy']);

    // Accounting & Transactions
    Route::get('entities/summary', [EntityLedgerController::class, 'summary']);
    Route::get('entities/report', [EntityLedgerController::class, 'report']);
    Route::get('entities/statements', [EntityLedgerController::class, 'index']);
    Route::get('entities/customer-ledger', [EntityLedgerController::class, 'showForCustomer']);
    Route::get('entities/{name}/ledger', [EntityLedgerController::class, 'show']);
    Route::post('entities/settle', [EntityLedgerController::class, 'recordSettlement']);

    Route::apiResource('entities', EntityController::class);
    Route::delete('entities/{entity}/with-history', [EntityController::class, 'destroyWithHistory']);
    Route::post('entities-sync', [EntityController::class, 'autoSync']);
    Route::post('/entities-hard-reset', [\App\Http\Controllers\Api\EntityController::class, 'hardReset']);
    
    // Accounting Ledger System
    Route::prefix('ledgers')->group(function () {
        Route::get('/summary', [\App\Http\Controllers\Api\LedgerController::class, 'summary']);
        Route::get('/daybook', [\App\Http\Controllers\Api\LedgerController::class, 'daybook']);
        Route::get('/entity-balances', [\App\Http\Controllers\Api\LedgerController::class, 'entityBalances']);
        Route::get('/statement/{entityId}', [\App\Http\Controllers\Api\LedgerController::class, 'statement']);
        Route::get('/breakdown', [\App\Http\Controllers\Api\LedgerController::class, 'breakdown']);
    });

    Route::get('/transactions/categories', [TransactionController::class, 'categories']);
    Route::apiResource('transactions', TransactionController::class)->only(['index', 'store', 'show', 'update', 'destroy']);
    Route::apiResource('expense-categories', ExpenseCategoryController::class)->only(['index', 'store', 'update', 'destroy']);

    Route::post('entities/sync-all-balances', function() {
        app(\App\Services\EntityService::class)->syncAll();
        return response()->json(['message' => 'All balances synced successfully']);
    });

    // Shop Finance Plans (Personal EMI & Favor)
    Route::get('finance-plans', [FinancePlanController::class, 'index']);
    Route::post('finance-plans', [FinancePlanController::class, 'store']);
    Route::get('finance-plans/{financePlan}', [FinancePlanController::class, 'show']);
    Route::post('finance-plans/{financePlan}/add-payment', [FinancePlanController::class, 'addPayment']);
    Route::post('finance-plans/{financePlan}/settle', [FinancePlanController::class, 'settle']);

    // Full System Sync — throttled to prevent abuse
    Route::get('system/backup', [SystemBackupController::class, 'backup'])->middleware('throttle:60,1');
    Route::post('system/restore-backup', [SystemBackupController::class, 'restoreBackup'])->middleware('throttle:60,1');
    // Settings
    Route::get('settings', [\App\Http\Controllers\Api\SettingsController::class, 'index']);
    Route::post('settings', [\App\Http\Controllers\Api\SettingsController::class, 'update']);
    Route::post('settings/test-whatsapp', [\App\Http\Controllers\Api\SettingsController::class, 'testWhatsApp']);
    Route::post('settings/test-telegram', [\App\Http\Controllers\Api\SettingsController::class, 'testTelegram']);

    // Manual "Send Now" report triggers (Settings > Notifications)
    Route::post('notifications/send-daily-summary', [\App\Http\Controllers\Api\NotificationController::class, 'sendDailySummary']);
    Route::post('notifications/send-emi-reminder', [\App\Http\Controllers\Api\NotificationController::class, 'sendEmiDueReminder']);
    Route::post('settings/verify-pin', [\App\Http\Controllers\Api\SettingsController::class, 'verifyPin'])->middleware('throttle:10,1');
    Route::post('settings/change-pin', [\App\Http\Controllers\Api\SettingsController::class, 'changePin'])->middleware('throttle:5,1');

    // Tasks
    Route::get('tasks', [\App\Http\Controllers\Api\TaskController::class, 'index'])->middleware('permission:view_tasks');
    Route::post('tasks', [\App\Http\Controllers\Api\TaskController::class, 'store'])->middleware('permission:assign_tasks');
    Route::get('tasks/{id}', [\App\Http\Controllers\Api\TaskController::class, 'show'])->middleware('permission:view_tasks');
    Route::put('tasks/{id}', [\App\Http\Controllers\Api\TaskController::class, 'update'])->middleware('permission:assign_tasks');
    Route::patch('tasks/{id}/status', [\App\Http\Controllers\Api\TaskController::class, 'updateStatus'])->middleware('permission:complete_task');
    Route::delete('tasks/{id}', [\App\Http\Controllers\Api\TaskController::class, 'destroy'])->middleware('permission:assign_tasks');
});
