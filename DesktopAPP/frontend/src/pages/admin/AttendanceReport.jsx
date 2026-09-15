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

function daysInMonth(yearMonth) {
  const [y, m] = yearMonth.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

function dowLetter(yearMonth, day) {
  const [y, m] = yearMonth.split('-').map(Number);
  return ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][new Date(y, m - 1, day).getDay()];
}

const TYPE_LABEL = { IN: 'Check In', OUT: 'Check Out', LUNCH_OUT: 'Lunch Out', LUNCH_IN: 'Back from Lunch' };
const TYPE_SHORT = { IN: 'In', OUT: 'Out', LUNCH_OUT: 'L.Out', LUNCH_IN: 'L.In' };
const LEAVE_LABEL = { full: 'Full Day', half_front: 'Half Day (Front)', half_later: 'Half Day (Later)' };
const LEAVE_CODE = { full: 'L', half_front: 'HLF', half_later: 'HLL' };
const GRID_CODE = { present: 'P', absent: 'A', leave_full: 'L', leave_half_front: 'HLF', leave_half_later: 'HLL' };
const GRID_CLASS = { present: 'bg-success text-white', absent: 'bg-danger text-white', leave_full: 'bg-primary text-white', leave_half_front: 'bg-warning text-dark', leave_half_later: 'bg-secondary text-white' };

/**
 * Also used, read-only, as the "My Report" section on the staff Attendance
 * page — pass readOnly to hide every mutating control (Mark Leave, Manual
 * Entry, Delete) and the Staff/Shop filters, since the backend already
 * force-scopes a non-admin caller to their own records regardless of what
 * filters are sent.
 */
export default function AttendanceReport({ readOnly = false }) {
  const [view, setView] = useState('log'); // 'log' | 'summary' | 'grid'
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
  const [expandedStaff, setExpandedStaff] = useState({}); // collapsed by default — nothing here means collapsed

  useEffect(() => {
    if (readOnly) return;
    api.get('/users').then(r => setUsers(r.data.data || r.data)).catch(() => {});
    api.get('/shops').then(r => setShops(r.data)).catch(() => {});
  }, [readOnly]);

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
  useEffect(() => { if (view === 'summary' || view === 'grid') loadSummary(); }, [view, month, filters.user_id, filters.shop_id]);

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

  const toggleStaff = (userId) => setExpandedStaff(s => ({ ...s, [userId]: !s[userId] }));

  return (
    <div>
      {!readOnly && (
        <div className="page-header d-flex justify-content-between align-items-center">
          <h2>🕐 Attendance Report</h2>
          {view === 'log' && (
            <div className="d-flex gap-2">
              <button className="btn btn-outline-primary btn-sm" onClick={() => setShowLeave(true)}>+ Mark Leave</button>
              <button className="btn btn-primary btn-sm" onClick={() => setShowManual(true)}>+ Manual Entry</button>
            </div>
          )}
        </div>
      )}

      <div className="btn-group btn-group-sm mb-3">
        <button className={`btn ${view === 'log' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setView('log')}>📋 Log View</button>
        <button className={`btn ${view === 'summary' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setView('summary')}>📅 Summary View</button>
        <button className={`btn ${view === 'grid' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setView('grid')}>🗓️ Grid View</button>
      </div>

      <div className="table-card p-3 mb-3">
        <div className="row g-2">
          {!readOnly && (
            <>
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
            </>
          )}
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

      {view === 'grid' ? (
        <div className="table-card">
          <div className="p-2 small text-muted border-bottom">
            <span className="badge bg-success me-1">P</span>Present &nbsp;
            <span className="badge bg-danger me-1">A</span>Absent &nbsp;
            <span className="badge bg-primary me-1">L</span>Leave (Full Day) &nbsp;
            <span className="badge bg-warning text-dark me-1">HLF</span>Half Leave (Front) &nbsp;
            <span className="badge bg-secondary me-1">HLL</span>Half Leave (Later)
          </div>
          {summaryLoading ? (
            <div className="text-center py-4"><div className="spinner-border spinner-border-sm text-primary" /></div>
          ) : (
            <div className="table-responsive">
              <table className="table table-bordered table-sm mb-0 align-middle text-center" style={{ borderColor: '#adb5bd' }}>
                <thead>
                  <tr>
                    <th style={{ position: 'sticky', left: 0, background: 'var(--bs-body-bg)', zIndex: 1, minWidth: 140 }} className="text-start">Staff</th>
                    {Array.from({ length: daysInMonth(month) }, (_, i) => i + 1).map(d => (
                      <th key={d} style={{ minWidth: 34 }}>
                        <div>{d}</div>
                        <div className="text-muted" style={{ fontSize: '0.55rem' }}>{dowLetter(month, d)}</div>
                      </th>
                    ))}
                    <th>P</th><th>A</th><th>L</th><th>HLF</th><th>HLL</th>
                  </tr>
                </thead>
                <tbody>
                  {!summary || summary.staff.length === 0 ? (
                    <tr><td colSpan={daysInMonth(month) + 6} className="text-center py-4 text-muted">No staff found</td></tr>
                  ) : summary.staff.map(s => {
                    const byDate = Object.fromEntries(s.days.map(d => [d.date, d.status]));
                    return (
                      <tr key={s.user_id}>
                        <td style={{ position: 'sticky', left: 0, background: 'var(--bs-body-bg)', zIndex: 1 }} className="text-start">
                          {s.name} {s.emp_id ? <span className="text-muted x-small">({s.emp_id})</span> : null}
                        </td>
                        {Array.from({ length: daysInMonth(month) }, (_, i) => i + 1).map(d => {
                          const dateStr = `${month}-${String(d).padStart(2, '0')}`;
                          const status = byDate[dateStr];
                          return (
                            <td key={d} className="p-1">
                              {status ? <span className={`badge ${GRID_CLASS[status]}`} style={{ fontSize: '0.62rem' }}>{GRID_CODE[status]}</span> : ''}
                            </td>
                          );
                        })}
                        <td><span className="badge bg-success">{s.present_count}</span></td>
                        <td><span className="badge bg-danger">{s.absent_count}</span></td>
                        <td><span className="badge bg-primary">{s.leave_full_count}</span></td>
                        <td><span className="badge bg-warning text-dark">{s.leave_half_front_count}</span></td>
                        <td><span className="badge bg-secondary">{s.leave_half_later_count}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : view === 'summary' ? (
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
                  <th>Leave (Half Front)</th>
                  <th>Leave (Half Later)</th>
                  <th>Days Considered</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {!summary || summary.staff.length === 0 ? (
                  <tr><td colSpan="9" className="text-center py-4 text-muted">No staff found</td></tr>
                ) : summary.staff.map(s => (
                  <React.Fragment key={s.user_id}>
                    <tr>
                      <td>{s.name} {s.emp_id ? <span className="text-muted x-small">({s.emp_id})</span> : null}</td>
                      <td>{s.shop_name || '—'}</td>
                      <td><span className="badge bg-success">{s.present_count}</span></td>
                      <td><span className="badge bg-danger">{s.absent_count}</span></td>
                      <td><span className="badge bg-primary">{s.leave_full_count}</span></td>
                      <td><span className="badge bg-warning text-dark">{s.leave_half_front_count}</span></td>
                      <td><span className="badge bg-secondary">{s.leave_half_later_count}</span></td>
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
                        <td colSpan="9" className="bg-body-tertiary">
                          <div className="d-flex flex-wrap gap-1 p-2">
                            {s.days.map(d => (
                              <span key={d.date} className={`badge ${GRID_CLASS[d.status] || 'bg-secondary'}`} title={`${d.date} — ${d.status}`}>
                                {GRID_CODE[d.status] || d.date.slice(-2)}
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
              <span className="text-muted small">{expandedStaff[user?.id] ? '▾ Hide' : '▸ Show'} ({days.length} day{days.length !== 1 ? 's' : ''})</span>
            </div>
            {expandedStaff[user?.id] && (
              <div className="table-responsive">
                <table className="table table-bordered table-sm mb-0 align-middle" style={{ borderColor: '#adb5bd' }}>
                  <thead>
                    <tr>
                      <th rowSpan={2} style={{ width: 100, verticalAlign: 'middle' }}>Date</th>
                      <th colSpan={3} className="text-center">Check In</th>
                      <th colSpan={4} className="text-center">Lunch</th>
                      <th colSpan={3} className="text-center">Check Out</th>
                      {!readOnly && <th rowSpan={2} style={{ width: 100, verticalAlign: 'middle' }}>Actions</th>}
                    </tr>
                    <tr>
                      <th>Time</th><th>Delay</th><th>Photo</th>
                      <th>Out</th><th>In</th><th>Late</th><th>Photo</th>
                      <th>Time</th><th>Early Leave</th><th>Photo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {days.map(day => {
                      const inEvent = day.events.find(e => e.type === 'IN');
                      const extraIns = day.events.filter(e => e.type === 'IN').length - (inEvent ? 1 : 0);
                      const outEvents = day.events.filter(e => e.type === 'OUT');
                      const outEvent = outEvents[outEvents.length - 1];
                      const extraOuts = outEvents.length - (outEvent ? 1 : 0);
                      const lunchOuts = day.events.filter(e => e.type === 'LUNCH_OUT');
                      const lunchIns = day.events.filter(e => e.type === 'LUNCH_IN');
                      const lunchPairs = lunchOuts.map((lo, i) => ({ out: lo, in: lunchIns[i] || null }));
                      const allEvents = day.events;

                      const Thumb = ({ ev }) => ev.photo_url ? (
                        <img
                          src={ev.photo_url} alt="" width={26} height={26} role="button"
                          style={{ objectFit: 'cover', borderRadius: 5, cursor: 'pointer' }}
                          onClick={() => setPreviewPhoto(ev.photo_url)}
                        />
                      ) : <span className="text-muted small">—</span>;

                      return (
                        <tr key={day.date}>
                          <td>
                            <div className="small fw-bold">{day.date}</div>
                            {day.leave && (
                              <div className="mt-1">
                                <span className="badge bg-info text-dark">
                                  🏖️ {LEAVE_LABEL[day.leave.type] || day.leave.type}
                                  {!readOnly && (
                                    <button
                                      className="btn btn-xs btn-link text-dark p-0 ms-1"
                                      style={{ textDecoration: 'underline' }}
                                      onClick={() => handleLeaveDelete(day.leave.id)}
                                    >×</button>
                                  )}
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Check In: Time | Delay | Photo */}
                          <td>{inEvent ? <span className="small">{istTimeStr(inEvent.logged_at)}{inEvent.is_manual && <span className="badge bg-secondary ms-1">M</span>}</span> : <span className="text-muted small">—</span>}
                            {extraIns > 0 && <div className="text-muted x-small">+{extraIns} more</div>}
                          </td>
                          <td>{inEvent?.is_first_of_day && inEvent.delay_minutes > 0 ? <span className="badge bg-danger">⏰ {inEvent.delay_minutes}m</span> : <span className="text-muted small">—</span>}</td>
                          <td>{inEvent ? <Thumb ev={inEvent} /> : <span className="text-muted small">—</span>}</td>

                          {/* Lunch: Out | In | Late | Photo (one line per pair if more than one) */}
                          <td>
                            {lunchPairs.length === 0 ? <span className="text-muted small">—</span> :
                              lunchPairs.map((p, i) => <div key={i} className="small">{istTimeStr(p.out.logged_at)}</div>)}
                          </td>
                          <td>
                            {lunchPairs.length === 0 ? <span className="text-muted small">—</span> :
                              lunchPairs.map((p, i) => {
                                const stillOut = !p.in && day.date !== todayIstStr();
                                return <div key={i} className="small">{p.in ? istTimeStr(p.in.logged_at) : (stillOut ? <span className="badge bg-warning text-dark">⚠️ No return</span> : '—')}</div>;
                              })}
                          </td>
                          <td>
                            {lunchPairs.length === 0 ? <span className="text-muted small">—</span> :
                              lunchPairs.map((p, i) => <div key={i}>{p.in?.lunch_late_minutes > 0 ? <span className="badge bg-danger">🍴 {p.in.lunch_late_minutes}m</span> : <span className="text-muted small">—</span>}</div>)}
                          </td>
                          <td>
                            {lunchPairs.length === 0 ? <span className="text-muted small">—</span> :
                              lunchPairs.map((p, i) => (
                                <div key={i} className="d-flex gap-1 mb-1"><Thumb ev={p.out} />{p.in && <Thumb ev={p.in} />}</div>
                              ))}
                          </td>

                          {/* Check Out: Time | Early Leave | Photo */}
                          <td>{outEvent ? <span className="small">{istTimeStr(outEvent.logged_at)}{outEvent.is_manual && <span className="badge bg-secondary ms-1">M</span>}</span> : <span className="text-muted small">—</span>}
                            {extraOuts > 0 && <div className="text-muted x-small">+{extraOuts} more</div>}
                          </td>
                          <td>{outEvent?.is_last_of_day && outEvent.early_leave_minutes > 0 ? <span className="badge bg-danger">🚪 {outEvent.early_leave_minutes}m</span> : <span className="text-muted small">—</span>}</td>
                          <td>{outEvent ? <Thumb ev={outEvent} /> : <span className="text-muted small">—</span>}</td>

                          {!readOnly && (
                            <td>
                              {allEvents.length === 0 ? (
                                <span className="text-muted small">No punches</span>
                              ) : (
                                <div className="d-flex flex-wrap gap-1">
                                  {allEvents.map(ev => (
                                    <button
                                      key={ev.id}
                                      className="btn btn-xs btn-outline-danger"
                                      title={`Delete ${TYPE_LABEL[ev.type]} @ ${istTimeStr(ev.logged_at)}`}
                                      onClick={() => handleDelete(ev.id)}
                                    >
                                      {TYPE_SHORT[ev.type]} ✕
                                    </button>
                                  ))}
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
      )}

      {!readOnly && showManual && (
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

      {!readOnly && showLeave && (
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
                      <option value="full">Full Day (L)</option>
                      <option value="half_front">Half Day — Front (HLF)</option>
                      <option value="half_later">Half Day — Later (HLL)</option>
                    </select>
                  </div>
                  <div className="form-text">Overrides Absent for this day. Only a limited number of Leave days are allowed per staff member per month (set per shop in Shops Manager) — marking beyond that limit is blocked. Marking the same staff+date again replaces the previous marking without counting against the limit.</div>
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
