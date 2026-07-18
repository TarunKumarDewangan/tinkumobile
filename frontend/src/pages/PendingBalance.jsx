import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../api/axios';

export default function PendingBalance() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [entityByName, setEntityByName] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [invRes, entRes] = await Promise.all([
        // Only used to find WHICH customers have an open sale — the balance
        // shown is their real net account balance (below), not a raw sum of
        // invoice balances. Summing invoice balances alone ignores any other
        // credit against the same account (e.g. stock bought back from that
        // same customer), which understates what they've actually settled.
        api.get('/sale-invoices', { params: { has_balance: 1, per_page: 1000 } }),
        api.get('/ledgers/entity-balances'),
      ]);
      setInvoices(invRes.data.data || invRes.data);
      const map = {};
      (entRes.data || []).forEach(e => { map[(e.name || '').toUpperCase()] = e; });
      setEntityByName(map);
    } catch (e) {
      toast.error('Failed to load pending balances');
    } finally {
      setLoading(false);
    }
  };

  // Which customers currently have at least one unpaid/partial sale invoice —
  // used only to decide who belongs on this page, not to compute the amount.
  const namesWithOpenSale = new Set();
  const phoneByName = {};
  invoices.forEach(inv => {
    const fp = inv.finance_plan;
    const financePaid = inv.finance_payment_status === 'RECEIVED' ? parseFloat(inv.finance_amount || 0) : 0;
    const displayPaid = fp
      ? parseFloat(fp.down_payment || 0) + parseFloat(fp.total_paid || 0)
      : parseFloat(inv.total_paid || 0) + parseFloat(inv.exchange_paid || 0) + financePaid;
    const balance = fp
      ? Math.max(0, parseFloat(fp.principal || 0) - parseFloat(fp.total_paid || 0))
      : Math.max(0, parseFloat(inv.grand_total) - displayPaid);
    if (balance > 0.01) {
      const name = inv.customer?.name || 'UNKNOWN';
      namesWithOpenSale.add(name.toUpperCase());
      phoneByName[name.toUpperCase()] = inv.customer?.phone || '';
    }
  });

  let customers = Array.from(namesWithOpenSale).map(key => {
    const entity = entityByName[key];
    return {
      name: entity?.name || key,
      phone: phoneByName[key] || entity?.phone || '',
      entityId: entity?.id || null,
      balance: parseFloat(entity?.net_balance ?? 0),
    };
  }).filter(c => c.balance > 0.01).sort((a, b) => b.balance - a.balance);

  const s = search.trim().toUpperCase();
  if (s) {
    customers = customers.filter(c => c.name.toUpperCase().includes(s) || c.phone.includes(s));
  }

  const totalBalance = customers.reduce((sum, c) => sum + c.balance, 0);

  const goToAccount = (c) => {
    if (c.entityId) {
      navigate(`/accounts/entity-ledger?id=${c.entityId}&name=${encodeURIComponent(c.name)}`);
    } else {
      navigate(`/accounts/entity-ledger?name=${encodeURIComponent(c.name)}`);
    }
  };

  return (
    <div className="container-fluid py-3">
      <div className="page-header mb-3">
        <h2 className="mb-0 fw-bold text-uppercase">💰 Pending Balance</h2>
        <p className="text-muted small mb-0 text-uppercase">Customers with unpaid / partially paid sales — New Mobile &amp; 2nd Hand Mobile combined</p>
      </div>

      <div className="card shadow-sm border-0 mb-3">
        <div className="card-body py-3">
          <input
            className="form-control"
            style={{ maxWidth: 320 }}
            placeholder="Search customer or phone..."
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
                <th style={{ width: 60 }}>S.No</th>
                <th>Entity Name</th>
                <th className="text-end">Balance</th>
                <th className="text-center" style={{ width: 120 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="text-center py-5"><div className="spinner-border text-primary" /></td></tr>
              ) : customers.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-5 text-muted fw-bold">🎉 No pending balances found</td></tr>
              ) : customers.map((c, idx) => (
                <tr key={c.name}>
                  <td className="fw-bold text-muted">{idx + 1}</td>
                  <td>
                    <span className="fw-bold text-decoration-underline cursor-pointer" style={{ color: '#1e293b' }} onClick={() => goToAccount(c)}>
                      {c.name}
                    </span>
                    {c.phone && <div className="x-small text-muted">📞 {c.phone}</div>}
                  </td>
                  <td className="text-end fw-bold text-danger" style={{ whiteSpace: 'nowrap' }}>₹{c.balance.toLocaleString('en-IN')}</td>
                  <td className="text-center">
                    <button className="btn btn-sm btn-outline-primary" onClick={() => goToAccount(c)}>VIEW</button>
                  </td>
                </tr>
              ))}
            </tbody>
            {!loading && customers.length > 0 && (
              <tfoot>
                <tr className="fw-bold bg-dark text-white">
                  <td colSpan={2} className="text-uppercase">Total ({customers.length} customers)</td>
                  <td className="text-end">₹{totalBalance.toLocaleString('en-IN')}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
