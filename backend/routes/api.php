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
use Illuminate\Support\Facades\Route;

// ── Public Routes ──────────────────────────────────────────────────────────
Route::post('/login', [AuthController::class, 'login']);
Route::post('/repair-request', [RepairController::class, 'publicStore']); // Customer submits repair
Route::get('/public/retailer/{msisdn}', [AirtelRetailerController::class, 'publicProfile']);

// Customer Portal
Route::post('/customer/login', [CustomerController::class, 'portalLogin']);
Route::get('/customer/history/{customer}', [CustomerController::class, 'getHistory']);

// ── Authenticated Routes (Sanctum) ──────────────────────────────────────────
Route::middleware(['auth:sanctum', \App\Http\Middleware\ShopScope::class])->group(function () {

    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);

    // Master data (shared / global – no shop filter needed)
    Route::apiResource('categories', CategoryController::class);
    Route::apiResource('suppliers', SupplierController::class);
    Route::apiResource('customers', CustomerController::class);

    // Products
    Route::delete('/products/stock/{id}', [ProductController::class, 'deleteStock']);
    Route::apiResource('products', ProductController::class);

    // Stock Adjustments (opening stock, corrections, backdated purchases)
    Route::get('/stock-levels', [StockAdjustmentController::class, 'stockLevels']);
    Route::get('/stock-adjustments', [StockAdjustmentController::class, 'index']);
    Route::post('/stock-adjustments', [StockAdjustmentController::class, 'store']);
    Route::post('/stock-adjustments/bulk', [StockAdjustmentController::class, 'bulkStore']);
    Route::put('/stock-adjustments/{id}', [StockAdjustmentController::class, 'update']);
    Route::delete('/stock-adjustments/{id}', [StockAdjustmentController::class, 'destroy']);
    Route::patch('/stocks/{id}/location', [StockController::class, 'updateLocation']);

    // Shops – owner only
    Route::apiResource('shops', ShopController::class);

    // Users & role management
    Route::apiResource('users', UserController::class);

    // Employees
    Route::apiResource('employees', EmployeeController::class);
    Route::apiResource('salary-payments', SalaryPaymentController::class);

    // Purchases
    Route::get('purchase-invoices/unique-imeis', [PurchaseInvoiceController::class, 'getUniqueImeis']);
    Route::get('purchase-invoices/pending-stocks', [PurchaseInvoiceController::class, 'pendingStocks']);
    Route::apiResource('purchase-invoices', PurchaseInvoiceController::class)->parameters([
        'purchase-invoices' => 'purchaseInvoice'
    ]);
    Route::post('/purchase-invoices/{purchaseInvoice}/receive', [PurchaseInvoiceController::class, 'markReceived']);
    Route::post('/purchase-invoices/{purchaseInvoice}/add-payment', [PurchaseInvoiceController::class, 'addPayment']);

    // Sales
    Route::apiResource('sale-invoices', SaleInvoiceController::class);
    Route::post('sale-invoices/{sale_invoice}/add-payment', [SaleInvoiceController::class, 'addPayment']);
    Route::post('/sale-invoices/{saleInvoice}/convert-to-pakka', [SaleInvoiceController::class, 'convertToPakka']);
    Route::post('/sale-invoices/{saleInvoice}/cancel', [SaleInvoiceController::class, 'cancel']);

    // Repairs
    Route::get('/repairs/external-shops', [RepairController::class, 'getExternalShops']);
    Route::post('/repairs/{repair}/pay-cost', [RepairController::class, 'payForwardCost']);
    Route::apiResource('repairs', RepairController::class);

    // Follow-ups
    Route::apiResource('follow-ups', FollowUpController::class);

    // Users
    Route::get('/users', [UserController::class, 'index']);
    Route::post('/users', [UserController::class, 'store']);
    Route::put('/users/{id}', [UserController::class, 'update']);
    Route::delete('/users/{id}', [UserController::class, 'destroy']);

    // Activity Logs
    Route::get('/activity-logs', [ActivityLogController::class, 'index']);

    // Trash Management
    Route::get('/trash', [TrashController::class, 'index']);
    Route::post('/trash/restore', [TrashController::class, 'restore']);

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
    Route::get('/old-mobiles/{oldMobilePurchase}', [OldMobileController::class, 'show']);

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
        Route::get('/profit', [ReportController::class, 'profit']);
        Route::get('/stock', [ReportController::class, 'stock']);
        Route::get('/incentives', [ReportController::class, 'incentives']);
        Route::get('/repairs', [ReportController::class, 'repairs']);
        Route::get('/follow-ups', [ReportController::class, 'followups']);
        Route::get('/loans', [ReportController::class, 'loans']);
        Route::get('/gift-stock', [ReportController::class, 'giftStock']);
        Route::get('/bill-conversion', [ReportController::class, 'billConversion']);
        Route::get('/dashboard', [ReportController::class, 'dashboard']);
    });

    // Airtel Recovery System
    Route::get('airtel-retailers/export', [AirtelRetailerController::class, 'export']);
    Route::apiResource('airtel-retailers', AirtelRetailerController::class);
    Route::get('airtel-drops', [AirtelDropController::class, 'index']);
    Route::post('airtel-drops/import', [AirtelDropController::class, 'import']);
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
    Route::delete('airtel-drops/{drop}', [AirtelDropController::class, 'destroy']);

    // Accounting & Transactions
    Route::get('/entities/statements', [EntityLedgerController::class, 'index']);
    Route::get('/entities/{name}/ledger', [EntityLedgerController::class, 'show']);
    Route::post('/entities/settle', [EntityLedgerController::class, 'settle']);
    
    Route::get('/transactions/categories', [TransactionController::class, 'categories']);
    Route::apiResource('transactions', TransactionController::class);
    Route::apiResource('expense-categories', ExpenseCategoryController::class);
});
