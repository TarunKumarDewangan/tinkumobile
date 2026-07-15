import { useState, useEffect, useMemo } from 'react';
import pinGate from '../../utils/pinGate';
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
    from: '', to: '', bill_type: '', search: searchParams.get('search') || '', shop_id: '', is_old_mobile: false, customer_category: '',
    model: '', color: '', imei: ''
  });
  const [sortMode, setSortMode] = useState('date'); // 'date' | 'entry'
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 });

  useEffect(() => {
    const q = searchParams.get('search') || '';
    setFilters(prev => ({ ...prev, search: q }));
  }, [searchParams]);

  useEffect(() => {
    setPage(1);
  }, [filters, perPage]);

  useEffect(() => {
    loadInvoices();
    if (hasFullAccess()) {
        api.get('/shops').then(r => setShops(r.data));
    }
  }, [filters, page, perPage]);

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/sale-invoices', {
        params: { ...filters, category_group, page, per_page: perPage === 'all' ? 1000000 : perPage }
      });
      // If data.data exists (pagination), use it; otherwise use data
      setInvoices(data.data || data);
      if (data.meta) setMeta(data.meta);
    } catch (e) {
      toast.error('Failed to load sales');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (id) => {
    if (!await pinGate.confirm()) return;
    try {
      await api.post(`/sale-invoices/${id}/cancel`);
      toast.success('Sale cancelled successfully');
      loadInvoices();
    } catch (e) { toast.error('Error cancelling sale'); }
  };

  const handleReceiveFinance = async (id) => {
    if (!await pinGate.confirm()) return;
    try {
      await api.post(`/sale-invoices/${id}/receive-finance`);
      toast.success('Finance payment marked as received');
      loadInvoices();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to update finance status');
    }
  };

  const handleDelete = async (id) => {
    if (!await pinGate.confirm()) return;
    try {
      await api.delete(`/sale-invoices/${id}`);
      toast.success('Invoice deleted');
      loadInvoices();
    } catch (e) { toast.error('Error deleting invoice'); }
  };

  const convertToPakka = async (id) => {
    if (!await pinGate.confirm()) return;
    try {
      const res = await api.post(`/sale-invoices/${id}/convert-to-pakka`);
      toast.success(`Pakka bill created: ${res.data.invoice_no}`);
      loadInvoices();
    } catch (e) { toast.error('Conversion failed'); }
  };

  const sortedInvoices = useMemo(() => {
    const arr = [...invoices];
    if (sortMode === 'entry') {
      arr.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
    } else {
      arr.sort((a, b) => new Date(b.sale_date) - new Date(a.sale_date));
    }
    return arr;
  }, [invoices, sortMode]);

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
      <div className="card sales-card shadow-sm mb-3 p-3 bg-white">
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
            <div className="col-12 col-md-2">
                <label className="small text-muted mb-1 fw-bold">Customer Type</label>
                <select className="form-select form-select-sm" value={filters.customer_category} onChange={e => setFilters({...filters, customer_category: e.target.value})}>
                    <option value="">ALL CUSTOMERS</option>
                    <option value="REGULAR">REGULAR</option>
                    <option value="SHOP">SHOP / DEALER</option>
                    <option value="WALK_IN">WALK-IN (NO ACCOUNT)</option>
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
            <div className="col-12 col-md-2">
                <label className="small text-muted mb-1 fw-bold">Model</label>
                <input type="text" className="form-control form-control-sm text-uppercase" placeholder="E.G. VIVO Y11" value={filters.model} onChange={e => setFilters({...filters, model: e.target.value})} />
            </div>
            <div className="col-12 col-md-2">
                <label className="small text-muted mb-1 fw-bold">Color</label>
                <input type="text" className="form-control form-control-sm text-uppercase" placeholder="E.G. BLACK" value={filters.color} onChange={e => setFilters({...filters, color: e.target.value})} />
            </div>
            <div className="col-12 col-md-2">
                <label className="small text-muted mb-1 fw-bold">IMEI</label>
                <input type="text" className="form-control form-control-sm" placeholder="E.G. 3546..." value={filters.imei} onChange={e => setFilters({...filters, imei: e.target.value})} />
            </div>
            <div className="col-12 col-md-2 d-flex align-items-end">
                <button className="btn btn-sm btn-outline-secondary w-100 fw-bold border-2" onClick={() => setFilters({from:'', to:'', bill_type:'', search:'', shop_id:'', is_old_mobile: false, customer_category: '', model: '', color: '', imei: ''})}>RESET</button>
            </div>
        </div>

        {/* Sort toggle */}
        <div className="d-flex align-items-center gap-2 mt-3 pt-2" style={{ borderTop: '1px solid #e2e8f0' }}>
          <span className="x-small text-muted fw-bold text-uppercase" style={{ whiteSpace: 'nowrap' }}>View By:</span>
          <button
            className={`sort-toggle-btn ${sortMode === 'date' ? 'active' : ''}`}
            onClick={() => setSortMode('date')}
          >
            📅 Sale Date
          </button>
          <button
            className={`sort-toggle-btn ${sortMode === 'entry' ? 'active' : ''}`}
            onClick={() => setSortMode('entry')}
          >
            🕒 Last Modified
          </button>
          <span className="x-small text-muted ms-1">
            {sortMode === 'entry' ? '— showing most recently added / edited entries first' : '— showing newest sale date first'}
          </span>
          <div className="ms-auto d-flex align-items-center gap-2">
            <span className="x-small text-muted fw-bold text-uppercase" style={{ whiteSpace: 'nowrap' }}>Show:</span>
            <select
              className="form-select form-select-sm"
              style={{ width: 'auto', fontSize: '.7rem', fontWeight: 700 }}
              value={perPage}
              onChange={e => setPerPage(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            >
              {[25, 50, 100, 200, 500, 1000].map(n => <option key={n} value={n}>{n}</option>)}
              <option value="all">ALL</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="sales-table-wrap bg-white">
        <div className="table-responsive">
          <table className="sales-table mb-0 text-uppercase">
            <thead>
              <tr>
                <th>Date / Shop</th>
                <th className="ps-3">Customer Name</th>
                <th>Products & Description</th>
                <th className="text-end">Grand Total</th>
                <th className="text-end" style={{color:'#475569'}}>Discount</th>
                <th className="text-end" style={{color:'#0891b2'}}>Exchange Credit</th>
                <th className="text-end">Paid</th>
                <th className="text-end">Total Paid</th>
                <th className="text-end">Balance</th>
                <th className="text-center">Status</th>
                <th>Invoice #</th>
                <th className="text-center" style={{width: '230px'}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={12} className="text-center py-5"><div className="spinner-border text-primary" /></td></tr>
              ) : sortedInvoices.length === 0 ? (
                <tr><td colSpan={12} className="text-center py-5 text-muted fw-bold">NO SALES FOUND.</td></tr>
              ) : sortedInvoices.map(inv => {
                const fp = inv.finance_plan; // SaleFinancePlan (Personal EMI / Favor)
                const financePaid = inv.finance_payment_status === 'RECEIVED' ? parseFloat(inv.finance_amount || 0) : 0;

                // For personal/favor finance: paid = down_payment + installments collected so far
                // For normal/financer sales: paid = total_paid + exchange_paid + finance_received
                const displayPaid = fp
                  ? parseFloat(fp.down_payment || 0) + parseFloat(fp.total_paid || 0)
                  : parseFloat(inv.total_paid || 0) + parseFloat(inv.exchange_paid || 0) + financePaid;

                // Balance: for personal/favor = remaining principal unpaid; for others = usual calc
                const balance = fp
                  ? Math.max(0, parseFloat(fp.principal || 0) - parseFloat(fp.total_paid || 0))
                  : Math.max(0, parseFloat(inv.grand_total) - displayPaid);
                const navTo = (path) => navigate(category_group ? `${path}?category_group=${category_group}` : path);
                return (
                  <tr key={inv.id} className={inv.is_cancelled ? 'opacity-50 text-decoration-line-through' : ''}>

                    {/* 1. Date / Shop */}
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <div className="fw-bold">{formatDate(inv.sale_date)}</div>
                      <div className="x-small text-muted">{inv.shop?.name}</div>
                      {sortMode === 'entry' && inv.updated_at && (
                        <div className="x-small" style={{ color: '#94a3b8', marginTop: '2px' }}>
                          edited {formatDate(inv.updated_at)}
                        </div>
                      )}
                    </td>

                    {/* 2. Customer Name */}
                    <td className="ps-3 cursor-pointer" onClick={() => navTo(`/sales/${inv.id}`)}>
                      <span className="fw-bold text-decoration-underline" style={{ color: '#1e293b' }}>{inv.customer?.name}</span>
                      <div className="x-small text-muted" style={{ textDecoration: 'none' }}>📞 {inv.customer?.phone}</div>
                    </td>

                    {/* 3. Products & Description (with specs) */}
                    <td>
                      {inv.items?.map((item, idx) => {
                        const brandStr = item.product?.brand?.name || item.product?.attributes?.brand || '';
                        const fullName = `${brandStr ? brandStr + ' ' : ''}${item.product?.name || 'UNKNOWN PRODUCT'}`.toUpperCase();
                        const specs = [item.ram, item.storage, item.color].filter(Boolean).join(' / ');
                        const imei = item.imei ? item.imei.split(',')[0] : '';
                        return (
                          <div key={idx} style={{ borderBottom: idx < inv.items.length - 1 ? '1px dashed #cbd5e1' : 'none', paddingBottom: idx < inv.items.length - 1 ? '6px' : '0', marginBottom: idx < inv.items.length - 1 ? '6px' : '0' }}>
                            <div className="fw-bold" style={{ fontSize: '.75rem', color: '#1e293b' }}>{fullName}</div>
                            {specs && (
                              <div className="x-small fw-semibold" style={{ color: '#475569', marginTop: '2px' }}>{specs}</div>
                            )}
                            {imei && (
                              <div className="x-small" style={{ color: '#94a3b8', marginTop: '1px' }}>IMEI: {imei}</div>
                            )}
                            {item.description && (
                              <div className="x-small text-muted" style={{ marginTop: '2px' }}>{item.description}</div>
                            )}
                          </div>
                        );
                      })}
                    </td>

                    {/* 4. Grand Total */}
                    <td className="text-end fw-bold" style={{ whiteSpace: 'nowrap' }}>₹{parseFloat(inv.grand_total).toLocaleString('en-IN')}</td>

                    {/* 5. Discount */}
                    <td className="text-end fw-bold" style={{ color: '#475569', whiteSpace: 'nowrap' }}>
                      {(parseFloat(inv.discount||0)+parseFloat(inv.cash_discount||0)) > 0
                        ? `- ₹${(parseFloat(inv.discount||0)+parseFloat(inv.cash_discount||0)).toLocaleString('en-IN')}`
                        : '—'}
                    </td>

                    {/* 5b. Exchange Credit — old phone traded in as part payment */}
                    <td className="text-end fw-bold" style={{ color: '#0891b2', whiteSpace: 'nowrap' }}>
                      {parseFloat(inv.exchange_paid || 0) > 0
                        ? `₹${parseFloat(inv.exchange_paid).toLocaleString('en-IN')}`
                        : '—'}
                    </td>

                    {/* 6a. Paid — actual cash/card handed over, NOT including exchange credit or finance */}
                    <td className="text-end fw-bold" style={{ whiteSpace: 'nowrap' }}>
                      ₹{(fp ? parseFloat(fp.down_payment || 0) + parseFloat(fp.total_paid || 0) : parseFloat(inv.total_paid || 0)).toLocaleString('en-IN')}
                    </td>

                    {/* 6b. Total Paid — cash + exchange credit + finance received (equals Grand Total when fully settled) */}
                    <td className="text-end fw-bold" style={{ whiteSpace: 'nowrap' }}>
                      ₹{displayPaid.toLocaleString('en-IN')}
                      {fp && parseFloat(fp.down_payment || 0) > 0 && parseFloat(fp.total_paid || 0) === 0 && (
                        <div style={{ fontSize: '.58rem', color: '#94a3b8', fontWeight: 400 }}>
                          ↓ DOWN PMT
                        </div>
                      )}
                    </td>

                    {/* 7. Balance */}
                    <td className="text-end fw-bold" style={{ color: balance > 0 ? '#b91c1c' : '#16a34a', whiteSpace: 'nowrap' }}>
                      ₹{balance.toLocaleString('en-IN')}
                    </td>

                    {/* 8. Status */}
                    <td className="text-center">
                      {inv.is_cancelled ? (
                        <span className="badge-ordered">CANCELLED</span>
                      ) : (
                        <div className="d-flex flex-column align-items-center gap-1">
                          {/* Personal / Favor Finance badge — replaces generic payment_status */}
                          {fp ? (
                            <>
                              <span style={{
                                background: fp.type === 'PERSONAL' ? '#eff6ff' : '#ecfeff',
                                color:      fp.type === 'PERSONAL' ? '#1d4ed8' : '#0891b2',
                                fontSize: '.6rem', fontWeight: 800,
                                padding: '2px 7px', borderRadius: 20, display: 'inline-block',
                              }}>
                                {fp.type === 'PERSONAL' ? '📅 PERSONAL FINANCE' : '🤝 FAVOR FINANCE'}
                              </span>
                              <span style={{
                                background: fp.status === 'SETTLED' ? '#f1f5f9' : fp.status === 'OVERDUE' ? '#fef2f2' : '#f0fdf4',
                                color:      fp.status === 'SETTLED' ? '#64748b' : fp.status === 'OVERDUE' ? '#dc2626' : '#16a34a',
                                fontSize: '.58rem', fontWeight: 700,
                                padding: '1px 6px', borderRadius: 20, display: 'inline-block',
                              }}>
                                {fp.status}
                              </span>
                            </>
                          ) : (
                            <>
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
                            </>
                          )}
                        </div>
                      )}
                    </td>

                    {/* 9. Invoice # */}
                    <td className="cursor-pointer" onClick={() => navTo(`/sales/${inv.id}`)}>
                      <span className="fw-bold text-decoration-underline" style={{ color: '#1e293b' }}>{inv.invoice_no}</span>
                      <div className="d-flex flex-wrap gap-1 mt-1">
                        <span className="badge-received" style={{ fontSize: '0.6rem', padding: '2px 6px' }}>{inv.bill_type.toUpperCase()}</span>
                      </div>
                    </td>

                    {/* 10. Actions */}
                    <td className="text-center">
                      <div className="d-flex justify-content-center gap-1 flex-wrap">
                        {!inv.is_cancelled && (
                          <>
                            <button onClick={() => navTo(`/sales/${inv.id}`)} className="pm-act-btn btn-xs" title="View Details">VIEW</button>
                            <button onClick={() => navigate(category_group === 'master' ? `/sales/${inv.id}/edit-master` : `/sales/${inv.id}/edit${category_group ? `?category_group=${category_group}` : ''}`)} className="pm-act-btn btn-xs">EDIT</button>
                            {inv.bill_type === 'kaccha' && <button onClick={() => convertToPakka(inv.id)} className="pm-act-btn btn-xs">PAKKA</button>}
                            <button onClick={() => handleCancel(inv.id)} className="pm-act-btn btn-xs">CANCEL</button>
                          </>
                        )}
                        <button onClick={() => handleDelete(inv.id)} className="pm-act-btn btn-xs" style={{color:'#b91c1c',borderColor:'#fca5a5'}}>DEL</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {meta.total > 0 && (
        <div className="d-flex justify-content-between align-items-center mt-3 px-1 flex-wrap gap-2">
          <div className="text-muted small text-uppercase fw-bold">
            Showing <span className="text-dark">{invoices.length}</span> of <span className="text-dark">{meta.total}</span> entries
            {meta.last_page > 1 && <> — page <span className="text-dark">{meta.current_page}</span> of <span className="text-dark">{meta.last_page}</span></>}
          </div>
          {meta.last_page > 1 && (
            <div className="d-flex align-items-center gap-1">
              <button className="btn btn-sm btn-outline-secondary rounded-pill px-3 fw-bold" style={{fontSize:'.72rem'}} disabled={page === 1} onClick={() => setPage(1)}>First</button>
              <button className="btn btn-sm btn-outline-secondary rounded-pill px-3 fw-bold" style={{fontSize:'.72rem'}} disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Prev</button>
              {(() => {
                const pages = [];
                let start = Math.max(1, page - 2);
                let end = Math.min(meta.last_page, start + 4);
                if (end - start + 1 < 5) start = Math.max(1, end - 4);
                for (let i = start; i <= end; i++) pages.push(i);
                return pages.map(p => (
                  <button
                    key={p}
                    className={`btn btn-sm rounded-circle d-flex align-items-center justify-content-center fw-bold ${page === p ? 'btn-primary text-white' : 'btn-outline-secondary'}`}
                    style={{ width: 32, height: 32, fontSize: '.72rem' }}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </button>
                ));
              })()}
              <button className="btn btn-sm btn-outline-secondary rounded-pill px-3 fw-bold" style={{fontSize:'.72rem'}} disabled={page === meta.last_page} onClick={() => setPage(p => Math.min(meta.last_page, p + 1))}>Next</button>
              <button className="btn btn-sm btn-outline-secondary rounded-pill px-3 fw-bold" style={{fontSize:'.72rem'}} disabled={page === meta.last_page} onClick={() => setPage(meta.last_page)}>Last</button>
            </div>
          )}
        </div>
      )}

      <style>{`
          .x-small { font-size: 0.65rem; }
          .btn-xs { padding: 2px 6px; font-size: 0.7rem; font-weight: bold; }
          .sort-toggle-btn {
              padding: 3px 12px;
              font-size: 0.68rem;
              font-weight: 700;
              border-radius: 20px;
              border: 1.5px solid #cbd5e1;
              background: #f8fafc;
              color: #64748b;
              cursor: pointer;
              letter-spacing: 0.3px;
              transition: all 0.15s;
              text-transform: uppercase;
          }
          .sort-toggle-btn:hover { border-color: #94a3b8; color: #1e293b; }
          .sort-toggle-btn.active {
              background: #1e293b;
              color: #fff;
              border-color: #1e293b;
          }
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
