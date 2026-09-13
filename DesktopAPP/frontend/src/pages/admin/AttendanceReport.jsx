import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import pinGate from '../../utils/pinGate';

function currentYearMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function AttendanceReport() {
  const [view, setView] = useState('log'); // 'log' | 'summary'
  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ user_id: '', shop_id: '', from: '', to: '' });
  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState({ user_id: '', shop_id: '', type: 'IN', logged_at: '' });

  const [month, setMonth] = useState(currentYearMonth());
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [expandedUser, setExpandedUser] = useState(null);
  const [previewPhoto, setPreviewPhoto] = useState(null);

  useEffect(() => {
    api.get('/users').then(r => setUsers(r.data.data || r.data)).catch(() => {});
    api.get('/shops').then(r => setShops(r.data)).catch(() => {});
  }, []);

  const load = () => {
    setLoading(true);
    api.get('/attendance', { params: filters })
      .then(r => setLogs(r.data.data || r.data))
      .catch(() => toast.error('Failed to load attendance logs'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { if (view === 'log') load(); }, [filters, view]);

  const loadSummary = () => {
    setSummaryLoading(true);
    api.get('/attendance/summary', { params: { month, user_id: filters.user_id, shop_id: filters.shop_id } })
      .then(r => setSummary(r.data))
      .catch(e => toast.error(e.response?.data?.message || 'Failed to load summary'))
      .finally(() => setSummaryLoading(false));
  };
  useEffect(() => { if (view === 'summary') loadSummary(); }, [view, month, filters.user_id, filters.shop_id]);

  const handleDelete = async (id) => {
    if (!await pinGate.confirm()) return;
    try {
      await api.delete(`/attendance/${id}`);
      toast.success('Entry deleted');
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to delete'); }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!await pinGate.confirm()) return;
    try {
      await api.post('/attendance/manual', manual);
      toast.success('Manual entry added');
      setShowManual(false);
      setManual({ user_id: '', shop_id: '', type: 'IN', logged_at: '' });
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to add entry'); }
  };

  return (
    <div>
      <div className="page-header d-flex justify-content-between align-items-center">
        <h2>🕐 Attendance Report</h2>
        {view === 'log' && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowManual(true)}>+ Manual Entry</button>
        )}
      </div>

      <div className="btn-group btn-group-sm mb-3">
        <button className={`btn ${view === 'log' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setView('log')}>📋 Log View</button>
        <button className={`btn ${view === 'summary' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setView('summary')}>📅 Summary View</button>
      </div>

      <div className="table-card p-3 mb-3">
        <div className="row g-2">
          <div className="col-12 col-md-3">
            <select className="form-select form-select-sm" value={filters.user_id} onChange={e => setFilters({...filters, user_id: e.target.value})}>
              <option value="">All Staff</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div className="col-12 col-md-3">
            <select className="form-select form-select-sm" value={filters.shop_id} onChange={e => setFilters({...filters, shop_id: e.target.value})}>
              <option value="">All Shops</option>
              {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          {view === 'log' ? (
            <>
              <div className="col-6 col-md-3">
                <input type="date" className="form-control form-control-sm" value={filters.from} onChange={e => setFilters({...filters, from: e.target.value})} />
              </div>
              <div className="col-6 col-md-3">
                <input type="date" className="form-control form-control-sm" value={filters.to} onChange={e => setFilters({...filters, to: e.target.value})} />
              </div>
            </>
          ) : (
            <div className="col-6 col-md-3">
              <input type="month" className="form-control form-control-sm" value={month} onChange={e => setMonth(e.target.value)} />
            </div>
          )}
        </div>
      </div>

      {view === 'summary' ? (
        <div className="table-card">
          {summaryLoading ? (
            <div className="text-center py-4"><div className="spinner-border spinner-border-sm text-primary" /></div>
          ) : (
            <table className="table table-bordered table-hover mb-0 align-middle">
              <thead>
                <tr>
                  <th>Staff</th>
                  <th>Shop</th>
                  <th>Present</th>
                  <th>Absent</th>
                  <th>Days Considered</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {!summary || summary.staff.length === 0 ? (
                  <tr><td colSpan="6" className="text-center py-4 text-muted">No staff found</td></tr>
                ) : summary.staff.map(s => (
                  <React.Fragment key={s.user_id}>
                    <tr>
                      <td>{s.name} {s.emp_id ? <span className="text-muted x-small">({s.emp_id})</span> : null}</td>
                      <td>{s.shop_name || '—'}</td>
                      <td><span className="badge bg-success">{s.present_count}</span></td>
                      <td><span className="badge bg-danger">{s.absent_count}</span></td>
                      <td>{s.days_considered}</td>
                      <td>
                        {s.days.length > 0 && (
                          <button className="btn btn-xs btn-outline-secondary" onClick={() => setExpandedUser(expandedUser === s.user_id ? null : s.user_id)}>
                            {expandedUser === s.user_id ? 'Hide days' : 'View days'}
                          </button>
                        )}
                      </td>
                    </tr>
                    {expandedUser === s.user_id && (
                      <tr>
                        <td colSpan="6" className="bg-body-tertiary">
                          <div className="d-flex flex-wrap gap-1 p-2">
                            {s.days.map(d => (
                              <span key={d.date} className={`badge ${d.status === 'present' ? 'bg-success' : 'bg-danger'}`} title={d.date}>
                                {d.date.slice(-2)}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
      <div className="table-card">
        {loading ? (
          <div className="text-center py-4"><div className="spinner-border spinner-border-sm text-primary" /></div>
        ) : (
          <table className="table table-bordered table-hover mb-0 align-middle">
            <thead>
              <tr>
                <th>Photo</th>
                <th>Date / Time</th>
                <th>Staff</th>
                <th>Shop</th>
                <th>Type</th>
                <th>Distance</th>
                <th>Face Match</th>
                <th>Source</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan="9" className="text-center py-4 text-muted">No attendance entries found</td></tr>
              ) : logs.map(l => (
                <tr key={l.id}>
                  <td>
                    {l.photo_url ? (
                      <img
                        src={l.photo_url}
                        alt=""
                        width={40}
                        height={40}
                        role="button"
                        style={{ objectFit: 'cover', borderRadius: 6, cursor: 'pointer' }}
                        onClick={() => setPreviewPhoto(l.photo_url)}
                      />
                    ) : '—'}
                  </td>
                  <td>{new Date(l.logged_at).toLocaleString()}</td>
                  <td>{l.user?.name} {l.user?.emp_id ? <span className="text-muted x-small">({l.user.emp_id})</span> : null}</td>
                  <td>{l.shop?.name}</td>
                  <td><span className={`badge ${l.type === 'IN' ? 'bg-success' : 'bg-secondary'}`}>{l.type}</span></td>
                  <td>{l.is_manual ? '—' : `${l.distance_meters.toFixed(1)}m`}</td>
                  <td>{l.is_manual ? '—' : `${(l.face_match_score * 100).toFixed(0)}%`}</td>
                  <td>{l.is_manual ? <span className="badge bg-warning text-dark">Manual{l.created_by ? ` by ${l.createdBy?.name}` : ''}</span> : <span className="badge bg-info text-dark">Live</span>}</td>
                  <td><button className="btn btn-xs btn-outline-danger" onClick={() => handleDelete(l.id)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      )}

      {showManual && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <form onSubmit={handleManualSubmit}>
                <div className="modal-header">
                  <h5 className="modal-title">Manual Attendance Entry</h5>
                  <button type="button" className="btn-close" onClick={() => setShowManual(false)}></button>
                </div>
                <div className="modal-body">
                  <div className="mb-2">
                    <label className="form-label small fw-bold">Staff *</label>
                    <select className="form-select" required value={manual.user_id} onChange={e => setManual({...manual, user_id: e.target.value})}>
                      <option value="">Select...</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                  <div className="mb-2">
                    <label className="form-label small fw-bold">Shop *</label>
                    <select className="form-select" required value={manual.shop_id} onChange={e => setManual({...manual, shop_id: e.target.value})}>
                      <option value="">Select...</option>
                      {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div className="mb-2">
                    <label className="form-label small fw-bold">Type *</label>
                    <select className="form-select" required value={manual.type} onChange={e => setManual({...manual, type: e.target.value})}>
                      <option value="IN">Check In</option>
                      <option value="OUT">Check Out</option>
                    </select>
                  </div>
                  <div className="mb-2">
                    <label className="form-label small fw-bold">Date & Time *</label>
                    <input type="datetime-local" className="form-control" required value={manual.logged_at} onChange={e => setManual({...manual, logged_at: e.target.value})} />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setShowManual(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary btn-sm">Add Entry</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {previewPhoto && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
          onClick={() => setPreviewPhoto(null)}
        >
          <div className="modal-dialog modal-dialog-centered" onClick={e => e.stopPropagation()}>
            <div className="modal-content bg-transparent border-0">
              <div className="modal-header border-0">
                <button type="button" className="btn-close btn-close-white ms-auto" onClick={() => setPreviewPhoto(null)}></button>
              </div>
              <div className="modal-body text-center pt-0">
                <img src={previewPhoto} alt="Attendance snapshot" className="img-fluid rounded" style={{ maxHeight: '75vh' }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
