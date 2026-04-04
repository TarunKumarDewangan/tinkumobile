import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './pages/auth/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/products/Products';
import ProductForm from './pages/products/ProductForm';
import Purchases from './pages/purchases/Purchases';
import PurchaseForm from './pages/purchases/PurchaseForm';
import PurchaseDetails from './pages/purchases/PurchaseDetails';
import Sales from './pages/sales/Sales';
import SaleForm from './pages/sales/SaleForm';
import SaleDetails from './pages/sales/SaleDetails';
import Customers from './pages/Customers';
import Suppliers from './pages/Suppliers';
import Repairs from './pages/repairs/Repairs';
import RepairForm from './pages/repairs/RepairForm';
import PublicRepair from './pages/PublicRepair';
import FollowUps from './pages/FollowUps';
import Loans from './pages/loans/Loans';
import LoanForm from './pages/loans/LoanForm';
import Recharge from './pages/Recharge';
import SimCards from './pages/SimCards';
import OldMobiles from './pages/OldMobiles';
import Gifts from './pages/Gifts';
import Employees from './pages/Employees';
import Incentives from './pages/Incentives';
import CompanyOffers from './pages/CompanyOffers';
import Users from './pages/admin/Users';
import Shops from './pages/admin/Shops';
import Reports from './pages/reports/Reports';
import SalesReport from './pages/reports/SalesReport';
import ProfitReport from './pages/reports/ProfitReport';
import StockReport from './pages/reports/StockReport';
import LoanReport from './pages/reports/LoanReport';
import StockEntry from './pages/StockEntry';
import AirtelRetailers from './pages/airtel/AirtelRetailers';
import AirtelDrops from './pages/airtel/AirtelDrops';
import RecoveryDashboard from './pages/airtel/RecoveryDashboard';
import AirtelReports from './pages/airtel/AirtelReports';
import RetailerProfile from './pages/airtel/RetailerProfile';
import PublicRetailerProfile from './pages/airtel/PublicRetailerProfile';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="d-flex justify-content-center align-items-center" style={{height:'100vh'}}><div className="spinner-border text-primary"/></div>;
  return user ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<Login />} />
      <Route path="/repair" element={<PublicRepair />} />
      <Route path="/r/:msisdn" element={<PublicRetailerProfile />} />

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
        <Route path="reports" element={<Reports />} />
        <Route path="reports/sales" element={<SalesReport />} />
        <Route path="reports/profit" element={<ProfitReport />} />
        <Route path="reports/stock" element={<StockReport />} />
        <Route path="reports/loans" element={<LoanReport />} />
        {/* Airtel Recovery */}
        <Route path="airtel/retailers" element={<AirtelRetailers />} />
        <Route path="airtel/retailers/:id" element={<RetailerProfile />} />
        <Route path="airtel/drops" element={<AirtelDrops />} />
        <Route path="airtel/recovery" element={<RecoveryDashboard />} />
        <Route path="airtel/reports" element={<AirtelReports />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
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
