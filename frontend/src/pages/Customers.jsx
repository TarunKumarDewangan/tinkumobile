import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../api/axios';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name:'', phone:'', email:'', address:'', voucher_code:'', events: [] });
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
      setShowForm(false); setEditId(null); setForm({ name:'', phone:'', email:'', address:'', voucher_code:'', events: [] }); load();
    } catch(e) { toast.error(e.response?.data?.message || 'Error'); }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this customer?')) {
      try {
        await api.delete(`/customers/${id}`);
        toast.success('Customer deleted');
        load();
      } catch(e) { toast.error(e.response?.data?.message || 'Error deleting'); }
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>👥 Customers</h2>
        <button className="btn btn-primary btn-sm" onClick={() => { setShowForm(true); setEditId(null); setForm({ name:'', phone:'', email:'', address:'', voucher_code:'', events: [] }); }}>+ Add Customer</button>
      </div>

      {showForm && (
        <div className="table-card p-4 mb-3">
          <form onSubmit={handleSubmit}>
            <div className="row g-3">
              <div className="col-md-3"><label className="x-small fw-bold text-uppercase opacity-50">Name *</label><input className="form-control" placeholder="Name *" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
              <div className="col-md-3"><label className="x-small fw-bold text-uppercase opacity-50">Phone *</label><input className="form-control" placeholder="Phone *" required value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
              <div className="col-md-3"><label className="x-small fw-bold text-uppercase opacity-50">Email</label><input className="form-control" placeholder="Email" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
              <div className="col-md-3"><label className="x-small fw-bold text-uppercase opacity-50">Address</label><input className="form-control" placeholder="Address" value={form.address} onChange={e => setForm({...form, address: e.target.value})} /></div>
              <div className="col-md-3"><label className="x-small fw-bold text-uppercase opacity-50">Voucher Code</label><input className="form-control" placeholder="Voucher Code" value={form.voucher_code} onChange={e => setForm({...form, voucher_code: e.target.value})} /></div>
            </div>

            <div className="mt-4">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h6 className="mb-0 text-uppercase fw-bold text-muted" style={{fontSize:'0.75rem'}}>📅 Customer Events</h6>
                <button type="button" className="btn btn-xs btn-outline-info text-uppercase" onClick={() => setForm({...form, events: [...form.events, { type:'', name:'', date:'' }]})}>+ Add Event</button>
              </div>
              <div className="row g-2">
                {form.events.map((ev, idx) => (
                  <div key={idx} className="col-12 p-3 bg-light rounded shadow-sm border mb-2">
                    <div className="row g-2 align-items-center">
                      <div className="col-md-3">
                        <select className="form-select form-select-sm" value={ev.type} onChange={e => {
                          const newEvents = [...form.events];
                          newEvents[idx].type = e.target.value;
                          setForm({...form, events: newEvents});
                        }}>
                          <option value="">Select Type</option>
                          <option value="dob">DOB</option>
                          <option value="anniversary">Anniversary</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      {ev.type === 'other' && (
                        <div className="col-md-3">
                          <input className="form-control form-control-sm" placeholder="Event Name" value={ev.name} onChange={e => {
                            const newEvents = [...form.events];
                            newEvents[idx].name = e.target.value;
                            setForm({...form, events: newEvents});
                          }} />
                        </div>
                      )}
                      <div className="col-md-3">
                        <input className="form-control form-control-sm" type="date" value={ev.date} onChange={e => {
                          const newEvents = [...form.events];
                          newEvents[idx].date = e.target.value;
                          setForm({...form, events: newEvents});
                        }} />
                      </div>
                      <div className="col-md-1">
                        <button type="button" className="btn btn-link text-danger p-0" onClick={() => {
                          const newEvents = form.events.filter((_, i) => i !== idx);
                          setForm({...form, events: newEvents});
                        }}>Remove</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-3 d-flex gap-2">
              <button type="submit" className="btn btn-primary btn-sm">Save</button>
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

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
                    <button className="btn btn-xs btn-outline-primary me-1" style={{ fontSize:'0.75rem', padding:'2px 8px' }} onClick={() => { setEditId(c.id); setForm({ ...c, events: c.events || [] }); setShowForm(true); }}>Edit</button>
                    <button className="btn btn-xs btn-outline-danger" style={{ fontSize:'0.75rem', padding:'2px 8px' }} onClick={() => handleDelete(c.id)}>Delete</button>
                  </td>
                </tr>
              ))}
              {customers.length === 0 && <tr><td colSpan={6} className="text-center text-muted py-4">No customers</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
