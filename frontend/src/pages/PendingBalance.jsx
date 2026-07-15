import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../api/axios';
import { formatDate } from '../utils/formatters';

const getStatusBadge = (status) => {
  switch (status) {
    case 'partial': return <span className="badge-partial">PARTIAL</span>;
    case 'unpaid': return <span className="badge-unpaid">UNPAID</span>;
    default: return null;
  }
};

export default function PendingBalance() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/sale-invoices', { params: { has_balance: 1, per_page: 1000 } });
      setInvoices(data.data || data);
    } catch (e) {
      toast.error('Failed to load pending balances');
    } finally {
      setLoading(false);
    }
  };

  const isOldMobile = (inv) => (inv.items || []).some(item => {
    const slug = (item.product?.category?.slug || item.product?.category?.name || '').toLowerCase();
    return slug.includes('mobile-old') || slug.includes('old');
  });

  const rows = invoices.map(inv => {
    const fp = inv.finance_plan;
    const financePaid = inv.finance_payment_status === 'RECEIVED' ? parseFloat(inv.finance_amount || 0) : 0;

    const displayPaid = fp
      ? parseFloat(fp.down_payment || 0) + parseFloat(fp.total_paid || 0)
      : parseFloat(inv.total_paid || 0) + parseFloat(inv.exchange_paid || 0) + financePaid;

    const balance = fp
      ? Math.max(0, parseFloat(fp.principal || 0) - parseFloat(fp.total_paid || 0))
      : Math.max(0, parseFloat(inv.grand_total) - displayPaid);

    return { ...inv, displayPaid, balance, category: isOldMobile(inv) ? '2ND HAND' : 'NEW MOBILE' };
  }).filter(r => r.balance > 0.01);

  const s = search.trim().toUpperCase();
  const filtered = s
    ? rows.filter(r =>
        (r.customer?.name || '').toUpperCase().includes(s) ||
        (r.customer?.phone || '').includes(s) ||
        (r.invoice_no || '').toUpperCase().includes(s)
      )
    : rows;

  const totalGrand = filtered.reduce((sum, r) => sum + parseFloat(r.grand_total || 0), 0);
  const totalPaid = filtered.reduce((sum, r) => sum + r.displayPaid, 0);
  const totalBalance = filtered.reduce((sum, r) => sum + r.balance, 0);

  return (
    <div className="container-fluid py-3">
      <div className="page-header mb-3">
        <h2 className="mb-0 fw-bold text-uppercase">💰 Pending Balance</h2>
        <p className="text-muted small mb-0 text-uppercase">All unpaid / partially paid sales — New Mobile &amp; 2nd Hand Mobile combined</p>
      </div>

      <div className="card shadow-sm border-0 mb-3">
        <div className="card-body py-3">
          <input
            className="form-control"
            style={{ maxWidth: 320 }}
            placeholder="Search customer, phone, or invoice #..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="card shadow-sm border-0">
        <div className="table-responsive">
          <table className="table table-bordered table-hover align-middle mb-0">
            <thead className="table-dark text-uppercase">
              <tr>
                <th>Date</th>
                <th>Customer</th>
                <th>Category</th>
                <th>Products</th>
                <th className="text-end">Grand Total</th>
                <th className="text-end">Paid</th>
                <th className="text-end">Balance</th>
                <th className="text-center">Status</th>
                <th>Invoice #</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="text-center py-5"><div className="spinner-border text-primary" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-5 text-muted fw-bold">🎉 No pending balances found</td></tr>
              ) : filtered.map(inv => (
                <tr key={inv.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <div className="fw-bold">{formatDate(inv.sale_date)}</div>
                    <div className="x-small text-muted">{inv.shop?.name}</div>
                  </td>
                  <td>
                    <span className="fw-bold text-decoration-underline cursor-pointer" style={{ color: '#1e293b' }} onClick={() => navigate(`/sales/${inv.id}`)}>
                      {inv.customer?.name}
                    </span>
                    <div className="x-small text-muted">📞 {inv.customer?.phone}</div>
                  </td>
                  <td>
                    <span className="badge" style={{ background: inv.category === 'NEW MOBILE' ? '#e0e7ff' : '#fef3c7', color: inv.category === 'NEW MOBILE' ? '#4338ca' : '#92400e', fontSize: '.65rem' }}>
                      {inv.category}
                    </span>
                  </td>
                  <td>
                    {inv.items?.map((item, idx) => {
                      const brandStr = item.product?.brand?.name || item.product?.attributes?.brand || '';
                      const fullName = `${brandStr ? brandStr + ' ' : ''}${item.product?.name || 'UNKNOWN'}`.toUpperCase();
                      return <div key={idx} className="x-small fw-bold">{fullName}</div>;
                    })}
                  </td>
                  <td className="text-end fw-bold" style={{ whiteSpace: 'nowrap' }}>₹{parseFloat(inv.grand_total).toLocaleString('en-IN')}</td>
                  <td className="text-end fw-bold" style={{ whiteSpace: 'nowrap' }}>₹{inv.displayPaid.toLocaleString('en-IN')}</td>
                  <td className="text-end fw-bold text-danger" style={{ whiteSpace: 'nowrap' }}>₹{inv.balance.toLocaleString('en-IN')}</td>
                  <td className="text-center">{getStatusBadge(inv.payment_status)}</td>
                  <td>
                    <span className="text-decoration-underline cursor-pointer" style={{ fontSize: '.78rem' }} onClick={() => navigate(`/sales/${inv.id}`)}>
                      {inv.invoice_no}
                    </span>
                  </td>
                  <td className="text-center">
                    <button className="btn btn-sm btn-outline-primary" onClick={() => navigate(`/sales/${inv.id}`)}>VIEW</button>
                  </td>
                </tr>
              ))}
            </tbody>
            {!loading && filtered.length > 0 && (
              <tfoot>
                <tr className="fw-bold bg-dark text-white">
                  <td colSpan={4} className="text-uppercase">Total ({filtered.length} invoices)</td>
                  <td className="text-end">₹{totalGrand.toLocaleString('en-IN')}</td>
                  <td className="text-end">₹{totalPaid.toLocaleString('en-IN')}</td>
                  <td className="text-end">₹{totalBalance.toLocaleString('en-IN')}</td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
