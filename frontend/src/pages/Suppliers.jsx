import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../api/axios';

export default function Suppliers() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name:'', phone:'', address:'', is_online_shop:false });
  const [editId, setEditId] = useState(null);

  const load = () => { setLoading(true); api.get('/suppliers').then(r => setList(r.data)).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editId) { await api.put(`/suppliers/${editId}`, form); toast.success('Updated'); }
    else { await api.post('/suppliers', form); toast.success('Supplier added'); }
    setShowForm(false); setEditId(null); setForm({ name:'', phone:'', address:'', is_online_shop:false }); load();
  };

  return (
    <div>
      <div className="page-header">
        <h2>🏭 Suppliers</h2>
        <button className="btn btn-primary btn-sm" onClick={() => { setShowForm(true); setEditId(null); }}>+ Add</button>
      </div>
      {showForm && (
        <div className="table-card p-4 mb-3">
          <form onSubmit={handleSubmit}>
            <div className="row g-3">
              <div className="col-md-4"><input className="form-control" placeholder="Name *" required value={form.name} onChange={e => setForm({...form, name:e.target.value})} /></div>
              <div className="col-md-4"><input className="form-control" placeholder="Phone *" required value={form.phone} onChange={e => setForm({...form, phone:e.target.value})} /></div>
              <div className="col-md-4"><input className="form-control" placeholder="Address *" required value={form.address} onChange={e => setForm({...form, address:e.target.value})} /></div>
              <div className="col-md-4 d-flex align-items-center">
                <div className="form-check form-switch ms-2">
                  <input className="form-check-input" type="checkbox" id="isOnlineShop" checked={form.is_online_shop} onChange={e => setForm({...form, is_online_shop:e.target.checked})} />
                  <label className="form-check-label" htmlFor="isOnlineShop">Online Shop? (e.g. Flipkart/Amazon)</label>
                </div>
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
        {loading ? <div className="text-center py-4"><div className="spinner-border spinner-border-sm" /></div> : (
          <table className="table table-hover mb-0">
            <thead><tr><th>#</th><th>Name</th><th>Phone</th><th>Address</th><th>Type</th><th>Actions</th></tr></thead>
            <tbody>
              {list.map((s, i) => (
                <tr key={s.id}>
                  <td>{i+1}</td>
                  <td className="fw-semibold">
                    {s.name}
                    {s.is_online_shop && <span className="ms-2 badge bg-info-subtle text-info border border-info-subtle" style={{fontSize: '0.65rem'}}>Online Shop</span>}
                  </td>
                  <td>{s.phone}</td>
                  <td>{s.address}</td>
                  <td>{s.is_online_shop ? '🌐 Online' : '🏠 Local'}</td>
                  <td><button className="btn btn-xs btn-outline-primary" style={{ fontSize:'0.75rem', padding:'2px 8px' }} onClick={() => { setEditId(s.id); setForm(s); setShowForm(true); }}>Edit</button></td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={5} className="text-center py-4 text-muted">No suppliers</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
