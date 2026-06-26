import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/axios';
import DataBackupModal from '../components/DataBackupModal';
import CloudSyncModal from '../components/CloudSyncModal';

export default function Dashboard() {
  const { user, isOwner, can, hasFullAccess } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showCloudSyncModal, setShowCloudSyncModal] = useState(false);
  const [myTasks, setMyTasks] = useState([]);
  const [teamTasks, setTeamTasks] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    api.get('/reports/dashboard').then(r => setStats(r.data)).catch(() => {}).finally(() => setLoading(false));

    // Fetch my pending tasks
    api.get('/tasks', { params: { status: 'pending', per_page: 5 } })
      .then(r => setMyTasks(r.data.data || r.data || []))
      .catch(() => {});

    // Fetch team task overview (manager/owner only)
    if (can('assign_tasks') || hasFullAccess()) {
      api.get('/tasks', { params: { per_page: 5 } })
        .then(r => setTeamTasks(r.data.data || r.data || []))
        .catch(() => {});
    }
  }, [refreshKey]);

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

      {/* ── Task Widgets ── */}
      <div className="row g-4 mb-4">
        <div className="col-md-6">
          <div className="glass-card p-4 h-100 border-0 bg-white">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="mb-0 fw-bold small text-muted text-uppercase letter-spacing-1">✅ My Pending Tasks</h5>
              <Link to="/tasks" className="btn btn-sm btn-outline-primary rounded-pill" style={{fontSize:'.72rem'}}>View All</Link>
            </div>
            {myTasks.length === 0 ? (
              <div className="text-muted text-center py-3" style={{fontSize:'.82rem'}}>No pending tasks</div>
            ) : (
              <div>
                {myTasks.map(task => (
                  <Link key={task.id} to={`/tasks/${task.id}`} style={{textDecoration:'none',color:'inherit'}}>
                    <div className="d-flex justify-content-between align-items-center py-2 border-bottom" style={{borderColor:'#f1f5f9'}}>
                      <div>
                        <div style={{fontWeight:600,fontSize:'.82rem'}}>{task.title}</div>
                        <div className="text-muted" style={{fontSize:'.72rem'}}>
                          {task.assigned_by?.name && <>From: {task.assigned_by.name}</>}
                          {task.due_date && <> · Due: {new Date(task.due_date).toLocaleDateString()}</>}
                        </div>
                      </div>
                      <span className="badge" style={{background:'#fef3c7',color:'#92400e',fontSize:'.68rem'}}>{task.priority}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
        {(can('assign_tasks') || hasFullAccess()) && (
          <div className="col-md-6">
            <div className="glass-card p-4 h-100 border-0 bg-white">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="mb-0 fw-bold small text-muted text-uppercase letter-spacing-1">👥 Team Tasks</h5>
                <Link to="/tasks" className="btn btn-sm btn-outline-primary rounded-pill" style={{fontSize:'.72rem'}}>Manage</Link>
              </div>
              {teamTasks.length === 0 ? (
                <div className="text-muted text-center py-3" style={{fontSize:'.82rem'}}>No team tasks</div>
              ) : (
                <div>
                  {teamTasks.map(task => (
                    <Link key={task.id} to={`/tasks/${task.id}`} style={{textDecoration:'none',color:'inherit'}}>
                      <div className="d-flex justify-content-between align-items-center py-2 border-bottom" style={{borderColor:'#f1f5f9'}}>
                        <div>
                          <div style={{fontWeight:600,fontSize:'.82rem'}}>{task.title}</div>
                          <div className="text-muted" style={{fontSize:'.72rem'}}>
                            {task.assigned_to?.name && <>Assigned to: {task.assigned_to.name}</>}
                          </div>
                        </div>
                        <span className="badge" style={{
                          background: task.status === 'completed' ? '#d1fae5' : task.status === 'in_progress' ? '#dbeafe' : '#fef3c7',
                          color: task.status === 'completed' ? '#065f46' : task.status === 'in_progress' ? '#1e40af' : '#92400e',
                          fontSize: '.68rem'
                        }}>
                          {task.status === 'in_progress' ? 'In Progress' : task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
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
                <>
                  <button onClick={() => setShowCloudSyncModal(true)} disabled={showCloudSyncModal || showSyncModal} className="btn btn-primary btn-md rounded-pill shadow-sm py-2 text-uppercase fw-bold x-small d-flex align-items-center justify-content-center gap-2">
                    ☁️ CLOUD SYNC
                  </button>
                  <button onClick={() => setShowSyncModal(true)} disabled={showCloudSyncModal || showSyncModal} className="btn btn-dark btn-md rounded-pill shadow-sm py-2 text-uppercase fw-bold x-small d-flex align-items-center justify-content-center gap-2">
                    💾 LOCAL BACKUP
                  </button>
                </>
              )}
              {quickActions.length === 0 && <div className="text-muted small italic">No actions available</div>}
            </div>
          </div>
        </div>
      </div>

      <DataBackupModal 
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
        onRefresh={() => setRefreshKey(k => k + 1)}
        title="Full System Sync (Master)"
        endpoint="/system"
        typeLabel="Entire System"
      />

      <CloudSyncModal
        isOpen={showCloudSyncModal}
        onClose={() => setShowCloudSyncModal(false)}
        onRefresh={() => setRefreshKey(k => k + 1)}
      />
    </div>
  );
}
