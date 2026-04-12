import { useState, useEffect } from 'react';
import axios from '../../api/axios';
import { toast } from 'react-toastify';

export default function EntityManager() {
  const [entities, setEntities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingEntity, setEditingEntity] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'OTHER',
    phone: '',
    email: '',
    opening_balance: 0,
    balance_type: 'RECEIVABLE',
    description: ''
  });

  const entityTypes = ['CUSTOMER', 'SHOP', 'SUPPLIER', 'RETAILER', 'OTHER'];

  useEffect(() => {
    fetchEntities();
  }, []);

  const fetchEntities = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get('/entities');
      setEntities(data);
    } catch (error) {
      toast.error('Failed to fetch entities');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!window.confirm('This will import missing Customers, Shops, and Suppliers as Entities. Continue?')) return;
    try {
      const { data } = await axios.post('/entities-sync');
      toast.success(data.message);
      fetchEntities();
    } catch (error) {
      toast.error('Sync failed');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingEntity) {
        await axios.put(`/entities/${editingEntity.id}`, formData);
        toast.success('Entity updated');
      } else {
        await axios.post('/entities', formData);
        toast.success('Entity created');
      }
      setShowModal(false);
      fetchEntities();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Action failed');
    }
  };

  const openModal = (entity = null) => {
    if (entity) {
      setEditingEntity(entity);
      setFormData({
        name: entity.name,
        type: entity.type,
        phone: entity.phone || '',
        email: entity.email || '',
        opening_balance: entity.opening_balance || 0,
        balance_type: entity.balance_type || 'RECEIVABLE',
        description: entity.description || ''
      });
    } else {
      setEditingEntity(null);
      setFormData({
        name: '',
        type: 'OTHER',
        phone: '',
        email: '',
        opening_balance: 0,
        balance_type: 'RECEIVABLE',
        description: ''
      });
    }
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this entity? It will not delete transactions, but the ledger link will be lost.')) return;
    try {
      await axios.delete(`/entities/${id}`);
      toast.success('Deleted');
      fetchEntities();
    } catch (error) {
      toast.error('Delete failed');
    }
  };

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="h4 mb-0 text-uppercase fw-bold text-primary">Master Entity Manager</h2>
          <p className="text-muted small mb-0">Manage opening balances and contact info for all parties</p>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-secondary" onClick={handleSync}>
            <i className="bi bi-arrow-repeat me-1" /> Auto-Sync
          </button>
          <button className="btn btn-primary" onClick={() => openModal()}>
             + New Entity
          </button>
        </div>
      </div>

      <div className="card shadow-sm border-0">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light text-uppercase">
              <tr>
                <th className="ps-4">Entity Name</th>
                <th>Type</th>
                <th>Contact</th>
                <th>Opening Balance</th>
                <th className="text-end pe-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" className="text-center py-5"><div className="spinner-border text-primary" /></td></tr>
              ) : entities.length === 0 ? (
                <tr><td colSpan="5" className="text-center py-5 text-muted">No entities found. Use Auto-Sync or Create New.</td></tr>
              ) : entities.map(e => (
                <tr key={e.id}>
                  <td className="ps-4">
                    <div className="fw-bold">{e.name}</div>
                    {e.description && <div className="x-small text-muted">{e.description}</div>}
                  </td>
                  <td>
                    <span className={`badge rounded-pill ${
                      e.type === 'SHOP' ? 'bg-info' : 
                      e.type === 'SUPPLIER' ? 'bg-warning' : 
                      e.type === 'CUSTOMER' ? 'bg-success' : 'bg-secondary'
                    }`}>
                      {e.type}
                    </span>
                  </td>
                  <td className="small">
                    <div>{e.phone}</div>
                    <div className="opacity-50">{e.email}</div>
                  </td>
                  <td className={`fw-bold ${e.balance_type === 'RECEIVABLE' ? 'text-success' : 'text-danger'}`}>
                    ₹{Number(e.opening_balance).toLocaleString()}
                    <div className="x-small opacity-50">{e.balance_type}</div>
                  </td>
                  <td className="text-end pe-4">
                     <button className="btn btn-sm btn-outline-primary me-2" onClick={() => openModal(e)}>Edit</button>
                     <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(e.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title fw-bold text-uppercase">{editingEntity ? 'Edit Entity' : 'New Entity'}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowModal(false)}></button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body p-4">
                  <div className="row g-3">
                    <div className="col-12">
                      <label className="form-label fw-bold small text-muted text-uppercase">Entity Name *</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        required 
                        value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-bold small text-muted text-uppercase">Category</label>
                      <select 
                        className="form-select"
                        value={formData.type}
                        onChange={e => setFormData({...formData, type: e.target.value})}
                      >
                        {entityTypes.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-bold small text-muted text-uppercase">Phone</label>
                      <input 
                        type="text" 
                        className="form-control"
                        value={formData.phone}
                        onChange={e => setFormData({...formData, phone: e.target.value})}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-bold small text-muted text-uppercase">Opening Balance</label>
                      <input 
                        type="number" 
                        className="form-control"
                        value={formData.opening_balance}
                        onChange={e => setFormData({...formData, opening_balance: e.target.value})}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-bold small text-muted text-uppercase">Balance Type</label>
                      <select 
                        className="form-select"
                        value={formData.balance_type}
                        onChange={e => setFormData({...formData, balance_type: e.target.value})}
                      >
                        <option value="RECEIVABLE">THEY OWE ME (Receivable)</option>
                        <option value="PAYABLE">I OWE THEM (Payable)</option>
                      </select>
                    </div>
                    <div className="col-12">
                      <label className="form-label fw-bold small text-muted text-uppercase">Description / Notes</label>
                      <textarea 
                        className="form-control"
                        rows="2"
                        value={formData.description}
                        onChange={e => setFormData({...formData, description: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
                <div className="modal-footer border-0 p-4 pt-0">
                  <button type="button" className="btn btn-light" onClick={() => setShowModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary px-4 fw-bold text-uppercase">Save Account</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
