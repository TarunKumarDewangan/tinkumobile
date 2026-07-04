import { useState, useEffect, useCallback } from 'react';
import axios from '../../api/axios';
import { toast } from 'react-toastify';
import { useAuth } from '../../contexts/AuthContext';
import pinGate from '../../utils/pinGate';

const MODULE_OPTIONS = [
  { value: '', label: 'ALL MODULES' },
  { value: 'SaleInvoice', label: 'Sales' },
  { value: 'PurchaseInvoice', label: 'Purchases' },
  { value: 'Product', label: 'Products' },
  { value: 'Customer', label: 'Customers' },
  { value: 'Employee', label: 'Employees' },
  { value: 'User', label: 'Users' },
  { value: 'OldMobilePurchase', label: 'Old Mobiles' },
  { value: 'StockAdjustment', label: 'Stock' },
  { value: 'RepairRequest', label: 'Repairs' },
  { value: 'Task', label: 'Tasks' },
  { value: 'AirtelRetailer', label: 'Airtel' },
  { value: 'Loan', label: 'Finance / Loans' },
];

const MODULE_LABEL_MAP = {
  SaleInvoice: 'Sales',
  PurchaseInvoice: 'Purchases',
  Product: 'Products',
  Customer: 'Customers',
  Employee: 'Employees',
  User: 'Users',
  OldMobilePurchase: 'Old Mobiles',
  StockAdjustment: 'Stock',
  RepairRequest: 'Repairs',
  Task: 'Tasks',
  AirtelRetailer: 'Airtel',
  AirtelDrop: 'Airtel Drops',
  Loan: 'Finance',
};

function getModuleLabel(modelType) {
  if (!modelType) return 'System';
  const cls = modelType.split('\\').pop();
  return MODULE_LABEL_MAP[cls] || cls;
}

function getActionBadge(action) {
  if (action.includes('DELETE') || action.includes('CLEAR') || action.includes('CANCEL') || action.includes('RESET'))
    return 'danger';
  if (action.includes('CREATE') || action.includes('CREATED') || action.includes('ADD') || action.includes('PURCHASED') || action.includes('LOGIN'))
    return 'success';
  if (action.includes('UPDATE') || action.includes('UPDATED') || action.includes('CHANGE') || action.includes('RESTORE'))
    return 'primary';
  if (action.includes('LOGOUT') || action.includes('STATUS'))
    return 'secondary';
  return 'dark';
}

export default function ActivityLogs() {
  const { hasFullAccess } = useAuth();
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);

  const [filters, setFilters] = useState({
    user_id: '',
    action: '',
    model_type: '',
    from_date: '',
    to_date: '',
    page: 1,
  });

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      const { data } = await axios.get('/activity-logs', { params });
      setLogs(data.data);
      setPagination(data);
    } catch {
      toast.error('Failed to fetch activity logs');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  useEffect(() => {
    axios.get('/users').then(r => setUsers(r.data.data || r.data)).catch(() => {});
  }, []);

  const setFilter = (key, value) => setFilters(f => ({ ...f, [key]: value, page: 1 }));
  const resetFilters = () => setFilters({ user_id: '', action: '', model_type: '', from_date: '', to_date: '', page: 1 });

  const handleDeleteLog = async (id) => {
    if (!await pinGate.confirm()) return;
    try {
      await axios.delete(`/activity-logs/${id}`);
      toast.success('Log entry deleted');
      fetchLogs();
    } catch {
      toast.error('Failed to delete log entry');
    }
  };

  const handleClearLogs = async () => {
    if (!await pinGate.confirm()) return;
    try {
      const params = {};
      if (filters.from_date) params.from_date = filters.from_date;
      if (filters.to_date) params.to_date = filters.to_date;
      const { data } = await axios.delete('/activity-logs/clear', { params });
      toast.success(data.message || 'Logs cleared');
      fetchLogs();
    } catch {
      toast.error('Failed to clear logs');
    }
  };

  if (!hasFullAccess()) {
    return (
      <div className="container py-5 text-center">
        <div className="alert alert-danger fw-bold">⛔ ADMIN ACCESS ONLY</div>
      </div>
    );
  }

  const hasDateFilter = filters.from_date && filters.to_date;

  return (
    <div className="container-fluid py-3 text-uppercase">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h2 className="fw-bold mb-0">📋 ACTIVITY LOGS</h2>
          {pagination && (
            <div className="small text-muted fw-bold mt-1">
              {pagination.total?.toLocaleString()} TOTAL ENTRIES
            </div>
          )}
        </div>
        <button className="btn btn-danger fw-bold shadow-sm" onClick={handleClearLogs}>
          🗑️ CLEAR {hasDateFilter ? 'FILTERED' : 'ALL'} LOGS
        </button>
      </div>

      {/* Filters */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body py-3">
          <div className="row g-2 align-items-end">
            <div className="col-6 col-md-2">
              <label className="form-label x-small fw-bold text-muted mb-1">USER</label>
              <select className="form-select form-select-sm" value={filters.user_id} onChange={e => setFilter('user_id', e.target.value)}>
                <option value="">ALL USERS</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label x-small fw-bold text-muted mb-1">ACTION</label>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="e.g. SALE, DELETE…"
                value={filters.action}
                onChange={e => setFilter('action', e.target.value)}
              />
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label x-small fw-bold text-muted mb-1">MODULE</label>
              <select className="form-select form-select-sm" value={filters.model_type} onChange={e => setFilter('model_type', e.target.value)}>
                {MODULE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label x-small fw-bold text-muted mb-1">FROM</label>
              <input type="date" className="form-control form-control-sm" value={filters.from_date} onChange={e => setFilter('from_date', e.target.value)} />
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label x-small fw-bold text-muted mb-1">TO</label>
              <input type="date" className="form-control form-control-sm" value={filters.to_date} onChange={e => setFilter('to_date', e.target.value)} />
            </div>
            <div className="col-6 col-md-2">
              <button className="btn btn-outline-secondary btn-sm w-100 fw-bold" onClick={resetFilters}>↺ RESET</button>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card border-0 shadow-sm">
        <div className="table-responsive" style={{ minHeight: '300px' }}>
          <table className="table table-hover align-middle mb-0 text-uppercase">
            <thead className="bg-dark text-white" style={{ fontSize: '0.72rem' }}>
              <tr>
                <th className="ps-3 py-3" style={{ width: '160px' }}>TIMESTAMP</th>
                <th style={{ width: '130px' }}>USER</th>
                <th style={{ width: '160px' }}>ACTION</th>
                <th style={{ width: '100px' }}>MODULE</th>
                <th>DESCRIPTION</th>
                <th style={{ width: '60px' }}>IP</th>
                <th style={{ width: '40px' }}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-5">
                    <div className="spinner-border text-primary" />
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-5 text-muted fw-bold">
                    NO ACTIVITY LOGS FOUND
                  </td>
                </tr>
              ) : logs.map(log => (
                <tr key={log.id}>
                  <td className="ps-3">
                    <div className="small fw-bold text-dark">
                      {new Date(log.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                    <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                      {new Date(log.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>
                  </td>
                  <td>
                    <div className="small fw-bold">{log.user?.name || '—'}</div>
                    <div className="text-muted" style={{ fontSize: '0.7rem' }}>
                      {log.user?.roles?.[0]?.name?.toUpperCase() || 'SYSTEM'}
                    </div>
                  </td>
                  <td>
                    <span
                      className={`badge bg-${getActionBadge(log.action)}`}
                      style={{ fontSize: '0.68rem', wordBreak: 'break-word', whiteSpace: 'normal', maxWidth: '155px' }}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td>
                    <span className="badge bg-secondary-subtle text-dark border" style={{ fontSize: '0.7rem' }}>
                      {getModuleLabel(log.model_type)}
                    </span>
                    {log.model_id && (
                      <div className="text-muted" style={{ fontSize: '0.68rem' }}>ID: {log.model_id}</div>
                    )}
                  </td>
                  <td className="small fw-bold" style={{ maxWidth: '320px', wordBreak: 'break-word', textTransform: 'none' }}>
                    {log.description || '—'}
                  </td>
                  <td>
                    <span className="font-monospace" style={{ fontSize: '0.68rem', color: '#666' }}>
                      {log.ip_address || '—'}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn-outline-danger btn-sm py-0 px-1"
                      style={{ fontSize: '0.75rem' }}
                      title="Delete this log entry"
                      onClick={() => handleDeleteLog(log.id)}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pagination && pagination.last_page > 1 && (
          <div className="card-footer d-flex justify-content-between align-items-center bg-white py-2">
            <span className="small text-muted fw-bold">
              {pagination.from}–{pagination.to} OF {pagination.total?.toLocaleString()}
            </span>
            <div className="d-flex gap-1">
              <button
                className="btn btn-sm btn-outline-secondary fw-bold"
                disabled={pagination.current_page === 1}
                onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}
              >
                ‹ PREV
              </button>
              <span className="btn btn-sm btn-dark disabled fw-bold">
                {pagination.current_page} / {pagination.last_page}
              </span>
              <button
                className="btn btn-sm btn-outline-secondary fw-bold"
                disabled={pagination.current_page === pagination.last_page}
                onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}
              >
                NEXT ›
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
