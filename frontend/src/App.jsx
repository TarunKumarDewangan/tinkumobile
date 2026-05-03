import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';

// Pages
const Login = lazy(() => import('./pages/auth/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Products = lazy(() => import('./pages/products/Products'));
const ProductForm = lazy(() => import('./pages/products/ProductForm'));
const Purchases = lazy(() => import('./pages/purchases/Purchases'));
const PurchaseForm = lazy(() => import('./pages/purchases/PurchaseForm'));
const PurchaseDetails = lazy(() => import('./pages/purchases/PurchaseDetails'));
const Sales = lazy(() => import('./pages/sales/Sales'));
const SaleForm = lazy(() => import('./pages/sales/SaleForm'));
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
const Gifts = lazy(() => import('./pages/Gifts'));
const Employees = lazy(() => import('./pages/Employees'));
const Incentives = lazy(() => import('./pages/Incentives'));
const CompanyOffers = lazy(() => import('./pages/CompanyOffers'));
const Users = lazy(() => import('./pages/admin/Users'));
const Shops = lazy(() => import('./pages/admin/Shops'));
const ActivityLogs = lazy(() => import('./pages/admin/ActivityLogs'));
const TrashManager = lazy(() => import('./pages/admin/TrashManager'));
const Reports = lazy(() => import('./pages/reports/Reports'));
const SalesReport = lazy(() => import('./pages/reports/SalesReport'));
const ProfitReport = lazy(() => import('./pages/reports/ProfitReport'));
const StockReport = lazy(() => import('./pages/reports/StockReport'));
const LoanReport = lazy(() => import('./pages/reports/LoanReport'));
const StockEntry = lazy(() => import('./pages/StockEntry'));
const AirtelRetailers = lazy(() => import('./pages/airtel/AirtelRetailers'));
const AirtelDrops = lazy(() => import('./pages/airtel/AirtelDrops'));
const RecoveryDashboard = lazy(() => import('./pages/airtel/RecoveryDashboard'));
const QuickRecovery = lazy(() => import('./pages/airtel/QuickRecovery'));
const AirtelReports = lazy(() => import('./pages/airtel/AirtelReports'));
const RetailerProfile = lazy(() => import('./pages/airtel/RetailerProfile'));
const PublicRetailerProfile = lazy(() => import('./pages/airtel/PublicRetailerProfile'));

const EntityLedger = lazy(() => import('./pages/accounts/EntityLedger'));
const EntityManager = lazy(() => import('./pages/accounts/EntityManager'));
const Daybook = lazy(() => import('./pages/accounts/Daybook'));

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
          <Route path="products" element={<Products />} />
          <Route path="products/new" element={<ProductForm />} />
          <Route path="products/:id/edit" element={<ProductForm />} />
          <Route path="purchases" element={<Purchases />} />
          <Route path="purchases/new" element={<PurchaseForm />} />
          <Route path="purchases/:id/edit" element={<PurchaseForm />} />
          <Route path="purchases/:id" element={<PurchaseDetails />} />
          <Route path="sales" element={<Sales />} />
          <Route path="sales/new" element={<SaleForm />} />
          <Route path="sales/:id/edit" element={<SaleForm />} />
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
          <Route path="gifts" element={<Gifts />} />
          <Route path="stock-entry" element={<StockEntry />} />
          <Route path="employees" element={<Employees />} />
          <Route path="incentives" element={<Incentives />} />
          <Route path="offers" element={<CompanyOffers />} />
          <Route path="admin/users" element={<Users />} />
          <Route path="admin/shops" element={<Shops />} />
          <Route path="admin/activity-logs" element={<ActivityLogs />} />
          <Route path="admin/trash" element={<TrashManager />} />
          <Route path="reports" element={<Reports />} />
          <Route path="reports/sales" element={<SalesReport />} />
          <Route path="reports/profit" element={<ProfitReport />} />
          <Route path="reports/stock" element={<StockReport />} />
          <Route path="reports/loans" element={<LoanReport />} />
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
          <Route path="accounts/daybook" element={<Daybook />} />

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
      </BrowserRouter>
    </AuthProvider>
  );
}
