import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../api/axios';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name:'', phone:'', email:'', address:'' });
  const [editId, setEditId] = useState(null);

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
      setShowForm(false); setEditId(null); setForm({ name:'', phone:'', email:'', address:'' }); load();
    } catch(e) { toast.error(e.response?.data?.message || 'Error'); }
  };

  return (
    <div>
      <div className="page-header">
        <h2>👥 Customers</h2>
        <button className="btn btn-primary btn-sm" onClick={() => { setShowForm(true); setEditId(null); setForm({ name:'', phone:'', email:'', address:'' }); }}>+ Add Customer</button>
      </div>

      {showForm && (
        <div className="table-card p-4 mb-3">
          <form onSubmit={handleSubmit}>
            <div className="row g-3">
              <div className="col-md-3"><input className="form-control" placeholder="Name *" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
              <div className="col-md-3"><input className="form-control" placeholder="Phone *" required value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
              <div className="col-md-3"><input className="form-control" placeholder="Email" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
              <div className="col-md-3"><input className="form-control" placeholder="Address" value={form.address} onChange={e => setForm({...form, address: e.target.value})} /></div>
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
            <thead><tr><th>#</th><th>Name</th><th>Phone</th><th>Email</th><th>Address</th><th>Actions</th></tr></thead>
            <tbody>
              {customers.map((c, i) => (
                <tr key={c.id}>
                  <td className="text-muted" style={{ fontSize:'0.8rem' }}>{i+1}</td>
                  <td className="fw-semibold">{c.name}</td>
                  <td>{c.phone}</td>
                  <td>{c.email || '—'}</td>
                  <td>{c.address || '—'}</td>
                  <td>
                    <button className="btn btn-xs btn-outline-primary me-1" style={{ fontSize:'0.75rem', padding:'2px 8px' }} onClick={() => { setEditId(c.id); setForm(c); setShowForm(true); }}>Edit</button>
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
