import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import pinGate from '../utils/pinGate';
import { toast } from 'react-toastify';
import api from '../api/axios';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name:'', phone:'', email:'', address:'', voucher_code:'', category: 'REGULAR', opening_balance: 0, balance_type: 'RECEIVABLE', gst_no: '', events: [] });
  const [editId, setEditId] = useState(null);
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    api.get('/customers', { params: { search } }).then(r => setCustomers(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [search]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editId) { await api.put(`/customers/${editId}`, form); toast.success('Updated'); }
      else { await api.post('/customers', form); toast.success('Customer added'); }
      setShowForm(false); setEditId(null); setForm({ name:'', phone:'', email:'', address:'', voucher_code:'', category: 'REGULAR', opening_balance: 0, balance_type: 'RECEIVABLE', gst_no: '', events: [] }); load();
    } catch(e) { toast.error(e.response?.data?.message || 'Error'); }
  };

  const handleDelete = async (id) => {
    if (!await pinGate.confirm()) return;
    try {
      await api.delete(`/customers/${id}`);
      toast.success('Customer deleted');
      load();
    } catch(e) { toast.error(e.response?.data?.message || 'Error deleting'); }
  };

  return (
    <div>
      <div className="page-header">
        <h2>👥 Customers</h2>
      </div>

      <div className="table-card">
        <div className="p-3 border-bottom">
          <input className="form-control form-control-sm" style={{ maxWidth:260 }} placeholder="Search name or phone..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {loading ? <div className="text-center py-4"><div className="spinner-border spinner-border-sm" /></div> : (
          <table className="table table-hover mb-0">
            <thead><tr><th>#</th><th>Name</th><th>Phone</th><th>Last Activity</th><th>Event Details</th><th>Voucher</th><th>Actions</th></tr></thead>
            <tbody>
              {customers.map((c, i) => (
                <tr key={c.id}>
                  <td className="text-muted" style={{ fontSize:'0.8rem' }}>{i+1}</td>
                  <td className="fw-semibold">{c.name}</td>
                  <td>{c.phone}</td>
                  <td>
                    {c.last_action ? (
                       <div className="d-flex flex-column">
                          <span className="badge bg-secondary text-uppercase x-small">{c.last_action}</span>
                          <span className="x-small text-muted mt-1">{new Date(c.last_action_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                       </div>
                    ) : '—'}
                  </td>
                  <td>
                    {c.events && c.events.length > 0 ? (
                      <div className="d-flex flex-column gap-1">
                        {c.events.map((ev, i) => (
                          <div key={i} className="x-small border-bottom pb-1 mb-1">
                            <span className="badge bg-light text-dark text-uppercase border me-1">{ev.type === 'other' ? ev.name : ev.type}</span>
                            <span className="text-muted fw-bold">{new Date(ev.date).toLocaleDateString('en-GB', { day:'2-digit', month:'short' })}</span>
                          </div>
                        ))}
                      </div>
                    ) : '—'}
                  </td>
                  <td>{c.voucher_code ? <code className="text-primary">{c.voucher_code}</code> : '—'}</td>
                  <td>
                    <button className="btn btn-xs btn-outline-info me-1" style={{ fontSize:'0.75rem', padding:'2px 8px' }} onClick={() => navigate(`/customer/profile/${c.id}`)}>History</button>
                  </td>
                </tr>
              ))}
              {customers.length === 0 && <tr><td colSpan={7} className="text-center text-muted py-4">No customers</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
