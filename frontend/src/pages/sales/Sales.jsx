import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import { formatDate } from '../../utils/formatters';
import { useAuth } from '../../contexts/AuthContext';
import DataBackupModal from '../../components/DataBackupModal';

export default function Sales() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [shops, setShops]       = useState([]);
  const { hasFullAccess } = useAuth();
  const navigate = useNavigate();
  const [showBackupModal, setShowBackupModal] = useState(false);

  const [filters, setFilters] = useState({ 
    from: '', to: '', bill_type: '', search: '', shop_id: '' 
  });

  useEffect(() => {
    loadInvoices();
    if (hasFullAccess()) {
        api.get('/shops').then(r => setShops(r.data));
    }
  }, [filters]);

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/sale-invoices', { params: filters });
      // If data.data exists (pagination), use it; otherwise use data
      setInvoices(data.data || data);
    } catch (e) {
      toast.error('Failed to load sales');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this sale? Stock will be restored.')) return;
    try {
      await api.post(`/sale-invoices/${id}/cancel`);
      toast.success('Sale cancelled successfully');
      loadInvoices();
    } catch (e) { toast.error('Error cancelling sale'); }
  };

  const handleReceiveFinance = async (id) => {
    if (!window.confirm('Mark this finance payment as RECEIVED?')) return;
    try {
      await api.post(`/sale-invoices/${id}/receive-finance`);
      toast.success('Finance payment marked as received');
      loadInvoices();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to update finance status');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('PERMANENTLY DELETE this invoice? Stock will be restored.')) return;
    try {
      await api.delete(`/sale-invoices/${id}`);
      toast.success('Invoice deleted');
      loadInvoices();
    } catch (e) { toast.error('Error deleting invoice'); }
  };

  const convertToPakka = async (id) => {
    if (!window.confirm('Convert this Kaccha bill to Pakka?')) return;
    try {
      const res = await api.post(`/sale-invoices/${id}/convert-to-pakka`);
      toast.success(`Pakka bill created: ${res.data.invoice_no}`);
      loadInvoices();
    } catch (e) { toast.error('Conversion failed'); }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'paid': return <span className="badge rounded-pill bg-success px-3">PAID</span>;
      case 'partial': return <span className="badge rounded-pill bg-info text-white px-3">PARTIAL</span>;
      case 'unpaid': return <span className="badge rounded-pill bg-danger px-3">UNPAID</span>;
      default: return null;
    }
  };

  return (
    <div className="container-fluid py-2">
      <div className="page-header mb-3 d-flex justify-content-between align-items-center">
        <div className="text-uppercase">
           <h2 className="mb-0 fw-bold">🧾 SALES MANAGEMENT</h2>
           <p className="text-muted small mb-0">MANAGE CUSTOMER INVOICES, PAYMENTS AND BILLING</p>
        </div>
        <div className="d-flex gap-2">
          <button onClick={() => setShowBackupModal(true)} className="btn btn-outline-dark shadow-sm text-uppercase fw-bold">Backup / Restore</button>
          <button onClick={() => navigate('/sales/new')} className="btn btn-primary shadow-sm text-uppercase fw-bold">+ New Sale</button>
        </div>
      </div>

      <DataBackupModal 
        isOpen={showBackupModal} 
        onClose={() => setShowBackupModal(false)}
        onRefresh={loadInvoices}
        title="Sales Data Backup"
        endpoint="/sale-invoices"
        typeLabel="Sales"
      />

      {/* Filters Card */}
      <div className="card shadow-sm border-0 mb-4 p-3 bg-white rounded-3">
        <div className="row g-2 text-uppercase">
            <div className="col-12 col-md-3">
                <label className="small text-muted mb-1 fw-bold">Date Range</label>
                <div className="input-group input-group-sm">
                    <input type="date" className="form-control" value={filters.from} onChange={e => setFilters({...filters, from: e.target.value})} />
                    <span className="input-group-text">—</span>
                    <input type="date" className="form-control" value={filters.to} onChange={e => setFilters({...filters, to: e.target.value})} />
                </div>
            </div>
            <div className="col-12 col-md-2">
                <label className="small text-muted mb-1 fw-bold">Bill Type</label>
                <select className="form-select form-select-sm" value={filters.bill_type} onChange={e => setFilters({...filters, bill_type: e.target.value})}>
                    <option value="">ALL BILLS</option>
                    <option value="kaccha">KACCHA</option>
                    <option value="pakka">PAKKA</option>
                </select>
            </div>
            {hasFullAccess() && (
                <div className="col-12 col-md-2">
                    <label className="small text-muted mb-1 fw-bold">Shop Branch</label>
                    <select className="form-select form-select-sm" value={filters.shop_id} onChange={e => setFilters({...filters, shop_id: e.target.value})}>
                        <option value="">ALL BRANCHES</option>
                        {shops.map(s => <option key={s.id} value={s.id}>{s.name.toUpperCase()}</option>)}
                    </select>
                </div>
            )}
            <div className="col-12 col-md-3">
                <label className="small text-muted mb-1 fw-bold">Search Invoice / Customer</label>
                <input type="text" className="form-control form-control-sm text-uppercase" placeholder="SEARCH..." value={filters.search} onChange={e => setFilters({...filters, search: e.target.value})} />
            </div>
            <div className="col-12 col-md-2 d-flex align-items-end">
                <button className="btn btn-sm btn-outline-secondary w-100 fw-bold border-2" onClick={() => setFilters({from:'', to:'', bill_type:'', search:'', shop_id:''})}>RESET</button>
            </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="table-card shadow-sm border-0 bg-white rounded-3 overflow-hidden">
        <div className="table-responsive">
          <table className="table table-hover mb-0 text-uppercase align-middle">
            <thead className="bg-light">
              <tr>
                <th className="ps-4">Invoice #</th>
                <th>Date / Shop</th>
                <th>Customer Name</th>
                <th className="text-end">Grand Total</th>
                <th className="text-end" style={{color:'#d97706'}}>Discount</th>
                <th className="text-end">Paid</th>
                <th className="text-end">Balance</th>
                <th className="text-center">Status</th>
                <th className="text-end pe-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-5"><div className="spinner-border text-primary" /></td></tr>
              ) : invoices.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-5 text-muted fw-bold">NO SALES FOUND.</td></tr>
              ) : invoices.map(inv => {
                // Mirror the backend updatePaymentStatus() logic:
                // finance_amount counts as paid only when finance_payment_status === 'RECEIVED'
                const financePaid = inv.finance_payment_status === 'RECEIVED' ? parseFloat(inv.finance_amount || 0) : 0;
                const totalPaid = parseFloat(inv.total_paid || 0) + parseFloat(inv.exchange_paid || 0) + financePaid;
                const balance = Math.max(0, parseFloat(inv.grand_total) - totalPaid);
                return (
                  <tr key={inv.id} className={inv.is_cancelled ? 'opacity-50 text-decoration-line-through' : ''}>
                    <td className="ps-4">
                        <div className="fw-bold text-primary">{inv.invoice_no}</div>
                        <div className="d-flex flex-wrap gap-1 mt-1">
                          <span className={`badge x-small ${inv.bill_type === 'pakka' ? 'bg-success' : 'bg-warning text-dark'}`}>{inv.bill_type}</span>
                        </div>
                    </td>
                    <td>
                        <div className="fw-bold">{formatDate(inv.sale_date)}</div>
                        <div className="x-small text-muted">{inv.shop?.name}</div>
                    </td>
                    <td>
                        <div className="fw-bold text-dark">{inv.customer?.name}</div>
                        <div className="x-small text-muted">📞 {inv.customer?.phone}</div>
                    </td>
                    <td className="text-end fw-bold">₹{parseFloat(inv.grand_total).toLocaleString('en-IN')}</td>
                    <td className="text-end fw-bold" style={{color: (parseFloat(inv.discount||0)+parseFloat(inv.cash_discount||0)) > 0 ? '#d97706' : '#aaa'}}>
                      {(parseFloat(inv.discount||0)+parseFloat(inv.cash_discount||0)) > 0
                        ? `- ₹${(parseFloat(inv.discount||0)+parseFloat(inv.cash_discount||0)).toLocaleString('en-IN')}`
                        : '—'}
                    </td>
                    <td className="text-end fw-bold text-success">₹{parseFloat(inv.total_paid).toLocaleString('en-IN')}</td>
                    <td className="text-end fw-bold text-danger">₹{balance.toLocaleString('en-IN')}</td>
                    <td className="text-center">
                      {inv.is_cancelled ? (
                        <span className="badge bg-secondary">CANCELLED</span>
                      ) : (
                        <div className="d-flex flex-column align-items-center gap-1">
                          {getStatusBadge(inv.payment_status)}
                          {parseFloat(inv.finance_amount || 0) > 0 && (
                            inv.finance_payment_status === 'RECEIVED' ? (
                              <span className="badge x-small bg-info text-white">
                                EMI PAID: {inv.financer?.name || 'FINANCER'} (₹{parseFloat(inv.finance_amount).toLocaleString('en-IN')})
                              </span>
                            ) : (
                              <span 
                                className="badge x-small bg-danger text-white cursor-pointer" 
                                style={{ cursor: 'pointer' }}
                                title="Click to mark finance payment as received"
                                onClick={() => handleReceiveFinance(inv.id)}
                              >
                                EMI PEND: {inv.financer?.name || 'FINANCER'} (₹{parseFloat(inv.finance_amount).toLocaleString('en-IN')}) ⏳
                              </span>
                            )
                          )}
                        </div>
                      )}
                    </td>
                    <td className="text-end pe-4">
                        <div className="d-flex justify-content-end gap-1">
                            {!inv.is_cancelled && (
                                <>
                                    <button onClick={() => navigate(`/sales/${inv.id}`)} className="btn btn-xs btn-outline-info" title="View Details">VIEW</button>
                                    <button onClick={() => navigate(`/sales/${inv.id}/edit`)} className="btn btn-xs btn-outline-primary">EDIT</button>
                                    {inv.bill_type === 'kaccha' && <button onClick={() => convertToPakka(inv.id)} className="btn btn-xs btn-outline-success">PAKKA</button>}
                                    <button onClick={() => handleCancel(inv.id)} className="btn btn-xs btn-outline-warning">CANCEL</button>
                                </>
                            )}
                            <button onClick={() => handleDelete(inv.id)} className="btn btn-xs btn-outline-danger">DEL</button>
                        </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
          .x-small { font-size: 0.65rem; }
          .btn-xs { padding: 2px 6px; font-size: 0.7rem; font-weight: bold; }
      `}</style>
    </div>
  );
}
