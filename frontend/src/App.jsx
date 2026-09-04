import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import PermissionRoute from './components/PermissionRoute';
import PinModal from './components/PinModal';

// Pages
const Login = lazy(() => import('./pages/auth/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const PendingBalance = lazy(() => import('./pages/PendingBalance'));
const Products = lazy(() => import('./pages/products/Products'));
const ProductForm = lazy(() => import('./pages/products/ProductForm'));
const GenerateStickers = lazy(() => import('./pages/stickers/GenerateStickers'));
const StickerPrices = lazy(() => import('./pages/stickers/StickerPrices'));
const StickerPrint = lazy(() => import('./pages/stickers/StickerPrint'));
const Purchases = lazy(() => import('./pages/purchases/Purchases'));
const PurchaseForm = lazy(() => import('./pages/purchases/PurchaseForm'));
const MasterPurchaseForm = lazy(() => import('./pages/purchases/MasterPurchaseForm'));
const PurchaseDetails = lazy(() => import('./pages/purchases/PurchaseDetails'));
const Sales = lazy(() => import('./pages/sales/Sales'));
const SaleForm = lazy(() => import('./pages/sales/SaleForm'));
const MasterSaleForm = lazy(() => import('./pages/sales/MasterSaleForm'));
const SaleDetails = lazy(() => import('./pages/sales/SaleDetails'));
const Customers = lazy(() => import('./pages/Customers'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const Repairs = lazy(() => import('./pages/repairs/Repairs'));
const RepairForm = lazy(() => import('./pages/repairs/RepairForm'));
const PublicRepair = lazy(() => import('./pages/PublicRepair'));
const FollowUps = lazy(() => import('./pages/FollowUps'));
const Loans = lazy(() => import('./pages/loans/Loans'));
const LoanForm = lazy(() => import('./pages/loans/LoanForm'));
const Recharge = lazy(() => import('./pages/Recharge'));
const SimCards = lazy(() => import('./pages/SimCards'));
const OldMobiles = lazy(() => import('./pages/OldMobiles'));
const OldMobilePurchaseForm = lazy(() => import('./pages/OldMobilePurchaseForm'));
const OldMobileStocks = lazy(() => import('./pages/OldMobileStocks'));
const OldMobileSales = lazy(() => import('./pages/OldMobileSales'));
const OldMobileExchangeReport = lazy(() => import('./pages/reports/OldMobileExchangeReport'));
const Gifts = lazy(() => import('./pages/Gifts'));
const Employees = lazy(() => import('./pages/Employees'));
const Incentives = lazy(() => import('./pages/Incentives'));
const CompanyOffers = lazy(() => import('./pages/CompanyOffers'));
const SendOffers = lazy(() => import('./pages/SendOffers'));
const Users = lazy(() => import('./pages/admin/Users'));
const Shops = lazy(() => import('./pages/admin/Shops'));
const ActivityLogs = lazy(() => import('./pages/admin/ActivityLogs'));
const TrashManager = lazy(() => import('./pages/admin/TrashManager'));
const Reports = lazy(() => import('./pages/reports/Reports'));
const SalesReport = lazy(() => import('./pages/reports/SalesReport'));
const CombinedSalesReport = lazy(() => import('./pages/reports/CombinedSalesReport'));
const SetSalesMatrix = lazy(() => import('./pages/reports/SetSalesMatrix'));
const ProfitReport = lazy(() => import('./pages/reports/ProfitReport'));
const DiscountReport = lazy(() => import('./pages/reports/DiscountReport'));
const StockReport = lazy(() => import('./pages/reports/StockReport'));
const LoanReport = lazy(() => import('./pages/reports/LoanReport'));
const BusinessSummaryReport = lazy(() => import('./pages/reports/BusinessSummaryReport'));
const StockEntry = lazy(() => import('./pages/StockEntry'));
const StockTransfers = lazy(() => import('./pages/stock/StockTransfers'));
const ClosingStockDetail = lazy(() => import('./pages/stock/ClosingStockDetail'));
const AirtelRetailers = lazy(() => import('./pages/airtel/AirtelRetailers'));
const AirtelDrops = lazy(() => import('./pages/airtel/AirtelDrops'));
const RecoveryDashboard = lazy(() => import('./pages/airtel/RecoveryDashboard'));
const QuickRecovery = lazy(() => import('./pages/airtel/QuickRecovery'));
const AirtelReports = lazy(() => import('./pages/airtel/AirtelReports'));
const RetailerProfile = lazy(() => import('./pages/airtel/RetailerProfile'));
const PublicRetailerProfile = lazy(() => import('./pages/airtel/PublicRetailerProfile'));

const EntityLedger = lazy(() => import('./pages/accounts/EntityLedger'));
const EntityManager = lazy(() => import('./pages/accounts/EntityManager'));
const BankBalances = lazy(() => import('./pages/accounts/BankBalances'));
const PromiseToPay = lazy(() => import('./pages/accounts/PromiseToPay'));
const Overheads = lazy(() => import('./pages/accounts/Overheads'));
const ExpenseCategories = lazy(() => import('./pages/accounts/ExpenseCategories'));
const Daybook = lazy(() => import('./pages/accounts/Daybook'));
const GroupSummary = lazy(() => import('./pages/accounts/GroupSummary'));
const GroupDetails = lazy(() => import('./pages/accounts/GroupDetails'));
const TradeGroupSummary = lazy(() => import('./pages/accounts/TradeGroupSummary'));
const WhatsAppConfig = lazy(() => import('./pages/admin/WhatsAppConfig'));
const ManualNotifications = lazy(() => import('./pages/admin/ManualNotifications'));
const Tasks = lazy(() => import('./pages/tasks/Tasks'));
const TaskForm = lazy(() => import('./pages/tasks/TaskForm'));
const TaskDetail = lazy(() => import('./pages/tasks/TaskDetail'));
const FinanceTracker = lazy(() => import('./pages/finance/FinanceTracker'));
const FinancerReport = lazy(() => import('./pages/reports/FinancerReport'));
const RolePermissions = lazy(() => import('./pages/admin/RolePermissions'));
const SecuritySettings = lazy(() => import('./pages/admin/SecuritySettings'));

const CustomerLogin = lazy(() => import('./pages/customer/CustomerLogin'));
const CustomerProfile = lazy(() => import('./pages/customer/CustomerProfile'));

function Loading() {
  return (
    <div className="d-flex justify-content-center align-items-center" style={{height:'100vh'}}>
      <div className="spinner-border text-primary"/>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  return user ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />
        <Route path="/repair" element={<PublicRepair />} />
        <Route path="/r/:msisdn" element={<PublicRetailerProfile />} />
        <Route path="/customer/login" element={<CustomerLogin />} />
        <Route path="/customer/profile/:id" element={<CustomerProfile />} />

        {/* Protected */}
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="pending-balance" element={<PendingBalance />} />
          <Route path="products" element={<Products />} />
          <Route path="products/new" element={<ProductForm />} />
          <Route path="products/:id/edit" element={<ProductForm />} />
          <Route path="stickers/generate" element={<GenerateStickers />} />
          <Route path="stickers/prices" element={<StickerPrices />} />
          <Route path="stickers/print" element={<StickerPrint />} />
          <Route path="purchases" element={<Purchases />} />
          <Route path="purchases/new" element={<PurchaseForm />} />
          <Route path="purchases/new-master" element={<MasterPurchaseForm />} />
          <Route path="purchases/:id/edit" element={<PurchaseForm />} />
          <Route path="purchases/:id/edit-master" element={<MasterPurchaseForm />} />
          <Route path="purchases/:id" element={<PurchaseDetails />} />
          <Route path="sales" element={<Sales />} />
          <Route path="sales/new" element={<SaleForm />} />
          <Route path="sales/new-master" element={<MasterSaleForm />} />
          <Route path="sales/:id/edit" element={<SaleForm />} />
          <Route path="sales/:id/edit-master" element={<MasterSaleForm />} />
          <Route path="sales/:id" element={<SaleDetails />} />
          <Route path="customers" element={<Customers />} />
          <Route path="suppliers" element={<Suppliers />} />
          <Route path="repairs" element={<Repairs />} />
          <Route path="repairs/new" element={<RepairForm />} />
          <Route path="repairs/:id/edit" element={<RepairForm />} />
          <Route path="follow-ups" element={<FollowUps />} />
          <Route path="loans" element={<Loans />} />
          <Route path="loans/new" element={<LoanForm />} />
          <Route path="recharge" element={<Recharge />} />
          <Route path="sim-cards" element={<SimCards />} />
          <Route path="old-mobiles" element={<OldMobiles />} />
          <Route path="old-mobiles/new" element={<OldMobilePurchaseForm />} />
          <Route path="old-mobiles/stocks" element={<OldMobileStocks />} />
          <Route path="old-mobiles/sales" element={<OldMobileSales />} />
          <Route path="old-mobiles/sales/new" element={<SaleForm />} />
          <Route path="old-mobiles/sales/:id/edit" element={<SaleForm />} />
          <Route path="old-mobiles/report" element={<OldMobileExchangeReport />} />
          <Route path="gifts" element={<Gifts />} />
          <Route path="stock-entry" element={<StockEntry />} />
          <Route path="stock-entry/closing-stock" element={<ClosingStockDetail />} />
          <Route path="stock-transfers" element={<StockTransfers />} />
          <Route path="employees" element={<Employees />} />
          <Route path="incentives" element={<Incentives />} />
          <Route path="offers" element={<CompanyOffers />} />
          <Route path="send-offers" element={<SendOffers />} />
          <Route path="admin/users" element={<Users />} />
          <Route path="admin/shops" element={<Shops />} />
          <Route path="admin/role-permissions" element={<RolePermissions />} />
          <Route path="admin/security-settings" element={<SecuritySettings />} />
          <Route path="admin/activity-logs" element={<ActivityLogs />} />
          <Route path="admin/trash" element={<TrashManager />} />
          <Route path="reports" element={<Reports />} />
          <Route path="reports/sales" element={<SalesReport />} />
          <Route path="reports/combined-sales" element={<CombinedSalesReport />} />
          <Route path="reports/set-sales-matrix" element={<SetSalesMatrix />} />
          <Route path="reports/profit" element={<ProfitReport />} />
          <Route path="reports/discounts" element={<DiscountReport />} />
          <Route path="reports/stock" element={<StockReport />} />
          <Route path="reports/loans" element={<LoanReport />} />
          <Route path="reports/business-summary" element={<BusinessSummaryReport />} />
          {/* Airtel Recovery */}
          <Route path="airtel/retailers" element={<AirtelRetailers />} />
          <Route path="airtel/quick-recovery" element={<QuickRecovery />} />
          <Route path="airtel/retailers/:id" element={<RetailerProfile />} />
          <Route path="airtel/drops" element={<AirtelDrops />} />
          <Route path="airtel/recovery" element={<RecoveryDashboard />} />
          <Route path="airtel/reports" element={<AirtelReports />} />
          {/* Accounts */}
          <Route path="accounts/entity-manager" element={<EntityManager />} />
          <Route path="accounts/entity-ledger" element={<EntityLedger />} />
          <Route path="accounts/bank-balances" element={<BankBalances />} />
          <Route path="accounts/promise-to-pay" element={<PromiseToPay />} />
          <Route path="accounts/overheads" element={<Overheads />} />
          <Route path="accounts/expense-categories" element={<ExpenseCategories />} />
          <Route path="accounts/daybook" element={<Daybook />} />
          <Route path="accounts/group-summary" element={<GroupSummary />} />
          <Route path="accounts/group-details" element={<GroupDetails />} />
          <Route path="accounts/trade-summary" element={<TradeGroupSummary />} />
          <Route path="admin/whatsapp-config" element={<WhatsAppConfig />} />
          <Route path="admin/notifications" element={<ManualNotifications />} />

          {/* Finance Tracker */}
          <Route path="finance-tracker" element={<FinanceTracker />} />
          {/* Financer Report */}
          <Route path="reports/financer" element={<FinancerReport />} />

          {/* Tasks */}
          <Route path="tasks" element={<PermissionRoute permission="view_tasks"><Tasks /></PermissionRoute>} />
          <Route path="tasks/new" element={<PermissionRoute permission="assign_tasks"><TaskForm /></PermissionRoute>} />
          <Route path="tasks/:id" element={<PermissionRoute permission="view_tasks"><TaskDetail /></PermissionRoute>} />

          <Route path="customer/login" element={<CustomerLogin />} />
          <Route path="customer/profile/:id" element={<CustomerProfile />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <ToastContainer position="top-right" autoClose={3000} />
        <PinModal />
      </BrowserRouter>
    </AuthProvider>
  );
}
