import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/axios';

export default function Dashboard() {
  const { user, isOwner } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/reports/dashboard').then(r => setStats(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-5"><div className="spinner-border text-primary" /></div>;

  const shopLabel = isOwner() ? 'All Shops' : user?.shop?.name;

  return (
    <div>
      <div className="page-header">
        <h2>📊 Dashboard <span className="text-muted fs-6 fw-normal ms-2">— {shopLabel}</span></h2>
        <div className="text-muted" style={{ fontSize: '0.85rem' }}>{new Date().toLocaleDateString('en-GB')}</div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-md-3 col-6">
          <div className="stat-card">
            <div className="stat-label">Today's Sales</div>
            <div className="stat-value">{stats?.today_sales ?? 0}</div>
            <div className="stat-icon">🧾</div>
          </div>
        </div>
        <div className="col-md-3 col-6">
          <div className="stat-card orange">
            <div className="stat-label">Today's Revenue</div>
            <div className="stat-value">₹{Number(stats?.today_revenue ?? 0).toLocaleString('en-IN')}</div>
            <div className="stat-icon">💰</div>
          </div>
        </div>
        <div className="col-md-3 col-6">
          <div className="stat-card green">
            <div className="stat-label">Low Stock Items</div>
            <div className="stat-value">{stats?.low_stock_items ?? 0}</div>
            <div className="stat-icon">📦</div>
          </div>
        </div>
        <div className="col-md-3 col-6">
          <div className="stat-card" style={{ background: 'linear-gradient(135deg,#ea5455,#c62030)' }}>
            <div className="stat-label">Pending Repairs</div>
            <div className="stat-value">{stats?.pending_repairs ?? 0}</div>
            <div className="stat-icon">🔧</div>
          </div>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-md-4">
          <div className="stat-card" style={{ background:'linear-gradient(135deg,#667eea,#764ba2)' }}>
            <div className="stat-label">Today's Follow-ups</div>
            <div className="stat-value">{stats?.pending_followups ?? 0}</div>
            <div className="stat-icon">📅</div>
            <Link to="/follow-ups" className="btn btn-sm btn-light mt-2">View all</Link>
          </div>
        </div>
        <div className="col-md-4">
          <div className="stat-card" style={{ background:'linear-gradient(135deg,#f093fb,#f5576c)' }}>
            <div className="stat-label">Overdue Repairs</div>
            <div className="stat-value">{stats?.overdue_repairs ?? 0}</div>
            <div className="stat-icon">⚠️</div>
            <Link to="/repairs?status=overdue" className="btn btn-sm btn-light mt-2">View all</Link>
          </div>
        </div>
        <div className="col-md-4">
          <div className="table-card p-4 h-100 d-flex flex-column justify-content-between">
            <div className="fw-semibold mb-3">⚡ Quick Actions</div>
            <Link to="/sales/new" className="btn btn-primary btn-sm mb-2 w-100">+ New Sale</Link>
            <Link to="/purchases/new" className="btn btn-outline-primary btn-sm mb-2 w-100">+ New Purchase</Link>
            <Link to="/repairs/new" className="btn btn-outline-secondary btn-sm mb-2 w-100">+ New Repair</Link>
            <Link to="/customers" className="btn btn-outline-secondary btn-sm w-100">👥 Customers</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
