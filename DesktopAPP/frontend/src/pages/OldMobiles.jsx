import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../api/axios';
import { formatDate } from '../utils/formatters';
import Modal from '../components/Modal';

export default function OldMobiles() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // CRUD States
  const [viewingItem, setViewingItem] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [editForm, setEditForm] = useState({
    customer_name: '',
    customer_phone: '',
    model_name: '',
    imei: '',
    purchase_price: '',
    selling_price: '',
    is_exchange: true,
    ram: '',
    storage: '',
    color: '',
    condition_note: '',
    purchase_date: ''
  });

  const loadList = () => {
    setLoading(true);
    api.get('/old-mobiles')
      .then(r => setList(r.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadList();
  }, []);

  const handleDelete = async (id) => {
    const pin = window.prompt("Enter Admin PIN to Delete:");
    if (pin !== '71727378') {
      toast.error("Incorrect PIN");
      return;
    }
    if (!window.confirm("Are you sure you want to delete this purchase? Reverting stock & transaction...")) return;
    try {
      await api.delete(`/old-mobiles/${id}`);
      toast.success("Old mobile purchase deleted successfully");
      loadList();
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to delete old mobile purchase");
    }
  };

  const handleEditClick = (item) => {
    const pin = window.prompt("Enter Admin PIN to Edit:");
    if (pin !== '71727378') {
      toast.error("Incorrect PIN");
      return;
    }
    setEditingItem(item);
    setEditForm({
      customer_name: item.customer?.name || item.customer_name || '',
      customer_phone: item.customer?.phone || item.customer_phone || '',
      model_name: item.model_name || '',
      imei: item.imei || '',
      purchase_price: item.purchase_price || '',
      selling_price: item.selling_price || '',
      is_exchange: item.is_exchange ?? true,
      ram: item.ram || '',
      storage: item.storage || '',
      color: item.color || '',
      condition_note: item.condition_note || '',
      purchase_date: item.purchase_date ? item.purchase_date.split('T')[0] : ''
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/old-mobiles/${editingItem.id}`, editForm);
      toast.success("Old mobile purchase updated successfully");
      setEditingItem(null);
      loadList();
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to update old mobile purchase");
    }
  };

  return (
    <div className="container-fluid px-4 py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1 text-dark d-flex align-items-center gap-2">
            <span>📲</span> Old Mobile Purchases
          </h2>
          <p className="text-muted mb-0">Track and manage second-hand mobile devices acquired from customers.</p>
        </div>
        <button 
          onClick={() => navigate('/old-mobiles/new')}
          className="btn btn-primary d-flex align-items-center gap-2 px-4 py-2 shadow-sm rounded-pill hover-scale"
        >
          <span>➕</span> Record Purchase / Exchange
        </button>
      </div>

      <div className="card border-0 bg-white shadow-sm rounded-4 border-secondary-subtle overflow-hidden">
        {loading ? (
          <div className="d-flex justify-content-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th className="py-3 px-4 text-muted">Date</th>
                  <th className="py-3 text-muted">Customer (Seller)</th>
                  <th className="py-3 text-muted">Model Details</th>
                  <th className="py-3 text-muted">IMEI</th>
                  <th className="py-3 text-muted">Purchase Value</th>
                  <th className="py-3 text-muted">Type</th>
                  <th className="py-3 text-muted">Specs & Cond</th>
                  <th className="py-3 text-muted">Resale Target</th>
                  <th className="py-3 text-muted">Staff</th>
                  <th className="py-3 px-4 text-muted text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map(m => (
                  <tr key={m.id}>
                    <td className="py-3 px-4 text-muted">{formatDate(m.purchase_date)}</td>
                    <td className="py-3">
                      <div className="fw-bold text-dark">{m.customer?.name}</div>
                      <small className="text-muted">{m.customer?.phone}</small>
                    </td>
                    <td className="py-3">
                      <span className="fw-semibold text-dark">{m.model_name}</span>
                    </td>
                    <td className="py-3">
                      {m.imei ? (
                        <code className="text-primary">
                          <Link to={`/old-mobiles/sales/new?category=mobile-old&imei=${m.imei}`} style={{color: 'inherit', textDecoration: 'underline'}} title="Click to create sale for this set">{m.imei}</Link>
                        </code>
                      ) : '—'}
                    </td>
                    <td className="py-3 fw-bold text-success">
                      ₹{parseFloat(m.purchase_price).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3">
                      {m.is_exchange ? (
                        <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-3 py-1">
                          🔄 Exchange
                        </span>
                      ) : (
                        <span className="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill px-3 py-1">
                          💵 Cash Payout
                        </span>
                      )}
                    </td>
                    <td className="py-3">
                      <div className="d-flex gap-1 flex-wrap mb-1">
                        {m.ram && <span className="badge bg-secondary rounded-pill text-xs">{m.ram} RAM</span>}
                        {m.storage && <span className="badge bg-secondary rounded-pill text-xs">{m.storage} ROM</span>}
                        {m.color && <span className="badge bg-dark rounded-pill text-xs">{m.color}</span>}
                      </div>
                      <small className="text-muted text-truncate d-inline-block" style={{maxWidth: '150px'}} title={m.condition_note}>
                        {m.condition_note || 'No notes'}
                      </small>
                    </td>
                    <td className="py-3 fw-bold text-warning">
                      {parseFloat(m.selling_price) > 0 ? `₹${parseFloat(m.selling_price).toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="py-3 text-muted">{m.user?.name}</td>
                    <td className="py-3 px-4 text-end">
                      <div className="d-flex justify-content-end gap-3">
                        <button onClick={() => setViewingItem(m)} className="btn btn-sm btn-link text-primary text-decoration-none fw-bold p-0">View</button>
                        <button onClick={() => handleEditClick(m)} className="btn btn-sm btn-link text-secondary text-decoration-none fw-bold p-0">Edit</button>
                        <button onClick={() => handleDelete(m.id)} className="btn btn-sm btn-link text-danger text-decoration-none fw-bold p-0">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {list.length === 0 && (
                  <tr>
                    <td colSpan={10} className="text-center py-5 text-muted">
                      <div className="fs-1 mb-2">📱</div>
                      No old mobile purchases found. Record a purchase to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* VIEW MODAL */}
      <Modal show={!!viewingItem} onClose={() => setViewingItem(null)} title="Old Mobile Purchase Details">
        {viewingItem && (
          <div className="table-responsive">
            <table className="table table-bordered mb-0 align-middle text-uppercase">
              <tbody>
                <tr>
                  <th className="bg-light text-muted fw-bold" style={{ width: '40%' }}>Purchase Date</th>
                  <td>{formatDate(viewingItem.purchase_date)}</td>
                </tr>
                <tr>
                  <th className="bg-light text-muted fw-bold">Customer Name</th>
                  <td className="fw-bold">{viewingItem.customer?.name || viewingItem.customer_name}</td>
                </tr>
                <tr>
                  <th className="bg-light text-muted fw-bold">Customer Phone</th>
                  <td>{viewingItem.customer?.phone || viewingItem.customer_phone || '—'}</td>
                </tr>
                <tr>
                  <th className="bg-light text-muted fw-bold">Model Name</th>
                  <td className="fw-bold text-primary">{viewingItem.model_name}</td>
                </tr>
                <tr>
                  <th className="bg-light text-muted fw-bold">IMEI / Serial</th>
                  <td>
                    {viewingItem.imei ? (
                      <code>
                        <Link to={`/old-mobiles/sales/new?category=mobile-old&imei=${viewingItem.imei}`} style={{color: 'inherit', textDecoration: 'underline'}} title="Click to create sale for this set">{viewingItem.imei}</Link>
                      </code>
                    ) : '—'}
                  </td>
                </tr>
                <tr>
                  <th className="bg-light text-muted fw-bold">Specifications</th>
                  <td>
                    {viewingItem.ram && <span className="badge bg-secondary me-1">{viewingItem.ram} RAM</span>}
                    {viewingItem.storage && <span className="badge bg-secondary me-1">{viewingItem.storage} ROM</span>}
                    {viewingItem.color && <span className="badge bg-dark">{viewingItem.color}</span>}
                    {!viewingItem.ram && !viewingItem.storage && !viewingItem.color && '—'}
                  </td>
                </tr>
                <tr>
                  <th className="bg-light text-muted fw-bold">Purchase Price</th>
                  <td className="fw-bold text-success">₹{parseFloat(viewingItem.purchase_price).toLocaleString('en-IN')}</td>
                </tr>
                <tr>
                  <th className="bg-light text-muted fw-bold">Resale Target Price</th>
                  <td className="fw-bold text-warning">
                    {parseFloat(viewingItem.selling_price) > 0 ? `₹${parseFloat(viewingItem.selling_price).toLocaleString('en-IN')}` : '—'}
                  </td>
                </tr>
                <tr>
                  <th className="bg-light text-muted fw-bold">Payout Type</th>
                  <td>
                    {viewingItem.is_exchange ? (
                      <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-3 py-1">🔄 Exchange</span>
                    ) : (
                      <span className="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill px-3 py-1">💵 Cash Payout</span>
                    )}
                  </td>
                </tr>
                <tr>
                  <th className="bg-light text-muted fw-bold">Condition & Notes</th>
                  <td>{viewingItem.condition_note || 'No notes recorded'}</td>
                </tr>
                <tr>
                  <th className="bg-light text-muted fw-bold">Recorded By</th>
                  <td>{viewingItem.user?.name}</td>
                </tr>
              </tbody>
            </table>
            <div className="text-end mt-3">
              <button className="btn btn-secondary px-4 fw-bold" onClick={() => setViewingItem(null)}>Close</button>
            </div>
          </div>
        )}
      </Modal>

      {/* EDIT MODAL */}
      <Modal show={!!editingItem} onClose={() => setEditingItem(null)} title="Edit Old Mobile Purchase">
        <form onSubmit={handleEditSubmit}>
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label small fw-bold text-muted">Customer Name</label>
              <input type="text" className="form-control text-uppercase" required value={editForm.customer_name} onChange={e => setEditForm({ ...editForm, customer_name: e.target.value.toUpperCase() })} />
            </div>
            <div className="col-md-6">
              <label className="form-label small fw-bold text-muted">Customer Phone</label>
              <input type="text" className="form-control" required value={editForm.customer_phone} onChange={e => setEditForm({ ...editForm, customer_phone: e.target.value })} />
            </div>
            <div className="col-md-6">
              <label className="form-label small fw-bold text-muted">Model Name</label>
              <input type="text" className="form-control text-uppercase" required value={editForm.model_name} onChange={e => setEditForm({ ...editForm, model_name: e.target.value.toUpperCase() })} />
            </div>
            <div className="col-md-6">
              <label className="form-label small fw-bold text-muted">IMEI / Serial</label>
              <input type="text" className="form-control" value={editForm.imei} onChange={e => setEditForm({ ...editForm, imei: e.target.value })} />
            </div>
            <div className="col-md-4">
              <label className="form-label small fw-bold text-muted">RAM</label>
              <input type="text" className="form-control text-uppercase" placeholder="e.g. 8GB" value={editForm.ram} onChange={e => setEditForm({ ...editForm, ram: e.target.value.toUpperCase() })} />
            </div>
            <div className="col-md-4">
              <label className="form-label small fw-bold text-muted">Storage</label>
              <input type="text" className="form-control text-uppercase" placeholder="e.g. 128GB" value={editForm.storage} onChange={e => setEditForm({ ...editForm, storage: e.target.value.toUpperCase() })} />
            </div>
            <div className="col-md-4">
              <label className="form-label small fw-bold text-muted">Color</label>
              <input type="text" className="form-control text-uppercase" placeholder="e.g. BLACK" value={editForm.color} onChange={e => setEditForm({ ...editForm, color: e.target.value.toUpperCase() })} />
            </div>
            <div className="col-md-6">
              <label className="form-label small fw-bold text-muted">Purchase Date</label>
              <input type="date" className="form-control" required value={editForm.purchase_date} onChange={e => setEditForm({ ...editForm, purchase_date: e.target.value })} />
            </div>
            <div className="col-md-6">
              <label className="form-label small fw-bold text-muted">Payout Type</label>
              <select className="form-select text-uppercase" value={editForm.is_exchange} onChange={e => setEditForm({ ...editForm, is_exchange: e.target.value === 'true' })}>
                <option value="true">Exchange (Trade-in Credit)</option>
                <option value="false">Cash Payout</option>
              </select>
            </div>
            <div className="col-md-6">
              <label className="form-label small fw-bold text-muted">Purchase Value (₹)</label>
              <input type="number" step="0.01" className="form-control fw-bold text-success" required value={editForm.purchase_price} onChange={e => setEditForm({ ...editForm, purchase_price: e.target.value })} />
            </div>
            <div className="col-md-6">
              <label className="form-label small fw-bold text-muted">Target Reselling Price (₹)</label>
              <input type="number" step="0.01" className="form-control fw-bold text-warning" value={editForm.selling_price} onChange={e => setEditForm({ ...editForm, selling_price: e.target.value })} />
            </div>
            <div className="col-12">
              <label className="form-label small fw-bold text-muted">Condition Notes</label>
              <textarea className="form-control text-uppercase" rows="2" value={editForm.condition_note} onChange={e => setEditForm({ ...editForm, condition_note: e.target.value.toUpperCase() })}></textarea>
            </div>
          </div>
          <div className="text-end mt-4 d-flex justify-content-end gap-2">
            <button type="button" className="btn btn-secondary fw-bold" onClick={() => setEditingItem(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary fw-bold px-4">Save Changes</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
