import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../api/axios';
import { formatDate } from '../utils/formatters';
import { useAuth } from '../contexts/AuthContext';

export default function OldMobileSales() {
  const { isOwner } = useAuth();
  const navigate = useNavigate();

  // State
  const [invoices, setInvoices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [oldMobileCategoryId, setOldMobileCategoryId] = useState(null);
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [filters, setFilters] = useState({ 
    from: '', to: '', bill_type: '', search: '', shop_id: '' 
  });

  // Load Categories & Shops on mount
  useEffect(() => {
    api.get('/categories')
      .then(res => {
        const cat = res.data.find(c => c.slug === 'mobile-old' || c.name?.toLowerCase() === 'mobile old');
        if (cat) {
          setOldMobileCategoryId(cat.id);
        }
      })
      .catch(err => console.error(err));

    if (isOwner()) {
      api.get('/shops')
        .then(res => setShops(res.data))
        .catch(err => console.error(err));
    }
  }, [isOwner]);

  // Load Invoices when filters change
  const loadInvoices = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/sale-invoices', { params: filters });
      setInvoices(data.data || data);
    } catch (e) {
      toast.error('Failed to load sales');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, [filters]);

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this sale? Stock will be restored.')) return;
    try {
      await api.post(`/sale-invoices/${id}/cancel`);
      toast.success('Sale cancelled successfully');
      loadInvoices();
    } catch (e) { toast.error('Error cancelling sale'); }
  };

  // Filter invoices to only show those containing old mobile items
  const oldMobileInvoices = invoices.filter(inv => {
    if (!oldMobileCategoryId) return true; // If category not loaded yet, show all as fallback
    return inv.items?.some(item => item.product?.category_id === oldMobileCategoryId);
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'paid': return <span className="badge rounded-pill bg-success-subtle text-success border border-success-subtle px-3 py-1">PAID</span>;
      case 'partial': return <span className="badge rounded-pill bg-warning-subtle text-warning border border-warning-subtle px-3 py-1">PARTIAL</span>;
      case 'unpaid': return <span className="badge rounded-pill bg-danger-subtle text-danger border border-danger-subtle px-3 py-1">UNPAID</span>;
      default: return null;
    }
  };

  return (
    <div className="container-fluid px-4 py-4">
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h2 className="mb-1 text-dark d-flex align-items-center gap-2">
            <span>🧾</span> Used Mobile Sales
          </h2>
          <p className="text-muted mb-0">List of sales invoices containing second-hand or exchange mobiles.</p>
        </div>
        <button 
          onClick={() => navigate('/old-mobiles/sales/new?category=mobile-old')} 
          className="btn btn-primary d-flex align-items-center gap-2 px-4 py-2 shadow-sm rounded-pill hover-scale"
        >
          <span>➕</span> New Used Mobile Sale
        </button>
      </div>

      {/* Filters Card */}
      <div className="card border-0 bg-white border border-secondary-subtle-subtle shadow-sm rounded-4 p-4 mb-4">
        <div className="row g-3">
          <div className="col-12 col-md-3">
            <label className="form-label text-muted small fw-bold">Date Range</label>
            <div className="input-group">
              <input type="date" className="form-control bg-light text-dark border-secondary-subtle" value={filters.from} onChange={e => setFilters({...filters, from: e.target.value})} />
              <span className="input-group-text bg-light border-secondary-subtle text-muted">—</span>
              <input type="date" className="form-control bg-light text-dark border-secondary-subtle" value={filters.to} onChange={e => setFilters({...filters, to: e.target.value})} />
            </div>
          </div>
          <div className="col-12 col-md-2">
            <label className="form-label text-muted small fw-bold">Bill Type</label>
            <select className="form-select bg-light text-dark border-secondary-subtle" value={filters.bill_type} onChange={e => setFilters({...filters, bill_type: e.target.value})}>
              <option value="">ALL BILLS</option>
              <option value="kaccha">KACCHA</option>
              <option value="pakka">PAKKA</option>
            </select>
          </div>
          {isOwner() && (
            <div className="col-12 col-md-2">
              <label className="form-label text-muted small fw-bold">Shop Branch</label>
              <select className="form-select bg-light text-dark border-secondary-subtle" value={filters.shop_id} onChange={e => setFilters({...filters, shop_id: e.target.value})}>
                <option value="">ALL BRANCHES</option>
                {shops.map(s => <option key={s.id} value={s.id}>{s.name.toUpperCase()}</option>)}
              </select>
            </div>
          )}
          <div className="col-12 col-md-3">
            <label className="form-label text-muted small fw-bold">Search Invoice / Customer</label>
            <input type="text" className="form-control bg-light text-dark border-secondary-subtle text-uppercase" placeholder="Search by name, invoice..." value={filters.search} onChange={e => setFilters({...filters, search: e.target.value})} />
          </div>
          <div className="col-12 col-md-2 d-flex align-items-end">
            <button className="btn btn-outline-secondary w-100 fw-bold rounded-pill" onClick={() => setFilters({from:'', to:'', bill_type:'', search:'', shop_id:''})}>RESET</button>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="card border-0 bg-white border border-secondary-subtle-subtle shadow-sm rounded-4 overflow-hidden">
        {loading ? (
          <div className="d-flex justify-content-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table  table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th className="py-3 px-4 text-muted">Invoice #</th>
                  <th className="py-3 text-muted">Date / Branch</th>
                  <th className="py-3 text-muted">Customer</th>
                  <th className="py-3 text-muted">Sold Devices</th>
                  <th className="py-3 text-muted text-end">Grand Total</th>
                  <th className="py-3 text-muted text-end text-success">Paid (Cash/UPI)</th>
                  <th className="py-3 text-muted text-end text-info">Credit Applied</th>
                  <th className="py-3 text-muted text-center">Status</th>
                  <th className="py-3 px-4 text-muted text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {oldMobileInvoices.map(inv => {
                  const appliedCredit = parseFloat(inv.exchange_paid || 0);
                  const cashPaid = parseFloat(inv.total_paid || 0) - appliedCredit;
                  return (
                    <tr key={inv.id} className={`border-bottom-dark ${inv.is_cancelled ? 'opacity-50 text-decoration-line-through' : ''}`}>
                      <td className="py-3 px-4">
                        <div className="fw-bold text-primary">{inv.invoice_no}</div>
                        <span className={`badge x-small ${inv.bill_type === 'pakka' ? 'bg-success' : 'bg-warning text-dark'}`}>
                          {inv.bill_type.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="fw-bold text-dark">{formatDate(inv.sale_date)}</div>
                        <div className="x-small text-muted">{inv.shop?.name}</div>
                      </td>
                      <td className="py-3">
                        <div className="fw-bold text-dark">{inv.customer?.name}</div>
                        <small className="text-muted">📞 {inv.customer?.phone}</small>
                      </td>
                      <td className="py-3">
                        {inv.items?.map((item, idx) => (
                          <div key={idx} className="small text-dark">
                            • {item.product?.name} {item.color ? `(${item.color})` : ''}
                          </div>
                        ))}
                      </td>
                      <td className="py-3 text-end fw-bold text-dark">
                        ₹{parseFloat(inv.grand_total).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 text-end fw-bold text-success">
                        ₹{cashPaid.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 text-end fw-bold text-info">
                        {appliedCredit > 0 ? `₹${appliedCredit.toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td className="py-3 text-center">
                        {inv.is_cancelled ? (
                          <span className="badge bg-secondary">CANCELLED</span>
                        ) : (
                          getStatusBadge(inv.payment_status)
                        )}
                      </td>
                      <td className="py-3 px-4 text-end">
                        <div className="d-flex justify-content-end gap-2">
                          <button onClick={() => navigate(`/sales/${inv.id}`)} className="btn btn-sm btn-outline-info rounded-pill px-3">VIEW</button>
                          {!inv.is_cancelled && (
                            <button onClick={() => handleCancel(inv.id)} className="btn btn-sm btn-outline-warning rounded-pill px-3">CANCEL</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {oldMobileInvoices.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center py-5 text-muted">
                      <div className="fs-1 mb-2">🧾</div>
                      No used mobile sales invoices found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
