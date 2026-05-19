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
        <button className="btn btn-primary btn-sm" onClick={() => { setShowForm(true); setEditId(null); setForm({ name:'', phone:'', email:'', address:'', voucher_code:'', category:'REGULAR', events: [] }); }}>+ Add Customer</button>
      </div>

      {showForm && (
        <div className="modal fade show d-block text-uppercase" style={{ backgroundColor: 'rgba(0, 0, 0, 0.55)', zIndex: 1050 }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '12px', overflow: 'hidden' }}>
              
              {/* Modal Header */}
              <div className="modal-header d-flex justify-content-between align-items-center text-white p-3 shadow-sm" style={{ background: '#6f42c1', borderBottom: 'none' }}>
                <h5 className="modal-title fw-bold text-uppercase m-0 d-flex align-items-center gap-2" style={{ fontSize: '1.05rem', letterSpacing: '0.5px' }}>
                  {editId ? '✏️ Edit Customer' : '➕ Add New Customer'}
                </h5>
                <button 
                  type="button" 
                  className="btn-close btn-close-white shadow-none border-0 bg-transparent text-white fw-bold" 
                  onClick={() => { setShowForm(false); setEditId(null); }}
                  style={{ fontSize: '1.5rem', cursor: 'pointer', outline: 'none' }}
                >
                  &times;
                </button>
              </div>

              {/* Modal Form */}
              <form onSubmit={handleSubmit}>
                <div className="modal-body p-4" style={{ background: '#ffffff', maxHeight: '75vh', overflowY: 'auto' }}>
                  <div className="row g-3">
                    
                    {/* Full Name */}
                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-dark mb-1">Full Name <span className="text-danger">*</span></label>
                      <input 
                        type="text" 
                        className="form-control fw-semibold" 
                        placeholder="Full Name" 
                        required 
                        value={form.name} 
                        onChange={e => setForm({...form, name: e.target.value.toUpperCase()})} 
                        style={{ border: '1px solid #ced4da', borderRadius: '6px', padding: '0.6rem 0.75rem' }}
                      />
                    </div>

                    {/* Phone Number */}
                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-dark mb-1">Phone Number <span className="text-danger">*</span></label>
                      <input 
                        type="text" 
                        className="form-control fw-semibold" 
                        placeholder="Phone Number" 
                        required 
                        value={form.phone} 
                        onChange={e => setForm({...form, phone: e.target.value})} 
                        style={{ border: '1px solid #ced4da', borderRadius: '6px', padding: '0.6rem 0.75rem' }}
                      />
                    </div>

                    {/* Email */}
                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-dark mb-1">Email</label>
                      <input 
                        type="email" 
                        className="form-control fw-semibold" 
                        placeholder="Email" 
                        value={form.email || ''} 
                        onChange={e => setForm({...form, email: e.target.value})} 
                        style={{ border: '1px solid #ced4da', borderRadius: '6px', padding: '0.6rem 0.75rem' }}
                      />
                    </div>

                    {/* Voucher Code */}
                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-dark mb-1">Voucher Code</label>
                      <input 
                        type="text" 
                        className="form-control fw-semibold text-primary" 
                        placeholder="Voucher Code" 
                        value={form.voucher_code || ''} 
                        onChange={e => setForm({...form, voucher_code: e.target.value.toUpperCase()})} 
                        style={{ border: '1px solid #ced4da', borderRadius: '6px', padding: '0.6rem 0.75rem' }}
                      />
                    </div>

                    {/* Customer Type */}
                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-dark mb-1">Customer Type <span className="text-danger">*</span></label>
                      <select 
                        className="form-select fw-semibold" 
                        value={form.category || 'REGULAR'} 
                        onChange={e => setForm({...form, category: e.target.value})}
                        style={{ border: '1px solid #ced4da', borderRadius: '6px', padding: '0.6rem 0.75rem' }}
                      >
                        <option value="REGULAR">NORMAL CUSTOMER</option>
                        <option value="SHOP">SHOP CUSTOMER</option>
                      </select>
                    </div>

                    {/* Address */}
                    <div className="col-12">
                      <label className="form-label small fw-bold text-dark mb-1">Address</label>
                      <textarea 
                        className="form-control fw-semibold" 
                        placeholder="Address" 
                        rows="2"
                        value={form.address || ''} 
                        onChange={e => setForm({...form, address: e.target.value.toUpperCase()})} 
                        style={{ border: '1px solid #ced4da', borderRadius: '6px', padding: '0.6rem 0.75rem', resize: 'none' }}
                      />
                    </div>

                  </div>

                  {/* Customer Events Section */}
                  <div className="mt-4 pt-3 border-top">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <h6 className="mb-0 fw-bold text-dark d-flex align-items-center gap-2" style={{ fontSize: '0.9rem' }}>
                        🎂 Customer Events
                      </h6>
                      <button 
                        type="button" 
                        className="btn btn-sm btn-outline-primary fw-bold" 
                        onClick={() => setForm({...form, events: [...form.events, { type: '', name: '', date: '' }]})}
                        style={{ fontSize: '0.75rem', borderRadius: '6px', padding: '4px 12px' }}
                      >
                        + Add Event
                      </button>
                    </div>
                    <p className="text-muted x-small text-uppercase mb-3 fw-semibold" style={{ letterSpacing: '0.5px', fontSize: '0.7rem' }}>
                      Click "+ Add Event" to track birthdays, etc.
                    </p>

                    <div className="row g-2">
                      {form.events.map((ev, idx) => (
                        <div key={idx} className="col-12 p-3 bg-light rounded border mb-2">
                          <div className="row g-2 align-items-center">
                            
                            {/* Event Type */}
                            <div className="col-md-4">
                              <select 
                                className="form-select form-select-sm fw-semibold" 
                                value={ev.type} 
                                onChange={e => {
                                  const newEvents = [...form.events];
                                  newEvents[idx].type = e.target.value;
                                  setForm({...form, events: newEvents});
                                }}
                                style={{ borderRadius: '4px' }}
                              >
                                <option value="">Select Type</option>
                                <option value="dob">DOB</option>
                                <option value="anniversary">Anniversary</option>
                                <option value="other">Other</option>
                              </select>
                            </div>

                            {/* Event Custom Name */}
                            {ev.type === 'other' && (
                              <div className="col-md-3">
                                <input 
                                  className="form-control form-control-sm fw-semibold" 
                                  placeholder="Event Name" 
                                  value={ev.name || ''} 
                                  onChange={e => {
                                    const newEvents = [...form.events];
                                    newEvents[idx].name = e.target.value.toUpperCase();
                                    setForm({...form, events: newEvents});
                                  }}
                                  style={{ borderRadius: '4px' }}
                                />
                              </div>
                            )}

                            {/* Event Date */}
                            <div className={`col-md-${ev.type === 'other' ? '4' : '7'}`}>
                              <input 
                                className="form-control form-control-sm fw-semibold" 
                                type="date" 
                                value={ev.date} 
                                onChange={e => {
                                  const newEvents = [...form.events];
                                  newEvents[idx].date = e.target.value;
                                  setForm({...form, events: newEvents});
                                }}
                                style={{ borderRadius: '4px' }}
                              />
                            </div>

                            {/* Remove Event Button */}
                            <div className="col-md-1 text-end">
                              <button 
                                type="button" 
                                className="btn btn-sm btn-link text-danger p-0 fw-bold text-decoration-none" 
                                onClick={() => {
                                  const newEvents = form.events.filter((_, i) => i !== idx);
                                  setForm({...form, events: newEvents});
                                }}
                                style={{ fontSize: '0.8rem' }}
                              >
                                Remove
                              </button>
                            </div>

                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="modal-footer p-3 bg-light d-flex justify-content-end gap-2 border-top">
                  <button 
                    type="button" 
                    className="btn btn-secondary text-uppercase fw-bold shadow-none" 
                    onClick={() => { setShowForm(false); setEditId(null); }}
                    style={{ fontSize: '0.75rem', padding: '0.6rem 1.5rem', borderRadius: '6px', background: '#6c757d', border: 'none' }}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary text-uppercase fw-bold shadow-none" 
                    style={{ fontSize: '0.75rem', padding: '0.6rem 1.5rem', borderRadius: '6px', background: '#6f42c1', border: 'none' }}
                  >
                    {editId ? 'Update Customer' : 'Create Customer'}
                  </button>
                </div>

              </form>

            </div>
          </div>
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
                    <button className="btn btn-xs btn-outline-primary me-1" style={{ fontSize:'0.75rem', padding:'2px 8px' }} onClick={() => { setEditId(c.id); setForm({ ...c, events: c.events || [], category: c.category || 'REGULAR' }); setShowForm(true); }}>Edit</button>
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
