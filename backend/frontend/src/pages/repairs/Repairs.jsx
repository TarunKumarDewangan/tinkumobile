import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import { formatDate } from '../../utils/formatters';

const STATUS_COLORS = { pending:'warning', assigned:'info', in_progress:'primary', completed:'success', delivered:'secondary' };

export default function Repairs() {
  const [repairs, setRepairs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  const load = () => {
    setLoading(true);
    api.get('/repairs', { params: { status: statusFilter } }).then(r => setRepairs(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [statusFilter]);

  const updateStatus = async (id, status) => {
    await api.put(`/repairs/${id}`, { status });
    toast.success('Status updated');
    load();
  };

  return (
    <div>
      <div className="page-header">
        <h2>🔧 Repairs</h2>
        <Link to="/repairs/new" className="btn btn-primary btn-sm">+ New Repair</Link>
      </div>
      <div className="table-card">
        <div className="p-3 border-bottom d-flex gap-2">
          <select className="form-select form-select-sm" style={{ maxWidth:160 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="delivered">Delivered</option>
          </select>
        </div>
        {loading ? <div className="text-center py-4"><div className="spinner-border spinner-border-sm" /></div> : (
          <table className="table table-hover mb-0">
            <thead><tr><th>#</th><th>Customer</th><th>Device</th><th>Issue</th><th>Status</th><th>Est. Delivery</th><th>Actions</th></tr></thead>
            <tbody>
              {repairs.map(r => (
                <tr key={r.id}>
                  <td className="text-muted">{r.id}</td>
                  <td><div className="fw-semibold">{r.customer_name}</div><div className="text-muted" style={{ fontSize:'0.8rem' }}>{r.customer_phone}</div></td>
                  <td>{r.device_model}</td>
                  <td style={{ maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.issue_description}</td>
                  <td><span className={`badge bg-${STATUS_COLORS[r.status] || 'secondary'}`}>{r.status}</span></td>
                  <td className={r.estimated_delivery_date && !r.actual_delivery_date && new Date(r.estimated_delivery_date) < new Date() ? 'text-danger fw-bold' : ''}>
                    {formatDate(r.estimated_delivery_date)}
                  </td>
                  <td>
                    <select className="form-select form-select-sm d-inline" style={{ width:'auto', fontSize:'0.78rem' }}
                      value={r.status} onChange={e => updateStatus(r.id, e.target.value)}>
                      <option value="pending">Pending</option>
                      <option value="assigned">Assigned</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="delivered">Delivered</option>
                    </select>
                  </td>
                </tr>
              ))}
              {repairs.length === 0 && <tr><td colSpan={7} className="text-center text-muted py-4">No repair requests</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
