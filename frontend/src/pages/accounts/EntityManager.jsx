import { useState, useEffect, useCallback } from 'react';
import pinGate from '../../utils/pinGate';
import { Link } from 'react-router-dom';
import axios from '../../api/axios';
import { toast } from 'react-toastify';
import _ from 'lodash';
import { isAssetEntityType } from '../../utils/assetEntityTypes';

export default function EntityManager() {
  const [entities, setEntities] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingEntity, setEditingEntity] = useState(null);
  const [customTypes, setCustomTypes] = useState([]);
  const [sortBy, setSortBy] = useState(null); // null = API's natural order
  const [sortDir, setSortDir] = useState('asc');
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    phone: '',
    address: '',
    email: '',
    gst_number: '',
    opening_balance: 0,
    balance_type: 'RECEIVABLE',
    description: '',
    voucher_code: '',
    events: []
  });

  const entityTypes = ['CUSTOMER', 'SHOP_CUSTOMER', 'SHOP', 'SUPPLIER', 'DISTRIBUTOR', 'FINANCER', 'OTHER'];

  useEffect(() => {
    fetchEntities('');
  }, []);

  const fetchEntities = async (q = '') => {
    setLoading(true);
    try {
      const { data } = await axios.get('/ledgers/entity-balances', {
        params: q ? { q } : {}
      });
      setEntities(data);

      // Extract custom types from loaded entities
      const types = data.map(e => e.type).filter(Boolean);
      const uniqueCustomTypes = Array.from(new Set(types)).filter(
        t => !['CUSTOMER', 'SHOP_CUSTOMER', 'SHOP', 'SUPPLIER', 'DISTRIBUTOR', 'BANK', 'CARD', 'UPI', 'OTHER'].includes(t)
      );
      setCustomTypes(uniqueCustomTypes);
    } catch (error) {
      toast.error('Failed to fetch entities');
    } finally {
      setLoading(false);
    }
  };

  // Debounced live search — hits the API so zero-balance entities are also found
  const debouncedSearch = useCallback(
    _.debounce((q) => fetchEntities(q), 400),
    []
  );

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchTerm(val);
    debouncedSearch(val);
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
      fetchEntities(searchTerm);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Action failed');
    }
  };

  const openModal = async (entity = null) => {
    if (entity) {
      setEditingEntity(entity);
      try {
        const { data } = await axios.get(`/entities/${entity.id}`);
        setFormData({
          name: data.name,
          type: data.type,
          phone: data.phone || '',
          address: data.address || '',
          email: data.email || '',
          gst_number: data.gst_number || '',
          opening_balance: data.opening_balance || 0,
          balance_type: data.balance_type || 'RECEIVABLE',
          description: data.description || '',
          voucher_code: data.voucher_code || '',
          events: data.events || []
        });
      } catch (error) {
        toast.error('Failed to load entity details');
      }
    } else {
      setEditingEntity(null);
      setFormData({
        name: '',
        type: '',
        phone: '',
        address: '',
        email: '',
        gst_number: '',
        opening_balance: 0,
        balance_type: 'RECEIVABLE',
        description: '',
        voucher_code: '',
        events: []
      });
    }
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!await pinGate.confirm()) return;
    try {
      await axios.delete(`/entities/${id}`);
      toast.success('Deleted');
      fetchEntities(searchTerm);
    } catch (error) {
      toast.error('Delete failed');
    }
  };


  const toggleSort = (column) => {
    if (sortBy === column) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDir('asc');
    }
  };

  const sortedEntities = sortBy
    ? [...entities].sort((a, b) => {
        const av = (a[sortBy] ?? '').toString().toUpperCase();
        const bv = (b[sortBy] ?? '').toString().toUpperCase();
        if (av < bv) return sortDir === 'asc' ? -1 : 1;
        if (av > bv) return sortDir === 'asc' ? 1 : -1;
        return 0;
      })
    : entities;

  const sortIcon = (column) => {
    if (sortBy !== column) return <i className="bi bi-arrow-down-up opacity-25 ms-1" />;
    return sortDir === 'asc' ? <i className="bi bi-sort-alpha-down ms-1" /> : <i className="bi bi-sort-alpha-up ms-1" />;
  };

  const isDefaultType = ['CUSTOMER', 'SHOP_CUSTOMER', 'SHOP', 'SUPPLIER', 'DISTRIBUTOR', 'BANK', 'CARD', 'UPI'].includes(formData.type);
  const isCustomType = customTypes.includes(formData.type);
  const showCustomInput = formData.type === 'OTHER' || (!isDefaultType && !isCustomType && formData.type !== '');

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="h4 mb-0 text-uppercase fw-bold text-primary">Master Entity Manager</h2>
          <p className="text-muted small mb-0">Manage opening balances and contact info for all parties <span style={{fontSize:'.65rem', fontWeight:700, letterSpacing:1}}>· SHORTCUT: ALT + E</span></p>
        </div>
        <div className="d-flex gap-2">
          <div className="input-group" style={{ width: '300px' }}>
            <span className="input-group-text bg-white border-end-0">
              <i className="bi bi-search text-muted" />
            </span>
            <input 
              type="text" 
              className="form-control border-start-0 ps-0" 
              placeholder="Search Name, Phone or Type..." 
              value={searchTerm}
              onChange={handleSearchChange}
            />
          </div>
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
                <th role="button" onClick={() => toggleSort('type')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  Type{sortIcon('type')}
                </th>
                <th>Contact</th>
                <th>Opening</th>
                <th>Net Balance</th>
                <th className="text-end pe-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" className="text-center py-5"><div className="spinner-border text-primary" /></td></tr>
              ) : sortedEntities.length === 0 ? (
                <tr><td colSpan="6" className="text-center py-5 text-muted">No entities found. {searchTerm ? 'Try a different search term.' : 'Use Auto-Sync or Create New.'}</td></tr>
              ) : sortedEntities.map(e => (
                <tr key={e.id}>
                  <td className="ps-4">
                    <div className="fw-bold">{e.name} <span className="small text-muted fw-normal">({e.type})</span></div>
                    {e.description && <div className="x-small text-muted">{e.description}</div>}
                  </td>
                  <td>
                    <span className={`badge rounded-pill ${
                      e.type === 'SHOP' ? 'bg-info' : 
                      e.type === 'SUPPLIER' ? 'bg-warning' : 
                      e.type === 'CUSTOMER' ? 'bg-success' : 
                      e.type === 'SHOP_CUSTOMER' ? 'bg-primary' : 'bg-secondary'
                    }`}>
                      {e.type}
                    </span>
                  </td>
                  <td className="small">
                    <div>{e.phone}</div>
                    <div className="opacity-50">{e.email}</div>
                  </td>
                  <td className={`small ${e.balance_type === 'RECEIVABLE' ? 'text-success' : 'text-danger'}`}>
                    ₹{Number(e.opening_balance).toLocaleString()}
                    <div className="x-small opacity-50">{e.is_asset_account ? 'OPENING BALANCE' : e.balance_type}</div>
                  </td>
                  <td>
                    <div className={`fw-bold ${e.net_balance >= 0 ? 'text-success' : 'text-danger'}`}>
                      {e.net_balance < 0 ? '−' : ''}₹{Math.abs(Number(e.net_balance)).toLocaleString()}
                    </div>
                    <div className="x-small opacity-50">
                      {e.is_asset_account ? '🏦 BALANCE' : (e.net_balance >= 0 ? 'RECEIVABLE' : 'PAYABLE')}
                    </div>
                  </td>
                  <td className="text-end pe-4">
                     <Link 
                        to={`/accounts/entity-ledger?id=${e.id}&name=${encodeURIComponent(e.name)}`} 
                        className="btn btn-sm btn-outline-info me-2"
                     >
                        Profile
                     </Link>
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
          <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
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
                    <div className="col-12 col-md-6">
                      <label className="form-label fw-bold small text-muted text-uppercase">Category *</label>
                      <select 
                        className="form-select fw-semibold"
                        required
                        value={
                          isDefaultType || isCustomType
                            ? formData.type
                            : (formData.type ? 'OTHER' : '')
                        }
                        onChange={e => setFormData({...formData, type: e.target.value})}
                      >
                        <option value="">Select Category...</option>
                        <option value="CUSTOMER">NORMAL CUSTOMER</option>
                        <option value="SHOP_CUSTOMER">SHOP CUSTOMER</option>
                        <option value="SHOP">SHOP</option>
                        <option value="SUPPLIER">SUPPLIER</option>
                        <option value="DISTRIBUTOR">DISTRIBUTOR</option>
                        <option value="BANK">BANK</option>
                        <option value="CARD">CARD</option>
                        <option value="UPI">UPI</option>
                        {customTypes.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                        <option value="OTHER">OTHER / CUSTOM TYPE</option>
                      </select>
                    </div>

                    {showCustomInput && (
                      <div className="col-12">
                        <label className="form-label fw-bold small text-muted text-uppercase">Custom Category / Type *</label>
                        <input 
                          type="text" 
                          className="form-control fw-bold"
                          required
                          placeholder="Type custom category name..."
                          value={formData.type === 'OTHER' ? '' : formData.type}
                          onChange={e => setFormData({...formData, type: e.target.value.toUpperCase()})}
                        />
                      </div>
                    )}
                    <div className="col-12 col-md-6">
                      <label className="form-label fw-bold small text-muted text-uppercase">Phone</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.phone}
                        onChange={e => setFormData({...formData, phone: e.target.value})}
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label fw-bold small text-muted text-uppercase">Address</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Address"
                        value={formData.address}
                        onChange={e => setFormData({...formData, address: e.target.value})}
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label fw-bold small text-muted text-uppercase">GST Number</label>
                      <input
                        type="text" 
                        className="form-control"
                        placeholder="Optional"
                        value={formData.gst_number}
                        onChange={e => setFormData({...formData, gst_number: e.target.value})}
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label fw-bold small text-muted text-uppercase">Opening Balance</label>
                      <input 
                        type="number" 
                        className="form-control"
                        value={formData.opening_balance}
                        onChange={e => setFormData({...formData, opening_balance: e.target.value})}
                      />
                    </div>
                    {isAssetEntityType(formData.type) ? (
                      <div className="col-12 col-md-6 d-flex align-items-end">
                        <div className="small text-muted fst-italic">
                          This is just the current balance in the account — no owe-direction needed.
                        </div>
                      </div>
                    ) : (
                      <div className="col-12 col-md-6">
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
                    )}

                    {['CUSTOMER', 'SHOP_CUSTOMER'].includes(formData.type) && (
                      <>
                        <div className="col-12 col-md-6">
                          <label className="form-label fw-bold small text-muted text-uppercase">Email</label>
                          <input 
                            type="email" 
                            className="form-control"
                            placeholder="Email address"
                            value={formData.email || ''}
                            onChange={e => setFormData({...formData, email: e.target.value})}
                          />
                        </div>
                        <div className="col-12 col-md-6">
                          <label className="form-label fw-bold small text-muted text-uppercase">Voucher Code</label>
                          <input 
                            type="text" 
                            className="form-control text-primary fw-semibold"
                            placeholder="Voucher Code"
                            value={formData.voucher_code || ''}
                            onChange={e => setFormData({...formData, voucher_code: e.target.value.toUpperCase()})}
                          />
                        </div>
                        <div className="col-12 mt-3 pt-3 border-top">
                          <div className="d-flex justify-content-between align-items-center mb-1">
                            <h6 className="mb-0 fw-bold text-dark d-flex align-items-center gap-2" style={{ fontSize: '0.9rem' }}>
                              🎂 Customer Events
                            </h6>
                            <button 
                              type="button" 
                              className="btn btn-sm btn-outline-primary fw-bold" 
                              onClick={() => setFormData({...formData, events: [...(formData.events || []), { type: '', name: '', date: '' }]})}
                              style={{ fontSize: '0.75rem', borderRadius: '6px', padding: '4px 12px' }}
                            >
                              + Add Event
                            </button>
                          </div>
                          <p className="text-muted x-small text-uppercase mb-3 fw-semibold" style={{ letterSpacing: '0.5px', fontSize: '0.7rem' }}>
                            Click "+ Add Event" to track birthdays, etc.
                          </p>

                          <div className="row g-2">
                            {(formData.events || []).map((ev, idx) => (
                              <div key={idx} className="col-12 p-3 bg-light rounded border mb-2">
                                <div className="row g-2 align-items-center">
                                  
                                  <div className="col-12 col-md-4">
                                    <select 
                                      className="form-select form-select-sm fw-semibold" 
                                      value={ev.type} 
                                      onChange={e => {
                                        const newEvents = [...formData.events];
                                        newEvents[idx].type = e.target.value;
                                        setFormData({...formData, events: newEvents});
                                      }}
                                    >
                                      <option value="">Select Type</option>
                                      <option value="dob">DOB</option>
                                      <option value="anniversary">Anniversary</option>
                                      <option value="other">Other</option>
                                    </select>
                                  </div>

                                  {ev.type === 'other' && (
                                    <div className="col-12 col-md-3">
                                      <input 
                                        className="form-control form-control-sm fw-semibold" 
                                        placeholder="Event Name" 
                                        value={ev.name || ''} 
                                        onChange={e => {
                                          const newEvents = [...formData.events];
                                          newEvents[idx].name = e.target.value.toUpperCase();
                                          setFormData({...formData, events: newEvents});
                                        }}
                                      />
                                    </div>
                                  )}

                                  <div className={`col-md-${ev.type === 'other' ? '4' : '7'}`}>
                                    <input 
                                      className="form-control form-control-sm fw-semibold" 
                                      type="date" 
                                      value={ev.date} 
                                      onChange={e => {
                                        const newEvents = [...formData.events];
                                        newEvents[idx].date = e.target.value;
                                        setFormData({...formData, events: newEvents});
                                      }}
                                    />
                                  </div>

                                  <div className="col-12 col-md-1 text-end">
                                    <button 
                                      type="button" 
                                      className="btn btn-sm btn-link text-danger p-0 border-0 bg-transparent" 
                                      onClick={() => {
                                        const newEvents = formData.events.filter((_, i) => i !== idx);
                                        setFormData({...formData, events: newEvents});
                                      }}
                                    >
                                      ❌
                                    </button>
                                  </div>

                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

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
