import { useState, useEffect } from 'react';
import axios from '../../api/axios';
import { toast } from 'react-toastify';
import { useAuth } from '../../contexts/AuthContext';

export default function ActivityLogs() {
  const { hasFullAccess } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [userId, setUserId] = useState('');
  const [users, setUsers] = useState([]);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => {
    if (hasFullAccess()) {
      fetchLogs();
      fetchUsers();
    }
  }, [page, userId, fromDate, toDate]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page,
        user_id: userId,
        from_date: fromDate,
        to_date: toDate
      });
      const { data } = await axios.get(`/activity-logs?${params.toString()}`);
      setLogs(data.data);
      setLastPage(data.last_page);
    } catch (error) {
      toast.error('Failed to fetch activity logs');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data } = await axios.get('/users');
      setUsers(data.data || data);
    } catch (error) {
      console.error('Failed to fetch users');
    }
  };

  if (!hasFullAccess()) {
    return (
      <div className="container py-5 text-center">
        <div className="alert alert-danger">Unauthorized Access</div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="h4 mb-0 text-uppercase fw-bold text-primary">System Activity Logs</h2>
        <div className="d-flex gap-2">
            <button className="btn btn-sm btn-outline-secondary" onClick={() => { setUserId(''); setFromDate(''); setToDate(''); setPage(1); }}>RESET</button>
        </div>
      </div>

      <div className="card shadow-sm border-0 mb-4 bg-light">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label x-small text-uppercase fw-bold">Filter by User</label>
              <select className="form-select form-select-sm" value={userId} onChange={e => { setUserId(e.target.value); setPage(1); }}>
                <option value="">All Users</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.roles?.[0]?.name || 'No Role'})</option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label x-small text-uppercase fw-bold">From Date</label>
              <input type="date" className="form-control form-control-sm" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1); }} />
            </div>
            <div className="col-md-3">
              <label className="form-label x-small text-uppercase fw-bold">To Date</label>
              <input type="date" className="form-control form-control-sm" value={toDate} onChange={e => { setToDate(e.target.value); setPage(1); }} />
            </div>
          </div>
        </div>
      </div>

      <div className="card shadow-sm border-0">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light text-uppercase">
              <tr>
                <th className="ps-4">Time</th>
                <th>User</th>
                <th>Action</th>
                <th>Description</th>
                <th>IP Address</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" className="text-center py-5"><div className="spinner-border text-primary"/></td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan="5" className="text-center py-5 text-muted">No activity logs found</td></tr>
              ) : logs.map(log => (
                <tr key={log.id}>
                  <td className="ps-4 small">
                    {new Date(log.created_at).toLocaleString('en-GB', { 
                        day: '2-digit', month: 'short', year: 'numeric', 
                        hour: '2-digit', minute: '2-digit', second: '2-digit' 
                    })}
                  </td>
                  <td>
                    <div className="fw-bold small">{log.user?.name}</div>
                    <div className="x-small text-muted">{log.user?.roles?.[0]?.name?.toUpperCase() || 'SYSTEM'}</div>
                  </td>
                  <td>
                    <span className={`badge x-small ${
                      log.action.includes('DELETE') ? 'bg-danger' : 
                      log.action.includes('CREATE') ? 'bg-success' : 'bg-primary'
                    }`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="small text-wrap" style={{maxWidth: '300px'}}>{log.description}</td>
                  <td className="small text-muted font-monospace">{log.ip_address}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {lastPage > 1 && (
          <div className="card-footer d-flex justify-content-between align-items-center bg-white py-3">
            <button className="btn btn-outline-primary btn-sm px-4" disabled={page === 1} onClick={() => setPage(p => p - 1)}>PREVIOUS</button>
            <span className="text-muted small text-uppercase fw-bold">Page {page} of {lastPage}</span>
            <button className="btn btn-outline-primary btn-sm px-4" disabled={page === lastPage} onClick={() => setPage(p => p + 1)}>NEXT</button>
          </div>
        )}
      </div>
    </div>
  );
}
