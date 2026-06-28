import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  const [searchParams] = useSearchParams();
  const category_group = searchParams.get('category_group') || 'new_mobile';
  const [showBackupModal, setShowBackupModal] = useState(false);

  const [filters, setFilters] = useState({ 
    from: '', to: '', bill_type: '', search: searchParams.get('search') || '', shop_id: '', is_old_mobile: false 
  });

  useEffect(() => {
    const q = searchParams.get('search') || '';
    setFilters(prev => ({ ...prev, search: q }));
  }, [searchParams]);

  useEffect(() => {
    loadInvoices();
    if (hasFullAccess()) {
        api.get('/shops').then(r => setShops(r.data));
    }
  }, [filters]);

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/sale-invoices', { params: { ...filters, category_group } });
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
      case 'paid': return <span className="badge-paid">PAID</span>;
      case 'partial': return <span className="badge-partial">PARTIAL</span>;
      case 'unpaid': return <span className="badge-unpaid">UNPAID</span>;
      default: return null;
    }
  };

  return (
    <div className="container-fluid py-3">
      <div className="page-header mb-3 d-flex justify-content-between align-items-center">
        <div className="text-uppercase">
           <h2 className="mb-0 fw-bold">🧾 {category_group === 'master' ? 'Master Sales Management' : (category_group === 'other' ? 'Other Sales Management' : 'SALES MANAGEMENT')}</h2>
           <p className="text-muted small mb-0">{category_group === 'master' ? 'MANAGE CUSTOMER INVOICES ACROSS ALL CATEGORIES' : (category_group === 'other' ? 'MANAGE CUSTOMER INVOICES FOR ACCESSORIES & SIM CARDS' : 'MANAGE CUSTOMER INVOICES, PAYMENTS AND BILLING')}</p>
        </div>
        <div className="d-flex gap-2">
          <button onClick={() => setShowBackupModal(true)} className="btn btn-outline-dark shadow-sm text-uppercase fw-bold">Backup / Restore</button>
          <button onClick={() => navigate(category_group === 'master' ? '/sales/new-master' : (category_group && category_group !== 'master' ? `/sales/new?category_group=${category_group}` : '/sales/new?category_group=new_mobile'))} className="btn btn-primary shadow-sm text-uppercase fw-bold">+ New Sale</button>
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
      <div className="card sales-card shadow-sm mb-4 p-3 bg-white">
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
                <button className="btn btn-sm btn-outline-secondary w-100 fw-bold border-2" onClick={() => setFilters({from:'', to:'', bill_type:'', search:'', shop_id:'', is_old_mobile: false})}>RESET</button>
            </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="sales-table-wrap bg-white">
        <div className="table-responsive">
          <table className="sales-table mb-0 text-uppercase">
            <thead>
              <tr>
                <th className="ps-4">Customer Name</th>
                <th>Date / Shop</th>
                <th className="text-end">Grand Total</th>
                <th className="text-end" style={{color:'#475569'}}>Discount</th>
                <th className="text-end">Paid</th>
                <th className="text-end">Balance</th>
                <th className="text-center" style={{width: '230px'}}>Actions</th>
                <th>Invoice #</th>
                <th className="text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-5"><div className="spinner-border text-primary" /></td></tr>
              ) : invoices.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-5 text-muted fw-bold">NO SALES FOUND.</td></tr>
              ) : invoices.map(inv => {
                const financePaid = inv.finance_payment_status === 'RECEIVED' ? parseFloat(inv.finance_amount || 0) : 0;
                const totalPaid = parseFloat(inv.total_paid || 0) + parseFloat(inv.exchange_paid || 0) + financePaid;
                const balance = Math.max(0, parseFloat(inv.grand_total) - totalPaid);
                return (
                  <tr key={inv.id} className={inv.is_cancelled ? 'opacity-50 text-decoration-line-through' : ''}>
                    {/* 1. Customer Name (clickable) */}
                    <td className="ps-4 cursor-pointer" onClick={() => navigate(category_group ? `/sales/${inv.id}?category_group=${category_group}` : `/sales/${inv.id}`)}>
                        <span className="fw-bold text-decoration-underline" style={{ color: '#1e293b' }}>{inv.customer?.name}</span>
                        <div className="x-small text-muted" style={{ textDecoration: 'none' }}>📞 {inv.customer?.phone}</div>
                    </td>

                    {/* 2. Date / Shop */}
                    <td>
                        <div className="fw-bold">{formatDate(inv.sale_date)}</div>
                        <div className="x-small text-muted">{inv.shop?.name}</div>
                    </td>

                    {/* 3. Grand Total */}
                    <td className="text-end fw-bold">₹{parseFloat(inv.grand_total).toLocaleString('en-IN')}</td>

                    {/* 4. Discount */}
                    <td className="text-end fw-bold" style={{color: '#475569'}}>
                      {(parseFloat(inv.discount||0)+parseFloat(inv.cash_discount||0)) > 0
                        ? `- ₹${(parseFloat(inv.discount||0)+parseFloat(inv.cash_discount||0)).toLocaleString('en-IN')}`
                        : '—'}
                    </td>

                    {/* 5. Paid */}
                    <td className="text-end fw-bold" style={{color: '#1e293b'}}>₹{parseFloat(inv.total_paid).toLocaleString('en-IN')}</td>

                    {/* 5b. Balance */}
                    <td className="text-end fw-bold" style={{color: balance > 0 ? '#1e293b' : '#64748b'}}>₹{balance.toLocaleString('en-IN')}</td>

                    {/* 6. Actions */}
                    <td className="text-center">
                        <div className="d-flex justify-content-center gap-1">
                            {!inv.is_cancelled && (
                                <>
                                    <button onClick={() => navigate(category_group ? `/sales/${inv.id}?category_group=${category_group}` : `/sales/${inv.id}`)} className="pm-act-btn btn-xs" title="View Details">VIEW</button>
                                    <button onClick={() => navigate(category_group === 'master' ? `/sales/${inv.id}/edit-master` : (category_group ? `/sales/${inv.id}/edit?category_group=${category_group}` : `/sales/${inv.id}/edit`))} className="pm-act-btn btn-xs">EDIT</button>
                                    {inv.bill_type === 'kaccha' && <button onClick={() => convertToPakka(inv.id)} className="pm-act-btn btn-xs">PAKKA</button>}
                                    <button onClick={() => handleCancel(inv.id)} className="pm-act-btn btn-xs">CANCEL</button>
                                </>
                            )}
                            <button onClick={() => handleDelete(inv.id)} className="pm-act-btn btn-xs" style={{color:'#b91c1c',borderColor:'#fca5a5'}}>DEL</button>
                        </div>
                    </td>

                    {/* 7. Invoice # (clickable) */}
                    <td className="cursor-pointer" onClick={() => navigate(category_group ? `/sales/${inv.id}?category_group=${category_group}` : `/sales/${inv.id}`)}>
                        <span className="fw-bold text-decoration-underline" style={{ color: '#1e293b' }}>{inv.invoice_no}</span>
                        <div className="d-flex flex-wrap gap-1 mt-1">
                          <span className="badge-received" style={{ fontSize: '0.6rem', padding: '2px 6px' }}>{inv.bill_type.toUpperCase()}</span>
                        </div>
                    </td>

                    {/* 8. Status */}
                    <td className="text-center">
                      {inv.is_cancelled ? (
                        <span className="badge-ordered">CANCELLED</span>
                      ) : (
                        <div className="d-flex flex-column align-items-center gap-1">
                          {getStatusBadge(inv.payment_status)}
                          {parseFloat(inv.finance_amount || 0) > 0 && (
                            inv.finance_payment_status === 'RECEIVED' ? (
                              <span className="badge-paid" style={{ fontSize: '0.6rem', marginTop: '2px' }}>
                                EMI PAID: {inv.financer?.name || 'FINANCER'} (₹{parseFloat(inv.finance_amount).toLocaleString('en-IN')})
                              </span>
                            ) : (
                              <span 
                                className="badge-unpaid cursor-pointer" 
                                style={{ fontSize: '0.6rem', marginTop: '2px', cursor: 'pointer' }}
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
          .sales-card {
              border: 1px solid #cbd5e1 !important;
              box-shadow: none !important;
              border-radius: 8px;
          }
          .sales-table-wrap {
              background: #fff;
              border-radius: 8px;
              overflow: hidden;
              border: 1px solid #cbd5e1;
              box-shadow: none !important;
          }
          .sales-table {
              width: 100%;
              border-collapse: collapse;
              font-size: .78rem;
          }
          .sales-table thead tr {
              background: #f1f5f9;
              border-bottom: 2px solid #cbd5e1;
          }
          .sales-table thead th {
              color: #1e293b;
              font-size: .65rem;
              font-weight: 700;
              letter-spacing: 1px;
              text-transform: uppercase;
              padding: 12px 14px;
              border: 1px solid #cbd5e1 !important;
          }
          .sales-table tbody tr {
              border-bottom: 1px solid #cbd5e1;
          }
          .sales-table tbody tr:hover {
              background: #f8fafc;
          }
          .sales-table td {
              padding: 12px 14px;
              vertical-align: top;
              border: 1px solid #cbd5e1 !important;
              color: #1e293b;
          }

          /* Desaturated Badges */
          .badge-ordered {
              background: #f8fafc;
              color: #475569;
              font-size: .6rem;
              font-weight: 700;
              padding: 3px 10px;
              border-radius: 4px;
              border: 1px solid #cbd5e1;
              letter-spacing: .5px;
              display: inline-block;
          }
          .badge-received {
              background: #f1f5f9;
              color: #1e293b;
              font-size: .6rem;
              font-weight: 700;
              padding: 3px 10px;
              border-radius: 4px;
              border: 1px solid #94a3b8;
              letter-spacing: .5px;
              display: inline-block;
          }
          .badge-unpaid {
              background: #fff;
              color: #b91c1c;
              font-size: .6rem;
              font-weight: 700;
              padding: 3px 8px;
              border-radius: 4px;
              border: 1px solid #fca5a5;
              display: inline-block;
          }
          .badge-partial {
              background: #fff;
              color: #0284c7;
              font-size: .6rem;
              font-weight: 700;
              padding: 3px 8px;
              border-radius: 4px;
              border: 1px solid #bae6fd;
              display: inline-block;
          }
          .badge-paid {
              background: #fff;
              color: #16a34a;
              font-size: .6rem;
              font-weight: 700;
              padding: 3px 8px;
              border-radius: 4px;
              border: 1px solid #bbf7d0;
              display: inline-block;
          }
          .cursor-pointer {
              cursor: pointer;
          }
      `}</style>
    </div>
  );
}
