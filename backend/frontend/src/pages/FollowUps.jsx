import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../api/axios';
import { formatDate } from '../utils/formatters';

export default function FollowUps() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: 'pending', date: '' });
  const load = () => { setLoading(true); api.get('/follow-ups', { params: filter }).then(r => setList(r.data)).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const complete = async (id) => {
    await api.put(`/follow-ups/${id}`, { status:'completed', completed_at: new Date().toISOString().slice(0,10) });
    toast.success('Follow-up completed'); load();
  };

  return (
    <div>
      <div className="page-header"><h2>📅 Follow-ups</h2></div>
      <div className="table-card">
        <div className="p-3 border-bottom d-flex gap-2">
          <input type="date" className="form-control form-control-sm" style={{ maxWidth:150 }} value={filter.date} onChange={e => setFilter({...filter, date:e.target.value})} />
          <select className="form-select form-select-sm" style={{ maxWidth:130 }} value={filter.status} onChange={e => setFilter({...filter, status:e.target.value})}>
            <option value="">All</option><option value="pending">Pending</option><option value="completed">Completed</option>
          </select>
          <button className="btn btn-sm btn-primary" onClick={load}>Filter</button>
        </div>
        {loading ? <div className="text-center py-4"><div className="spinner-border spinner-border-sm" /></div> : (
          <table className="table table-hover mb-0">
            <thead><tr><th>Customer</th><th>Phone</th><th>Follow-up Date</th><th>Notes</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {list.map(fu => (
                <tr key={fu.id}>
                  <td className="fw-semibold">{fu.customer?.name}</td>
                  <td>{fu.customer?.phone}</td>
                  <td className={new Date(fu.follow_up_date + 'T00:00:00') < new Date() && fu.status === 'pending' ? 'text-danger fw-bold' : ''}>{formatDate(fu.follow_up_date)}</td>
                  <td>{fu.notes || '—'}</td>
                  <td><span className={`badge ${fu.status==='completed'?'bg-success':fu.status==='cancelled'?'bg-secondary':'bg-warning text-dark'}`}>{fu.status}</span></td>
                  <td>{fu.status === 'pending' && <button className="btn btn-xs btn-success" style={{ padding:'2px 8px', fontSize:'0.78rem' }} onClick={() => complete(fu.id)}>✓ Done</button>}</td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={6} className="text-center py-4 text-muted">No follow-ups</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
