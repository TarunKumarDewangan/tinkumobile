import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import pinGate from '../../utils/pinGate';

const IST = 'Asia/Kolkata';

function currentYearMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// YYYY-MM-DD for a given instant, evaluated in IST regardless of the
// viewer's own browser timezone — must match how the backend buckets days.
function istDateKey(isoString) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: IST, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(isoString));
}

function istTimeStr(isoString) {
  return new Intl.DateTimeFormat('en-IN', { timeZone: IST, hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(isoString));
}

function todayIstStr() {
  return istDateKey(new Date().toISOString());
}

function addDaysStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const TYPE_LABEL = { IN: 'Check In', OUT: 'Check Out', LUNCH_OUT: 'Lunch Out', LUNCH_IN: 'Back from Lunch' };
const TYPE_BADGE = { IN: 'bg-success', OUT: 'bg-secondary', LUNCH_OUT: 'bg-warning text-dark', LUNCH_IN: 'bg-primary' };

export default function AttendanceReport() {
  const [view, setView] = useState('log'); // 'log' | 'summary'
  const [logs, setLogs] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [users, setUsers] = useState([]);
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ user_id: '', shop_id: '', from: '', to: '' });
  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState({ user_id: '', shop_id: '', type: 'IN', logged_at: '' });
  const [showLeave, setShowLeave] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ user_id: '', date: '', type: 'full' });

  const [month, setMonth] = useState(currentYearMonth());
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [expandedUser, setExpandedUser] = useState(null);
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [collapsedStaff, setCollapsedStaff] = useState({});

  useEffect(() => {
    api.get('/users').then(r => setUsers(r.data.data || r.data)).catch(() => {});
    api.get('/shops').then(r => setShops(r.data)).catch(() => {});
  }, []);

  const load = () => {
    setLoading(true);
    api.get('/attendance', { params: filters })
      .then(r => { setLogs(r.data.data || []); setLeaves(r.data.leaves || []); })
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

  const handleLeaveSubmit = async (e) => {
    e.preventDefault();
    if (!await pinGate.confirm()) return;
    try {
      await api.post('/attendance/leave', leaveForm);
      toast.success('Leave marked');
      setShowLeave(false);
      setLeaveForm({ user_id: '', date: '', type: 'full' });
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to mark leave'); }
  };

  const handleLeaveDelete = async (id) => {
    if (!await pinGate.confirm()) return;
    try {
      await api.delete(`/attendance/leave/${id}`);
      toast.success('Leave marking removed');
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to remove'); }
  };

  const applyPreset = (preset) => {
    const today = todayIstStr();
    if (preset === 'today') setFilters(f => ({ ...f, from: today, to: today }));
    else if (preset === 'yesterday') { const y = addDaysStr(today, -1); setFilters(f => ({ ...f, from: y, to: y })); }
    else if (preset === 'week') setFilters(f => ({ ...f, from: addDaysStr(today, -6), to: today }));
    else if (preset === 'month') setFilters(f => ({ ...f, from: today.slice(0, 8) + '01', to: today }));
  };

  // Groups the flat logs + leaves into Staff -> Date -> events, so the
  // report reads as a scannable per-person timeline instead of one long
  // chronologically-mixed table.
  const grouped = useMemo(() => {
    const byUser = {};
    const ensure = (userId, userObj) => {
      if (!byUser[userId]) byUser[userId] = { user: userObj, days: {} };
      return byUser[userId];
    };
    const ensureDay = (bucket, date) => {
      if (!bucket.days[date]) bucket.days[date] = { date, events: [], leave: null };
      return bucket.days[date];
    };

    logs.forEach(l => {
      const bucket = ensure(l.user_id, l.user);
      const day = ensureDay(bucket, istDateKey(l.logged_at));
      day.events.push(l);
    });
    leaves.forEach(lv => {
      const bucket = ensure(lv.user_id, lv.user);
      const day = ensureDay(bucket, lv.date);
      day.leave = lv;
    });

    return Object.values(byUser)
      .map(b => ({
        ...b,
        days: Object.values(b.days)
          .map(d => ({ ...d, events: d.events.sort((a, c) => new Date(a.logged_at) - new Date(c.logged_at)) }))
          .sort((a, c) => (a.date < c.date ? 1 : -1)),
      }))
      .sort((a, c) => (a.user?.name || '').localeCompare(c.user?.name || ''));
  }, [logs, leaves]);

  const toggleStaff = (userId) => setCollapsedStaff(s => ({ ...s, [userId]: !s[userId] }));

  return (
    <div>
      <div className="page-header d-flex justify-content-between align-items-center">
        <h2>🕐 Attendance Report</h2>
        {view === 'log' && (
          <div className="d-flex gap-2">
            <button className="btn btn-outline-primary btn-sm" onClick={() => setShowLeave(true)}>+ Mark Leave</button>
            <button className="btn btn-primary btn-sm" onClick={() => setShowManual(true)}>+ Manual Entry</button>
          </div>
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
        {view === 'log' && (
          <div className="btn-group btn-group-sm mt-2">
            <button className="btn btn-outline-secondary" onClick={() => applyPreset('today')}>Today</button>
            <button className="btn btn-outline-secondary" onClick={() => applyPreset('yesterday')}>Yesterday</button>
            <button className="btn btn-outline-secondary" onClick={() => applyPreset('week')}>This Week</button>
            <button className="btn btn-outline-secondary" onClick={() => applyPreset('month')}>This Month</button>
            <button className="btn btn-outline-secondary" onClick={() => setFilters(f => ({ ...f, from: '', to: '' }))}>All Dates</button>
          </div>
        )}
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
                  <th>Leave (Full)</th>
                  <th>Leave (Half)</th>
                  <th>Days Considered</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {!summary || summary.staff.length === 0 ? (
                  <tr><td colSpan="8" className="text-center py-4 text-muted">No staff found</td></tr>
                ) : summary.staff.map(s => (
                  <React.Fragment key={s.user_id}>
                    <tr>
                      <td>{s.name} {s.emp_id ? <span className="text-muted x-small">({s.emp_id})</span> : null}</td>
                      <td>{s.shop_name || '—'}</td>
                      <td><span className="badge bg-success">{s.present_count}</span></td>
                      <td><span className="badge bg-danger">{s.absent_count}</span></td>
                      <td><span className="badge bg-info text-dark">{s.leave_full_count}</span></td>
                      <td><span className="badge bg-info text-dark">{s.leave_half_count}</span></td>
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
                        <td colSpan="8" className="bg-body-tertiary">
                          <div className="d-flex flex-wrap gap-1 p-2">
                            {s.days.map(d => {
                              const cls = d.status === 'present' ? 'bg-success' : d.status === 'absent' ? 'bg-danger' : 'bg-info text-dark';
                              const label = d.status === 'leave_full' ? 'LF' : d.status === 'leave_half' ? 'LH' : d.date.slice(-2);
                              return <span key={d.date} className={`badge ${cls}`} title={`${d.date} — ${d.status}`}>{label}</span>;
                            })}
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
      <div>
        {loading ? (
          <div className="table-card text-center py-4"><div className="spinner-border spinner-border-sm text-primary" /></div>
        ) : grouped.length === 0 ? (
          <div className="table-card text-center py-4 text-muted">No attendance entries found</div>
        ) : grouped.map(({ user, days }) => (
          <div key={user?.id} className="table-card mb-3">
            <div
              className="p-3 border-bottom d-flex justify-content-between align-items-center"
              style={{ cursor: 'pointer' }}
              onClick={() => toggleStaff(user?.id)}
            >
              <strong>{user?.name} {user?.emp_id ? <span className="text-muted x-small">({user.emp_id})</span> : null}</strong>
              <span className="text-muted small">{collapsedStaff[user?.id] ? '▸ Show' : '▾ Hide'} ({days.length} day{days.length !== 1 ? 's' : ''})</span>
            </div>
            {!collapsedStaff[user?.id] && (
              <div className="p-3">
                {days.map(day => (
                  <div key={day.date} className="mb-3 pb-3 border-bottom">
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <strong className="small">{day.date}</strong>
                      {day.leave && (
                        <span className="badge bg-info text-dark">
                          🏖️ {day.leave.type === 'full' ? 'Full Day Leave' : 'Half Day Leave'}
                          <button
                            className="btn btn-xs btn-link text-dark p-0 ms-2"
                            style={{ textDecoration: 'underline' }}
                            onClick={() => handleLeaveDelete(day.leave.id)}
                          >remove</button>
                        </span>
                      )}
                    </div>
                    {day.events.length === 0 ? (
                      <div className="text-muted small">No punches this day.</div>
                    ) : (
                      <div className="d-flex flex-column gap-1">
                        {day.events.map((ev, idx) => {
                          const noLunchReturn = ev.type === 'LUNCH_OUT'
                            && !day.events.slice(idx + 1).some(e2 => e2.type === 'LUNCH_IN')
                            && day.date !== todayIstStr();
                          return (
                            <div key={ev.id} className="d-flex align-items-center gap-2 flex-wrap">
                              {ev.photo_url ? (
                                <img
                                  src={ev.photo_url} alt="" width={32} height={32} role="button"
                                  style={{ objectFit: 'cover', borderRadius: 6, cursor: 'pointer' }}
                                  onClick={() => setPreviewPhoto(ev.photo_url)}
                                />
                              ) : <div style={{ width: 32, height: 32 }} className="text-center text-muted small">—</div>}
                              <span className="small text-muted" style={{ width: 90 }}>{istTimeStr(ev.logged_at)}</span>
                              <span className={`badge ${TYPE_BADGE[ev.type]}`}>{TYPE_LABEL[ev.type]}</span>
                              {ev.is_first_of_day && ev.delay_minutes > 0 && (
                                <span className="badge bg-danger">⏰ Delay {ev.delay_minutes}m</span>
                              )}
                              {ev.is_last_of_day && ev.early_leave_minutes > 0 && (
                                <span className="badge bg-danger">🚪 Early Leave {ev.early_leave_minutes}m</span>
                              )}
                              {ev.type === 'LUNCH_IN' && ev.lunch_late_minutes > 0 && (
                                <span className="badge bg-danger">🍴 Late Return {ev.lunch_late_minutes}m</span>
                              )}
                              {noLunchReturn && (
                                <span className="badge bg-warning text-dark">⚠️ No return recorded</span>
                              )}
                              {ev.is_manual ? (
                                <span className="badge bg-secondary">Manual{ev.created_by ? ` by ${ev.createdBy?.name}` : ''}</span>
                              ) : (
                                <span className="text-muted x-small">{ev.distance_meters?.toFixed(1)}m · {(ev.face_match_score * 100).toFixed(0)}%</span>
                              )}
                              <button className="btn btn-xs btn-outline-danger ms-auto" onClick={() => handleDelete(ev.id)}>Delete</button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
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

      {showLeave && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <form onSubmit={handleLeaveSubmit}>
                <div className="modal-header">
                  <h5 className="modal-title">Mark Leave</h5>
                  <button type="button" className="btn-close" onClick={() => setShowLeave(false)}></button>
                </div>
                <div className="modal-body">
                  <div className="mb-2">
                    <label className="form-label small fw-bold">Staff *</label>
                    <select className="form-select" required value={leaveForm.user_id} onChange={e => setLeaveForm({...leaveForm, user_id: e.target.value})}>
                      <option value="">Select...</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                  <div className="mb-2">
                    <label className="form-label small fw-bold">Date *</label>
                    <input type="date" className="form-control" required value={leaveForm.date} onChange={e => setLeaveForm({...leaveForm, date: e.target.value})} />
                  </div>
                  <div className="mb-2">
                    <label className="form-label small fw-bold">Type *</label>
                    <select className="form-select" required value={leaveForm.type} onChange={e => setLeaveForm({...leaveForm, type: e.target.value})}>
                      <option value="full">Full Day</option>
                      <option value="half">Half Day</option>
                    </select>
                  </div>
                  <div className="form-text">Overrides Absent for this day. Marking the same staff+date again replaces the previous marking.</div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setShowLeave(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary btn-sm">Mark Leave</button>
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
