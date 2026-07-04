import { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import api from '../api/axios';
import { formatDate } from '../utils/formatters';
import { useAuth } from '../contexts/AuthContext';

export default function FollowUps() {
  const { can } = useAuth();
  const [list, setList]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);

  const [filter, setFilter] = useState({ from: '', to: '', status: 'pending', search: '' });

  // Edit modal
  const [editModal, setEditModal] = useState(null);
  const [editForm, setEditForm]   = useState({ follow_up_date: '', notes: '', status: 'pending' });
  const [saving, setSaving]       = useState(false);

  // Add modal
  const [addModal, setAddModal]   = useState(false);
  const [addForm, setAddForm]     = useState({ customer_id: '', follow_up_date: today(), notes: '' });
  const [custSearch, setCustSearch] = useState('');
  const [adding, setAdding]         = useState(false);

  function today() { return new Date().toISOString().slice(0, 10); }

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/follow-ups', { params: filter });
      setList(data);
    } catch { toast.error('Failed to load follow-ups'); }
    finally  { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // Customer search for add modal
  useEffect(() => {
    if (custSearch.length < 2) { setCustomers([]); return; }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get('/customers', { params: { search: custSearch, per_page: 20 } });
        setCustomers(data.data || data);
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [custSearch]);

  // Stats
  const stats = useMemo(() => {
    const todayStr = today();
    return {
      total:     list.length,
      pending:   list.filter(f => f.status === 'pending').length,
      overdue:   list.filter(f => f.status === 'pending' && f.follow_up_date < todayStr).length,
      dueToday:  list.filter(f => f.status === 'pending' && f.follow_up_date === todayStr).length,
      completed: list.filter(f => f.status === 'completed').length,
    };
  }, [list]);

  const getStatusLabel = (fu) => {
    if (fu.status === 'completed')  return { label: 'COMPLETED', color: '#16a34a', bg: '#dcfce7' };
    if (fu.status === 'cancelled')  return { label: 'CANCELLED', color: '#64748b', bg: '#f1f5f9' };
    if (fu.follow_up_date < today()) return { label: 'OVERDUE',   color: '#dc2626', bg: '#fee2e2' };
    if (fu.follow_up_date === today()) return { label: 'TODAY',   color: '#d97706', bg: '#fef3c7' };
    return { label: 'PENDING', color: '#0891b2', bg: '#ecfeff' };
  };

  const markDone = async (id) => {
    try {
      await api.put(`/follow-ups/${id}`, { status: 'completed', completed_at: today() });
      toast.success('Marked as completed');
      load();
    } catch { toast.error('Failed to update'); }
  };

  const deleteFollowUp = async (id) => {
    if (!window.confirm('Delete this follow-up?')) return;
    try {
      await api.delete(`/follow-ups/${id}`);
      toast.success('Deleted');
      load();
    } catch { toast.error('Failed to delete'); }
  };

  const openEdit = (fu) => {
    setEditForm({ follow_up_date: fu.follow_up_date, notes: fu.notes || '', status: fu.status });
    setEditModal(fu);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      await api.put(`/follow-ups/${editModal.id}`, editForm);
      toast.success('Updated');
      setEditModal(null);
      load();
    } catch { toast.error('Update failed'); }
    finally { setSaving(false); }
  };

  const submitAdd = async () => {
    if (!addForm.customer_id) return toast.warning('Select a customer');
    if (!addForm.follow_up_date) return toast.warning('Set a date');
    setAdding(true);
    try {
      await api.post('/follow-ups', addForm);
      toast.success('Follow-up added');
      setAddModal(false);
      setAddForm({ customer_id: '', follow_up_date: today(), notes: '' });
      setCustSearch('');
      load();
    } catch { toast.error('Failed to add'); }
    finally { setAdding(false); }
  };

  return (
    <div className="container-fluid py-3">
      <div className="page-header mb-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div>
          <h2 className="mb-0 fw-bold text-uppercase">📅 Follow-ups</h2>
          <p className="text-muted small mb-0 text-uppercase">Track customer follow-up calls and visits</p>
        </div>
        {can('create_followup') && (
          <button onClick={() => { setAddModal(true); setAddForm({ customer_id: '', follow_up_date: today(), notes: '' }); setCustSearch(''); }}
            className="btn btn-primary fw-bold text-uppercase shadow-sm">
            + New Follow-up
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="row g-2 mb-3">
        {[
          { label: 'Overdue',   value: stats.overdue,   color: '#dc2626', bg: '#fef2f2' },
          { label: 'Due Today', value: stats.dueToday,  color: '#d97706', bg: '#fef3c7' },
          { label: 'Pending',   value: stats.pending,   color: '#0891b2', bg: '#ecfeff' },
          { label: 'Completed', value: stats.completed, color: '#16a34a', bg: '#f0fdf4' },
          { label: 'Total',     value: stats.total,     color: '#1e293b', bg: '#f1f5f9' },
        ].map(s => (
          <div key={s.label} className="col-6 col-sm-4 col-md-2">
            <div style={{background: s.bg, border:`1.5px solid ${s.color}22`, borderRadius:10, padding:'10px 14px'}}>
              <div style={{fontSize:'.6rem', fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'.5px'}}>{s.label}</div>
              <div style={{fontSize:'1.4rem', fontWeight:900, color: s.color}}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card shadow-sm mb-3 p-3" style={{border:'1px solid #e2e8f0'}}>
        <div className="row g-2 align-items-end text-uppercase">
          <div className="col-12 col-md-3">
            <label className="small text-muted fw-bold mb-1">Search Customer</label>
            <input className="form-control form-control-sm text-uppercase" placeholder="NAME OR PHONE..."
              value={filter.search} onChange={e => setFilter(f => ({ ...f, search: e.target.value }))} />
          </div>
          <div className="col-12 col-md-3">
            <label className="small text-muted fw-bold mb-1">Date Range</label>
            <div className="input-group input-group-sm">
              <input type="date" className="form-control" value={filter.from} onChange={e => setFilter(f => ({ ...f, from: e.target.value }))} />
              <span className="input-group-text">—</span>
              <input type="date" className="form-control" value={filter.to} onChange={e => setFilter(f => ({ ...f, to: e.target.value }))} />
            </div>
          </div>
          <div className="col-6 col-md-2">
            <label className="small text-muted fw-bold mb-1">Status</label>
            <select className="form-select form-select-sm" value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}>
              <option value="">ALL</option>
              <option value="pending">PENDING</option>
              <option value="completed">COMPLETED</option>
              <option value="cancelled">CANCELLED</option>
            </select>
          </div>
          <div className="col-3 col-md-1">
            <button className="btn btn-sm btn-primary fw-bold w-100" onClick={load}>GO</button>
          </div>
          <div className="col-3 col-md-1">
            <button className="btn btn-sm btn-outline-secondary fw-bold w-100"
              onClick={() => setFilter({ from: '', to: '', status: 'pending', search: '' })}>
              RESET
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{background:'#fff', borderRadius:10, border:'1px solid #e2e8f0', overflow:'hidden'}}>
        <div className="table-responsive">
          <table style={{width:'100%', borderCollapse:'collapse', fontSize:'.8rem'}}>
            <thead>
              <tr style={{background:'#f1f5f9', borderBottom:'2px solid #cbd5e1'}}>
                {['FOLLOW-UP DATE', 'CUSTOMER', 'NOTES', 'STATUS', 'ADDED BY', 'ACTIONS'].map(h => (
                  <th key={h} style={{padding:'10px 14px', fontSize:'.62rem', fontWeight:700, color:'#475569', textTransform:'uppercase', letterSpacing:'1px', border:'1px solid #e2e8f0'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-5"><div className="spinner-border text-primary" /></td></tr>
              ) : list.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-5 fw-bold text-muted text-uppercase">No follow-ups found</td></tr>
              ) : list.map(fu => {
                const st = getStatusLabel(fu);
                return (
                  <tr key={fu.id} style={{borderBottom:'1px solid #e2e8f0', background: st.label === 'OVERDUE' ? '#fff8f8' : '#fff'}}>
                    <td style={{padding:'12px 14px', border:'1px solid #e2e8f0', whiteSpace:'nowrap'}}>
                      <div className="fw-bold" style={{color: st.label === 'OVERDUE' ? '#dc2626' : '#1e293b'}}>{formatDate(fu.follow_up_date)}</div>
                      {st.label === 'OVERDUE' && (
                        <div style={{fontSize:'.62rem', color:'#dc2626', fontWeight:700}}>
                          ⚠️ {Math.ceil((new Date(today()) - new Date(fu.follow_up_date)) / 86400000)} day(s) overdue
                        </div>
                      )}
                      {fu.completed_at && (
                        <div style={{fontSize:'.62rem', color:'#16a34a'}}>Done: {formatDate(fu.completed_at)}</div>
                      )}
                    </td>
                    <td style={{padding:'12px 14px', border:'1px solid #e2e8f0'}}>
                      <div className="fw-bold">{fu.customer?.name}</div>
                      <div style={{fontSize:'.65rem', color:'#64748b'}}>📞 {fu.customer?.phone}</div>
                    </td>
                    <td style={{padding:'12px 14px', border:'1px solid #e2e8f0', maxWidth:220, color:'#475569'}}>
                      {fu.notes || <span style={{color:'#cbd5e1'}}>—</span>}
                    </td>
                    <td style={{padding:'12px 14px', border:'1px solid #e2e8f0', textAlign:'center'}}>
                      <span style={{background: st.bg, color: st.color, fontSize:'.62rem', fontWeight:800, padding:'3px 10px', borderRadius:20, display:'inline-block'}}>
                        {st.label}
                      </span>
                    </td>
                    <td style={{padding:'12px 14px', border:'1px solid #e2e8f0', fontSize:'.7rem', color:'#64748b'}}>
                      {fu.createdBy?.name || '—'}
                    </td>
                    <td style={{padding:'12px 14px', border:'1px solid #e2e8f0'}}>
                      <div className="d-flex gap-1 flex-wrap">
                        {fu.status === 'pending' && can('edit_followup') && (
                          <button onClick={() => markDone(fu.id)}
                            style={{padding:'3px 10px', fontSize:'.65rem', fontWeight:800, background:'#16a34a', color:'#fff', border:'none', borderRadius:5, cursor:'pointer'}}>
                            ✓ DONE
                          </button>
                        )}
                        {can('edit_followup') && (
                          <button onClick={() => openEdit(fu)}
                            style={{padding:'3px 10px', fontSize:'.65rem', fontWeight:700, background:'#f1f5f9', color:'#1e293b', border:'1px solid #cbd5e1', borderRadius:5, cursor:'pointer'}}>
                            EDIT
                          </button>
                        )}
                        {can('delete_followup') && (
                          <button onClick={() => deleteFollowUp(fu.id)}
                            style={{padding:'3px 8px', fontSize:'.65rem', fontWeight:700, background:'#fef2f2', color:'#dc2626', border:'1px solid #fca5a5', borderRadius:5, cursor:'pointer'}}>
                            DEL
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:1050,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={() => setEditModal(null)}>
          <div style={{background:'#fff',borderRadius:14,padding:'24px 28px',maxWidth:400,width:'95%',boxShadow:'0 20px 60px rgba(0,0,0,.2)'}} onClick={e => e.stopPropagation()}>
            <div style={{fontWeight:800, fontSize:'1rem', marginBottom:16}}>✏️ Edit Follow-up — {editModal.customer?.name}</div>
            <div className="mb-3">
              <label className="small fw-bold text-muted text-uppercase mb-1">Follow-up Date</label>
              <input type="date" className="form-control fw-bold" value={editForm.follow_up_date}
                onChange={e => setEditForm(f => ({ ...f, follow_up_date: e.target.value }))} />
            </div>
            <div className="mb-3">
              <label className="small fw-bold text-muted text-uppercase mb-1">Status</label>
              <select className="form-select fw-bold" value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
                <option value="pending">PENDING</option>
                <option value="completed">COMPLETED</option>
                <option value="cancelled">CANCELLED</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="small fw-bold text-muted text-uppercase mb-1">Notes</label>
              <textarea className="form-control" rows={3} value={editForm.notes}
                onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="d-flex gap-2 justify-content-end">
              <button onClick={() => setEditModal(null)} style={{padding:'7px 18px',fontSize:'.8rem',border:'1.5px solid #e2e8f0',background:'#f8fafc',borderRadius:8,fontWeight:700,cursor:'pointer'}}>Cancel</button>
              <button onClick={saveEdit} disabled={saving} style={{padding:'7px 18px',fontSize:'.8rem',background:'#1e293b',color:'#fff',border:'none',borderRadius:8,fontWeight:800,cursor:'pointer'}}>
                {saving ? 'Saving...' : '💾 Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Follow-up Modal */}
      {addModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:1050,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={() => setAddModal(false)}>
          <div style={{background:'#fff',borderRadius:14,padding:'24px 28px',maxWidth:420,width:'95%',boxShadow:'0 20px 60px rgba(0,0,0,.2)'}} onClick={e => e.stopPropagation()}>
            <div style={{fontWeight:800, fontSize:'1rem', marginBottom:16}}>📅 New Follow-up</div>
            <div className="mb-3 position-relative">
              <label className="small fw-bold text-muted text-uppercase mb-1">Search Customer</label>
              <input className="form-control fw-bold text-uppercase" placeholder="TYPE NAME OR PHONE..."
                value={custSearch} onChange={e => { setCustSearch(e.target.value); setAddForm(f => ({ ...f, customer_id: '' })); }} />
              {customers.length > 0 && !addForm.customer_id && (
                <div style={{position:'absolute', zIndex:100, top:'100%', left:0, right:0, background:'#fff', border:'1px solid #e2e8f0', borderRadius:8, maxHeight:180, overflowY:'auto', boxShadow:'0 8px 24px rgba(0,0,0,.1)'}}>
                  {customers.map(c => (
                    <div key={c.id} onClick={() => { setAddForm(f => ({ ...f, customer_id: c.id })); setCustSearch(c.name + (c.phone ? ` (${c.phone})` : '')); setCustomers([]); }}
                      style={{padding:'8px 14px', cursor:'pointer', fontSize:'.8rem', fontWeight:600, borderBottom:'1px solid #f1f5f9'}}
                      onMouseEnter={e => e.currentTarget.style.background='#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background='#fff'}>
                      {c.name} <span style={{color:'#94a3b8', fontSize:'.7rem'}}>📞 {c.phone}</span>
                    </div>
                  ))}
                </div>
              )}
              {addForm.customer_id && <div style={{fontSize:'.65rem', color:'#16a34a', marginTop:3, fontWeight:700}}>✓ Customer selected</div>}
            </div>
            <div className="mb-3">
              <label className="small fw-bold text-muted text-uppercase mb-1">Follow-up Date</label>
              <input type="date" className="form-control fw-bold" value={addForm.follow_up_date}
                onChange={e => setAddForm(f => ({ ...f, follow_up_date: e.target.value }))} />
            </div>
            <div className="mb-4">
              <label className="small fw-bold text-muted text-uppercase mb-1">Notes</label>
              <textarea className="form-control" rows={2} placeholder="What to discuss..."
                value={addForm.notes} onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="d-flex gap-2 justify-content-end">
              <button onClick={() => setAddModal(false)} style={{padding:'7px 18px',fontSize:'.8rem',border:'1.5px solid #e2e8f0',background:'#f8fafc',borderRadius:8,fontWeight:700,cursor:'pointer'}}>Cancel</button>
              <button onClick={submitAdd} disabled={adding} style={{padding:'7px 18px',fontSize:'.8rem',background:'#1e293b',color:'#fff',border:'none',borderRadius:8,fontWeight:800,cursor:'pointer'}}>
                {adding ? 'Adding...' : '📅 Add Follow-up'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
