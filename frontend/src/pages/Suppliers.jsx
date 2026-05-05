import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../api/axios';

export default function Suppliers() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name:'', phone:'', address:'', gst_no:'', is_online_shop:false });
  const [editId, setEditId] = useState(null);

  const load = () => { 
    setLoading(true); 
    api.get('/suppliers')
      .then(r => setList(r.data))
      .catch(() => toast.error('Failed to load suppliers'))
      .finally(() => setLoading(false)); 
  };
  
  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editId) { 
        await api.put(`/suppliers/${editId}`, form); 
        toast.success('Supplier updated successfully'); 
      } else { 
        await api.post('/suppliers', form); 
        toast.success('New supplier added'); 
      }
      setShowForm(false); 
      setEditId(null); 
      setForm({ name:'', phone:'', address:'', gst_no:'', is_online_shop:false }); 
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error saving supplier');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this supplier?')) return;
    try {
      await api.delete(`/suppliers/${id}`);
      toast.success('Supplier deleted');
      load();
    } catch (err) {
      toast.error('Failed to delete supplier');
    }
  };

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="h4 mb-1 text-uppercase fw-bold text-primary">🏭 Suppliers</h2>
          <p className="text-muted small mb-0">Manage your inventory sources and supplier details</p>
        </div>
        <button className="btn btn-primary shadow-sm px-4 fw-bold" onClick={() => { setShowForm(true); setEditId(null); setForm({ name:'', phone:'', address:'', gst_no:'', is_online_shop:false }); }}>
          + Add New Supplier
        </button>
      </div>

      {showForm && (
        <div className="card shadow-sm border-0 mb-4 overflow-hidden" style={{ borderRadius: '15px' }}>
          <div className="card-header bg-primary bg-opacity-10 border-0 py-3">
            <h5 className="mb-0 text-primary fw-bold small text-uppercase">
              {editId ? '📝 Edit Supplier' : '➕ Add New Supplier'}
            </h5>
          </div>
          <div className="card-body p-4">
            <form onSubmit={handleSubmit}>
              <div className="row g-4">
                <div className="col-md-4">
                  <label className="form-label small fw-bold text-muted text-uppercase">Supplier Name *</label>
                  <input className="form-control shadow-none border-light-subtle" required value={form.name} onChange={e => setForm({...form, name:e.target.value})} placeholder="e.g. Acme Mobiles" />
                </div>
                <div className="col-md-4">
                  <label className="form-label small fw-bold text-muted text-uppercase">Phone Number *</label>
                  <input className="form-control shadow-none border-light-subtle" required value={form.phone} onChange={e => setForm({...form, phone:e.target.value})} placeholder="e.g. 9876543210" />
                </div>
                <div className="col-md-4">
                  <label className="form-label small fw-bold text-muted text-uppercase">GST Number</label>
                  <input className="form-control shadow-none border-light-subtle text-uppercase" value={form.gst_no || ''} onChange={e => setForm({...form, gst_no:e.target.value})} placeholder="22AAAAA0000A1Z5" />
                </div>
                <div className="col-md-8">
                  <label className="form-label small fw-bold text-muted text-uppercase">Full Address *</label>
                  <input className="form-control shadow-none border-light-subtle" required value={form.address} onChange={e => setForm({...form, address:e.target.value})} placeholder="Street, City, State, ZIP" />
                </div>
                <div className="col-md-4">
                  <label className="form-label small fw-bold text-muted text-uppercase">Supplier Type</label>
                  <div className="form-check form-switch mt-2">
                    <input className="form-check-input" type="checkbox" id="isOnlineShop" checked={form.is_online_shop} onChange={e => setForm({...form, is_online_shop:e.target.checked})} />
                    <label className="form-check-label fw-semibold text-dark ms-2" htmlFor="isOnlineShop" style={{ fontSize: '0.85rem' }}>
                      Online Shop? <span className="text-muted fw-normal">(Amazon, Flipkart etc.)</span>
                    </label>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-3 border-top d-flex gap-2">
                <button type="submit" className="btn btn-primary px-5 fw-bold shadow-sm">Save Supplier</button>
                <button type="button" className="btn btn-light px-4 text-muted" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card shadow-sm border-0 overflow-hidden" style={{ borderRadius: '15px' }}>
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="bg-light">
              <tr className="text-uppercase small fw-bold text-muted" style={{ letterSpacing: '0.5px' }}>
                <th className="ps-4 py-3">#</th>
                <th className="py-3">Supplier Info</th>
                <th className="py-3">GST No</th>
                <th className="py-3">Address</th>
                <th className="py-3">Type</th>
                <th className="text-end pe-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-5">
                    <div className="spinner-border text-primary pulse-animation" style={{ width: '1.5rem', height: '1.5rem' }} />
                  </td>
                </tr>
              ) : list.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-5 text-muted small italic">No suppliers found. Click + Add to create one.</td>
                </tr>
              ) : (
                list.map((s, i) => (
                  <tr key={s.id} className="transition-all">
                    <td className="ps-4 small text-muted">{i+1}</td>
                    <td>
                      <div className="fw-bold text-dark">{s.name}</div>
                      <div className="small text-muted d-flex align-items-center gap-1">
                        <i className="bi bi-telephone-fill" style={{ fontSize: '0.7rem' }}></i> {s.phone}
                      </div>
                    </td>
                    <td>
                      {s.gst_no ? (
                        <span className="badge bg-light text-dark border fw-semibold font-monospace" style={{ fontSize: '0.75rem' }}>{s.gst_no}</span>
                      ) : (
                        <span className="text-muted opacity-25">—</span>
                      )}
                    </td>
                    <td className="small text-muted text-truncate" style={{ maxWidth: '250px' }}>{s.address}</td>
                    <td>
                      {s.is_online_shop ? (
                        <span className="badge bg-info-subtle text-info border border-info-subtle px-3 py-1 rounded-pill" style={{ fontSize: '0.65rem' }}>
                          🌐 ONLINE
                        </span>
                      ) : (
                        <span className="badge bg-success-subtle text-success border border-success-subtle px-3 py-1 rounded-pill" style={{ fontSize: '0.65rem' }}>
                          🏠 LOCAL
                        </span>
                      )}
                    </td>
                    <td className="text-end pe-4">
                      <div className="d-flex justify-content-end gap-2">
                        <button 
                          className="btn btn-sm btn-outline-primary border-0 bg-primary bg-opacity-10" 
                          style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                          onClick={() => { setEditId(s.id); setForm(s); setShowForm(true); }}
                        >
                          Edit
                        </button>
                        <button 
                          className="btn btn-sm btn-outline-danger border-0 bg-danger bg-opacity-10" 
                          style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                          onClick={() => handleDelete(s.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      <style>{`
        .transition-all { transition: all 0.2s ease-in-out; }
        .table-hover tbody tr:hover { background-color: rgba(99, 102, 241, 0.03); transform: scale(1.002); }
        .font-monospace { font-family: 'JetBrains Mono', 'Courier New', monospace; }
      `}</style>
    </div>
  );
}

