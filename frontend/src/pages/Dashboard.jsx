import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/axios';
import DataBackupModal from '../components/DataBackupModal';

export default function Dashboard() {
  const { user, isOwner, can, hasFullAccess } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSyncModal, setShowSyncModal] = useState(false);

  useEffect(() => {
    api.get('/reports/dashboard').then(r => setStats(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-5"><div className="spinner-border text-primary" /></div>;

  const shopLabel = hasFullAccess() ? 'All Shops' : user?.shop?.name;

  const quickActions = [
    { to: '/airtel/quick-recovery', label: '⚡ Quick Recovery', perm: 'view_airtel_recovery', variant: 'success' },
    { to: '/sales/new', label: '+ New Sale', perm: 'view_sales', variant: 'primary' },
    { to: '/purchases/new', label: '+ New Purchase', perm: 'view_purchases', variant: 'outline-primary' },
    { to: '/repairs/new', label: '+ New Repair', perm: 'view_repairs', variant: 'outline-secondary' },
    { to: '/customers', label: '👥 Customers', perm: 'view_customers', variant: 'outline-secondary' },
  ].filter(a => !a.perm || can(a.perm));

  return (
    <div>
      <div className="page-header d-block mb-4">
        <h2 className="mb-1 fw-black">✨ Dashboard</h2>
        <div className="d-flex align-items-center gap-2">
            <span className="badge bg-primary bg-opacity-10 text-primary px-3 py-2 rounded-pill small fw-bold">
                🏢 {shopLabel}
            </span>
            <span className="text-muted small italic">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
        </div>
      </div>

      <div className="row g-4 mb-4">
        <div className="col-md-3 col-6">
          <div className="stat-card glass-card h-100 border-0 shadow-sm" style={{ background: 'linear-gradient(135deg, #6c3fc5, #8b5cf6)', color: 'white' }}>
            <div className="stat-label text-white opacity-75">Today's Sales</div>
            <div className="stat-value text-white">{stats?.today_sales ?? 0}</div>
            <div className="stat-icon">🧾</div>
          </div>
        </div>
        <div className="col-md-3 col-6">
          <div className="stat-card glass-card h-100 border-0 shadow-sm" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white' }}>
            <div className="stat-label text-white opacity-75">Today's Revenue</div>
            <div className="stat-value text-white">₹{Number(stats?.today_revenue ?? 0).toLocaleString('en-IN')}</div>
            <div className="stat-icon">💰</div>
          </div>
        </div>
        <div className="col-md-3 col-6">
          <div className="stat-card glass-card h-100 border-0 shadow-sm" style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white' }}>
            <div className="stat-label text-white opacity-75">Low Stock Items</div>
            <div className="stat-value text-white">{stats?.low_stock_items ?? 0}</div>
            <div className="stat-icon">📦</div>
          </div>
        </div>
        <div className="col-md-3 col-6">
          <div className="stat-card glass-card h-100 border-0 shadow-sm" style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: 'white' }}>
            <div className="stat-label text-white opacity-75">Pending Repairs</div>
            <div className="stat-value text-white">{stats?.pending_repairs ?? 0}</div>
            <div className="stat-icon">🔧</div>
          </div>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-md-8">
            <div className="row g-4">
                <div className="col-md-6">
                    <div className="glass-card p-4 h-100 border-0 bg-white">
                        <div className="d-flex justify-content-between align-items-center mb-4">
                            <h5 className="mb-0 fw-bold small text-muted text-uppercase letter-spacing-1">📅 Follow-ups</h5>
                            <span className="badge bg-info bg-opacity-10 text-info rounded-pill">{stats?.pending_followups ?? 0} Today</span>
                        </div>
                        <div className="stat-value fs-2 mb-3">{stats?.pending_followups ?? 0}</div>
                        <Link to="/follow-ups" className="btn btn-primary btn-sm rounded-pill px-4">View All</Link>
                    </div>
                </div>
                <div className="col-md-6">
                    <div className="glass-card p-4 h-100 border-0 bg-white">
                        <div className="d-flex justify-content-between align-items-center mb-4">
                            <h5 className="mb-0 fw-bold small text-muted text-uppercase letter-spacing-1">⚠️ Overdue</h5>
                            <span className="badge bg-danger bg-opacity-10 text-danger rounded-pill">{stats?.overdue_repairs ?? 0} Late</span>
                        </div>
                        <div className="stat-value fs-2 mb-3">{stats?.overdue_repairs ?? 0}</div>
                        <Link to="/repairs?status=overdue" className="btn btn-outline-danger btn-sm rounded-pill px-4">Manage Repairs</Link>
                    </div>
                </div>
            </div>
        </div>
        
        <div className="col-md-4">
          <div className="glass-card p-4 h-100 border-0 bg-white shadow-sm">
            <div className="fw-bold mb-4 small text-muted text-uppercase letter-spacing-1">⚡ Quick Actions</div>
            <div className="d-grid gap-3">
              {quickActions.map(action => (
                <Link key={action.to} to={action.to} className={`btn btn-${action.variant} btn-md rounded-pill shadow-sm py-2 text-uppercase fw-bold x-small d-flex align-items-center justify-content-center gap-2`}>
                  {action.label}
                </Link>
              ))}
              {hasFullAccess() && (
                <button onClick={() => setShowSyncModal(true)} className="btn btn-dark btn-md rounded-pill shadow-sm py-2 text-uppercase fw-bold x-small d-flex align-items-center justify-content-center gap-2">
                  🔄 FULL SYSTEM SYNC
                </button>
              )}
              {quickActions.length === 0 && <div className="text-muted small italic">No actions available</div>}
            </div>
          </div>
        </div>
      </div>

      <DataBackupModal 
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
        onRefresh={() => window.location.reload()}
        title="Full System Sync (Master)"
        endpoint="/system"
        typeLabel="Entire System"
      />
    </div>
  );
}
