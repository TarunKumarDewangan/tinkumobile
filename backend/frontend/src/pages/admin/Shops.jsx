import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../../api/axios';

export default function Shops() {
  const [shops, setShops] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name:'', address:'', phone:'', email:'' });

  const load = () => api.get('/shops').then(r => setShops(r.data));
  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try { await api.post('/shops', form); toast.success('Shop created'); setShowForm(false); load(); }
    catch(e) { toast.error(e.response?.data?.message || 'Error'); }
  };

  return (
    <div>
      <div className="page-header">
        <h2>🏪 Shops</h2>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>+ Add Shop</button>
      </div>
      {showForm && (
        <div className="table-card p-4 mb-3">
          <form onSubmit={handleSubmit}>
            <div className="row g-3">
              <div className="col-md-3"><input className="form-control" placeholder="Shop Name *" required value={form.name} onChange={e => setForm({...form, name:e.target.value})} /></div>
              <div className="col-md-3"><input className="form-control" placeholder="Phone *" required value={form.phone} onChange={e => setForm({...form, phone:e.target.value})} /></div>
              <div className="col-md-3"><input className="form-control" placeholder="Email" value={form.email} onChange={e => setForm({...form, email:e.target.value})} /></div>
              <div className="col-md-3"><input className="form-control" placeholder="Address *" required value={form.address} onChange={e => setForm({...form, address:e.target.value})} /></div>
            </div>
            <div className="mt-3 d-flex gap-2">
              <button type="submit" className="btn btn-primary btn-sm">Create Shop</button>
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}
      <div className="row g-3">
        {shops.map(s => (
          <div key={s.id} className="col-md-4">
            <div className="table-card p-4">
              <div className="d-flex justify-content-between align-items-start mb-2">
                <h6 className="fw-bold mb-0">{s.name}</h6>
                {s.is_main && <span className="badge bg-primary">Main</span>}
              </div>
              <div className="text-muted" style={{ fontSize:'0.85rem' }}>
                <div>📞 {s.phone}</div>
                <div>📧 {s.email || '—'}</div>
                <div>📍 {s.address}</div>
              </div>
            </div>
          </div>
        ))}
        {shops.length === 0 && <div className="col"><div className="table-card p-4 text-center text-muted">No shops</div></div>}
      </div>
    </div>
  );
}
