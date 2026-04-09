import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../../api/axios';
import { toast } from 'react-toastify';
import Modal from '../../components/Modal';

import { useAuth } from '../../contexts/AuthContext';
export default function AirtelRetailers() {
  const { can, isOwner, isManager, hasFullAccess } = useAuth();
  const navigate = useNavigate();
  const [retailers, setRetailers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [selectedRetailer, setSelectedRetailer] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [editing, setEditing] = useState(null);
  const [sortBy, setSortBy] = useState('name');
  const [order, setOrder] = useState('asc');
  const [form, setForm] = useState({ name: '', msisdn: '', address: '', balance: 0, shop_id: 1 });

  useEffect(() => {
    fetchRetailers();
  }, [page, search, sortBy, order]);

  const fetchRetailers = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`/airtel-retailers?page=${page}&search=${search}&sort_by=${sortBy}&order=${order}`);
      setRetailers(data.data);
      setLastPage(data.last_page);
    } catch (error) {
      toast.error('Failed to fetch retailers');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setOrder(order === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setOrder('asc');
    }
    setPage(1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await axios.put(`/airtel-retailers/${editing.id}`, form);
        toast.success('Retailer updated');
      } else {
        await axios.post('/airtel-retailers', form);
        toast.success('Retailer added');
      }
      setShowModal(false);
      fetchRetailers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Action failed');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('ARE YOU SURE?')) return;
    try {
      await axios.delete(`/airtel-retailers/${id}`);
      toast.success('Retailer deleted');
      fetchRetailers();
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  const openModal = (r = null) => {
    setEditing(r);
    setForm(r ? { ...r } : { name: '', msisdn: '', address: '', balance: 0, shop_id: 1 });
    setShowModal(true);
  };

  const openHistory = async (r) => {
    setSelectedRetailer(r);
    setShowHistory(true);
    setLoadingHistory(true);
    try {
        const { data } = await axios.get(`/airtel-retailers/${r.id}`);
        setHistoryData(data);
    } catch (err) {
        toast.error('Failed to load history');
    } finally {
        setLoadingHistory(false);
    }
  };

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="h4 mb-0 text-uppercase fw-bold">Airtel Retailers</h2>
        <div className="d-flex gap-2">
          <button 
            className="btn btn-outline-success btn-sm text-uppercase px-3"
            onClick={async () => {
              try {
                const { data } = await axios.get('/airtel-retailers/export', { responseType: 'blob' });
                const url = window.URL.createObjectURL(new Blob([data]));
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `airtel_retailers_${new Date().toISOString().split('T')[0]}.csv`);
                document.body.appendChild(link);
                link.click();
                link.remove();
              } catch (err) {
                toast.error('Export failed');
              }
            }}
          >
            Export CSV
          </button>
          {can('manage_airtel_recovery') && (
            <button className="btn btn-primary btn-sm text-uppercase" onClick={() => openModal()}>
              + Add Retailer
            </button>
          )}
        </div>
      </div>

      <div className="card shadow-sm mb-4">
        <div className="card-body">
          <input 
            type="text" 
            className="form-control text-uppercase" 
            placeholder="Search by name or MSISDN..." 
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light text-uppercase shadow-sm">
              <tr>
                <th className="ps-4 cursor-pointer" onClick={() => handleSort('name')}>
                  Retailer Name {sortBy === 'name' && (order === 'asc' ? '↑' : '↓')}
                </th>
                <th>MSISDN (Mobile)</th>
                <th>Status</th>
                <th>Address</th>
                <th className="cursor-pointer" onClick={() => handleSort('balance')}>
                  Balance {sortBy === 'balance' && (order === 'asc' ? '↑' : '↓')}
                </th>
                <th className="text-end pe-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" className="text-center py-5"><div className="spinner-border text-primary"/></td></tr>
              ) : retailers.length === 0 ? (
                <tr><td colSpan="5" className="text-center py-5 text-muted text-uppercase">No retailers found</td></tr>
              ) : retailers.map(r => (
                <tr key={r.id}>
                  <td className="ps-4">
                      <button 
                        className="btn btn-link p-0 text-decoration-none fw-bold text-dark text-start" 
                        onClick={() => navigate(`/airtel/retailers/${r.id}`)}
                      >
                          {r.name}
                      </button>
                  </td>
                  <td>{r.msisdn}</td>
                  <td>
                      <span className={`badge text-uppercase small ${
                          r.status === 'FULL RECOVERED' ? 'bg-success' : 
                          r.status === 'FOLLOW UP' ? 'bg-info' : 'bg-warning text-dark'
                      }`} style={{fontSize: '0.65rem'}}>
                          {r.status}
                      </span>
                  </td>
                  <td className="text-muted small">{r.address || '-'}</td>
                  <td className="fw-bold text-danger">₹{(parseFloat(r.pending_balance) || 0).toLocaleString()}</td>
                  <td className="text-end pe-4 text-nowrap">
                    <button className="btn btn-outline-primary btn-sm me-1 px-3" onClick={() => navigate(`/airtel/retailers/${r.id}`)}>PROFILE</button>
                    <button className="btn btn-outline-info btn-sm me-1 px-3" onClick={() => openHistory(r)}>HISTORY</button>
                    {can('manage_airtel_recovery') && (
                      <>
                        <button className="btn btn-outline-primary btn-sm me-2" onClick={() => openModal(r)}>EDIT</button>
                        {hasFullAccess() && <button className="btn btn-outline-danger btn-sm" onClick={() => handleDelete(r.id)}>DEL</button>}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {lastPage > 1 && (
          <div className="card-footer d-flex justify-content-between align-items-center py-3">
            <button className="btn btn-outline-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>PREVIOUS</button>
            <span className="text-muted small text-uppercase">Page {page} of {lastPage}</span>
            <button className="btn btn-outline-secondary btn-sm" disabled={page === lastPage} onClick={() => setPage(p => p + 1)}>NEXT</button>
          </div>
        )}
      </div>

      <Modal show={showHistory} onClose={() => setShowHistory(false)} title={`History: ${selectedRetailer?.name}`}>
          {loadingHistory ? (
              <div className="text-center py-5"><div className="spinner-border text-primary"/></div>
          ) : historyData ? (
              <div>
                  <div className="row g-2 mb-4">
                      <div className="col-3">
                          <div className="bg-light p-2 rounded text-center border-start border-3 border-primary">
                              <div className="x-small text-uppercase opacity-75">Opening</div>
                              <div className="fw-bold">₹{(parseFloat(historyData.retailer?.balance) || 0).toLocaleString()}</div>
                          </div>
                      </div>
                      <div className="col-3">
                          <div className="bg-light p-2 rounded text-center">
                              <div className="x-small text-uppercase opacity-75">Dropped</div>
                              <div className="fw-bold">₹{historyData.stats.total_dropped.toLocaleString()}</div>
                          </div>
                      </div>
                      <div className="col-3">
                          <div className="bg-success-subtle p-2 rounded text-center">
                              <div className="x-small text-uppercase opacity-75 text-success">Recovered</div>
                              <div className="fw-bold text-success">₹{historyData.stats.total_recovered.toLocaleString()}</div>
                          </div>
                      </div>
                      <div className="col-3">
                          <div className="bg-danger-subtle p-2 rounded text-center">
                              <div className="x-small text-uppercase opacity-75 text-danger">Pending</div>
                              <div className="fw-bold text-danger">₹{historyData.stats.total_pending.toLocaleString()}</div>
                          </div>
                      </div>
                  </div>

                  <div className="table-responsive" style={{maxHeight:'400px'}}>
                      <table className="table table-sm table-hover align-middle border-top">
                          <thead className="bg-light sticky-top">
                              <tr className="x-small text-uppercase">
                                  <th>Date</th>
                                  <th>Type</th>
                                  <th>Amount</th>
                                  <th className="text-end">Status</th>
                              </tr>
                          </thead>
                           <tbody>
                              {parseFloat(historyData.retailer?.balance) > 0 && (
                                  <tr className="bg-danger-light">
                                      <td className="small text-danger fw-bold">OPENING</td>
                                      <td className="small fw-bold text-danger">Brought Forward</td>
                                      <td className="fw-bold text-danger">₹{parseFloat(historyData.retailer.balance).toLocaleString()}</td>
                                      <td className="text-end">
                                          <span className="badge bg-danger x-small">PENDING</span>
                                      </td>
                                  </tr>
                              )}
                              {[
                                  ...(historyData.retailer?.drops || []).map(d => ({ ...d, entryType: 'DROP' })),
                                  ...(historyData.retailer?.recoveries || []).map(r => ({ ...r, entryType: 'RECOVERY' }))
                              ].sort((a, b) => {
                                  const dateA = new Date(a.entryType === 'DROP' ? a.refill_date : a.recovered_at);
                                  const dateB = new Date(b.entryType === 'DROP' ? b.refill_date : b.recovered_at);
                                  if (dateB - dateA !== 0) return dateB - dateA;
                                  return new Date(b.created_at) - new Date(a.created_at);
                              }).map((item, idx) => (
                                  <tr key={`${item.entryType}-${item.id}`} className={`${item.entryType === 'RECOVERY' ? 'bg-success-light' : (item.status === 'pending' ? 'bg-danger-light' : '')}`}>
                                      <td className="small">{new Date(item.entryType === 'DROP' ? item.refill_date : item.recovered_at).toLocaleDateString('en-GB')}</td>
                                      <td>
                                          <span className={`badge x-small ${item.entryType === 'RECOVERY' ? 'bg-success' : 'bg-primary'}`}>
                                              {item.entryType}
                                          </span>
                                      </td>
                                      <td className={`fw-bold ${item.entryType === 'RECOVERY' ? 'text-success' : 'text-primary'}`}>
                                          ₹{parseFloat(item.amount).toLocaleString()}
                                      </td>
                                      <td className="text-end">
                                          {item.entryType === 'DROP' ? (
                                              <span className={`badge ${item.status === 'recovered' ? 'bg-success' : 'bg-danger'} x-small`}>
                                                  {item.status.toUpperCase()}
                                              </span>
                                          ) : (
                                              <span className="badge bg-success x-small">PAID</span>
                                          )}
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>
          ) : null}
      </Modal>

      <Modal show={showModal} onClose={() => setShowModal(false)} title={editing ? 'EDIT RETAILER' : 'ADD RETAILER'}>
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label text-uppercase small fw-bold">Retailer Name</label>
            <input type="text" className="form-control text-uppercase" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
          </div>
          <div className="mb-3">
            <label className="form-label text-uppercase small fw-bold">MSISDN (10 Digits)</label>
            <input type="text" className="form-control" required value={form.msisdn} onChange={e => setForm({...form, msisdn: e.target.value})} />
          </div>
          <div className="mb-3">
            <label className="form-label text-uppercase small fw-bold">Address</label>
            <textarea className="form-control text-uppercase" rows="2" value={form.address || ''} onChange={e => setForm({...form, address: e.target.value})} />
          </div>
          
          <div className="mb-3">
            <label className="form-label text-uppercase small fw-bold">Opening Balance (Old Money)</label>
            <div className="input-group">
                <span className="input-group-text bg-light text-danger fw-bold">₹</span>
                <input 
                    type="number" 
                    className="form-control text-danger fw-bold" 
                    value={form.balance} 
                    onChange={e => setForm({...form, balance: e.target.value})}
                    disabled={!isOwner() && !isManager()}
                    placeholder="0.00"
                />
            </div>
            {!isOwner() && !isManager() && <div className="form-text x-small text-muted">Only Owner can modify opening balance.</div>}
          </div>
          <div className="d-grid mt-4">
            <button type="submit" className="btn btn-primary text-uppercase fw-bold">
              {editing ? 'Update Retailer' : 'Add Retailer'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
