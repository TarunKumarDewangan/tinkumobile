import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../api/axios';

const CATEGORIES = [
  { id: 'ALL', label: 'All' },
  { id: 'CUSTOMER', label: 'Customer' },
  { id: 'SHOP_CUSTOMER', label: 'Shop Customer' },
  { id: 'PERSONAL_FINANCE', label: 'Personal Finance' },
  { id: 'COMPANY_FINANCE', label: 'Other Company Finance' },
];

export default function PendingBalance() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [entities, setEntities] = useState([]);
  const [entityByName, setEntityByName] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('ALL');

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      // Sale invoices are only needed for Personal Finance / Company Finance
      // below (those relationships only exist on the invoice, not on any
      // entity). Customer/Shop Customer now come straight from the entity
      // balances themselves, so ANY kind of pending debt shows up here —
      // repairs, loans, opening balances, not just an open sale invoice.
      const [invRes, entRes] = await Promise.all([
        api.get('/sale-invoices', { params: { has_balance: 1, per_page: 1000 } }),
        api.get('/ledgers/entity-balances'),
      ]);
      setInvoices(invRes.data.data || invRes.data);
      setEntities(entRes.data || []);
      const map = {};
      (entRes.data || []).forEach(e => { map[(e.name || '').toUpperCase()] = e; });
      setEntityByName(map);
    } catch (e) {
      toast.error('Failed to load pending balances');
    } finally {
      setLoading(false);
    }
  };

  const invoiceBalance = (inv) => {
    const fp = inv.finance_plan;
    const financePaid = inv.finance_payment_status === 'RECEIVED' ? parseFloat(inv.finance_amount || 0) : 0;
    const displayPaid = fp
      ? parseFloat(fp.down_payment || 0) + parseFloat(fp.total_paid || 0)
      : parseFloat(inv.total_paid || 0) + parseFloat(inv.exchange_paid || 0) + financePaid;
    // total_payable (principal + interest for Personal plans; equals principal
    // for Favor plans) matches what Finance Tracker shows as Due — using just
    // principal here understated the real amount owed by the interest portion.
    return fp
      ? Math.max(0, parseFloat(fp.total_payable || fp.principal || 0) - parseFloat(fp.total_paid || 0))
      : Math.max(0, parseFloat(inv.grand_total) - displayPaid);
  };

  // ── Build 4 mutually-independent groups, each with its own debtor and its
  // own definition of "balance" — these are genuinely different relationships,
  // not just a filter on one shared number. ──────────────────────────────────

  // 1 & 2: Customer / Shop Customer — ANY entity of that type with a
  // pending net balance, regardless of what created it (sale invoice,
  // repair, loan, opening balance, etc.) — not gated by having an open
  // sale invoice, so nothing with a real pending amount gets left out.
  const customerRows = entities
    .filter(e => e.type === 'CUSTOMER' || e.type === 'SHOP_CUSTOMER')
    .map(e => ({
      category: e.type,
      name: e.name,
      phone: e.phone || '',
      entityId: e.id,
      balance: parseFloat(e.net_balance ?? 0),
    }))
    .filter(r => r.balance > 0.01);

  // 3: Personal Finance (Shop Finance/EMI) — the customer's own EMI plan
  // balance, separate from their regular invoice balance above.
  const personalFinanceByCustomer = new Map();
  invoices.forEach(inv => {
    if (!inv.finance_plan) return;
    const bal = invoiceBalance(inv);
    if (bal <= 0.01) return;
    const name = inv.customer?.name || 'UNKNOWN';
    const key = name.toUpperCase();
    if (!personalFinanceByCustomer.has(key)) {
      personalFinanceByCustomer.set(key, { name, phone: inv.customer?.phone || '', balance: 0 });
    }
    personalFinanceByCustomer.get(key).balance += bal;
  });
  const personalFinanceRows = Array.from(personalFinanceByCustomer.values()).map(r => {
    const entity = entityByName[r.name.toUpperCase()];
    return { category: 'PERSONAL_FINANCE', ...r, entityId: entity?.id || null };
  });

  // 4: Other Company Finance — the financer company's own pending
  // receivable (what they still owe the shop for financed sales).
  const companyFinanceByFinancer = new Map();
  invoices.forEach(inv => {
    if (!inv.financer_id || inv.finance_payment_status === 'RECEIVED') return;
    const amt = parseFloat(inv.finance_amount || 0);
    if (amt <= 0.01) return;
    const key = inv.financer_id;
    if (!companyFinanceByFinancer.has(key)) {
      companyFinanceByFinancer.set(key, {
        name: inv.financer?.name || 'UNKNOWN FINANCER',
        phone: inv.financer?.phone || '',
        entityId: inv.financer_id,
        balance: 0,
      });
    }
    companyFinanceByFinancer.get(key).balance += amt;
  });
  const companyFinanceRows = Array.from(companyFinanceByFinancer.values()).map(r => ({ category: 'COMPANY_FINANCE', ...r }));

  const allRows = [...customerRows, ...personalFinanceRows, ...companyFinanceRows];

  let rows = category === 'ALL' ? allRows : allRows.filter(r => r.category === category);
  rows.sort((a, b) => b.balance - a.balance);

  const s = search.trim().toUpperCase();
  if (s) {
    rows = rows.filter(r => r.name.toUpperCase().includes(s) || r.phone.includes(s));
  }

  const totalBalance = rows.reduce((sum, r) => sum + r.balance, 0);

  const goToAccount = (r) => {
    if (r.entityId) {
      navigate(`/accounts/entity-ledger?id=${r.entityId}&name=${encodeURIComponent(r.name)}`);
    } else {
      navigate(`/accounts/entity-ledger?name=${encodeURIComponent(r.name)}`);
    }
  };

  const categoryLabel = (cat) => CATEGORIES.find(c => c.id === cat)?.label || cat;

  return (
    <div className="container-fluid py-3">
      <div className="page-header mb-3">
        <h2 className="mb-0 fw-bold text-uppercase">💰 Pending Balance</h2>
        <p className="text-muted small mb-0 text-uppercase">Customers with unpaid / partially paid sales — New Mobile &amp; 2nd Hand Mobile combined</p>
      </div>

      <div className="card shadow-sm border-0 mb-3">
        <div className="card-body py-3 d-flex flex-wrap gap-3 align-items-center">
          <input
            className="form-control"
            style={{ maxWidth: 320 }}
            placeholder="Search customer or phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            className="form-select fw-bold"
            style={{ maxWidth: 260 }}
            value={category}
            onChange={e => setCategory(e.target.value)}
          >
            {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
      </div>

      <div className="card shadow-sm border-0">
        <div className="table-responsive">
          <table className="table table-bordered table-hover align-middle mb-0">
            <thead className="table-dark text-uppercase">
              <tr>
                <th style={{ width: 60 }}>S.No</th>
                <th>Entity Name</th>
                {category === 'ALL' && <th style={{ width: 180 }}>Category</th>}
                <th className="text-end">Balance</th>
                <th className="text-center" style={{ width: 120 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={category === 'ALL' ? 5 : 4} className="text-center py-5"><div className="spinner-border text-primary" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={category === 'ALL' ? 5 : 4} className="text-center py-5 text-muted fw-bold">🎉 No pending balances found</td></tr>
              ) : rows.map((r, idx) => (
                <tr key={r.category + '-' + r.name}>
                  <td className="fw-bold text-muted">{idx + 1}</td>
                  <td>
                    <span className="fw-bold text-decoration-underline cursor-pointer" style={{ color: '#1e293b' }} onClick={() => goToAccount(r)}>
                      {r.name}
                    </span>
                    {r.phone && <div className="x-small text-muted">📞 {r.phone}</div>}
                  </td>
                  {category === 'ALL' && (
                    <td>
                      <span className="badge bg-light text-dark border">{categoryLabel(r.category)}</span>
                    </td>
                  )}
                  <td className="text-end fw-bold text-danger" style={{ whiteSpace: 'nowrap' }}>₹{r.balance.toLocaleString('en-IN')}</td>
                  <td className="text-center">
                    <button className="btn btn-sm btn-outline-primary" onClick={() => goToAccount(r)}>VIEW</button>
                  </td>
                </tr>
              ))}
            </tbody>
            {!loading && rows.length > 0 && (
              <tfoot>
                <tr className="fw-bold bg-dark text-white">
                  <td colSpan={category === 'ALL' ? 3 : 2} className="text-uppercase">Total ({rows.length})</td>
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
