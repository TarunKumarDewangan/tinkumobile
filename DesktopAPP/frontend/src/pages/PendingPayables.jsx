import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../api/axios';
import SettlementModal from '../components/SettlementModal';
import NarrationBreakdown from '../components/NarrationBreakdown';
import { voucherTypeLabel } from '../utils/voucherTypeLabels';

// The mirror of Pending Balance: every party whose ledger closes on the
// credit side (Payable / Cr) — i.e. the shop owes them money. Suppliers and
// distributors mostly, but any entity (a customer with an advance, a shop we
// bought from, a financer) shows up if the shop owes it.
const TYPE_LABELS = {
  SUPPLIER: 'Supplier',
  DISTRIBUTOR: 'Distributor',
  SHOP: 'Shop',
  SHOP_CUSTOMER: 'Shop Customer',
  CUSTOMER: 'Customer',
  FINANCER: 'Financer',
  OTHER: 'Other',
};
const typeLabel = (t) => TYPE_LABELS[t] || (t ? t.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : 'Other');

export default function PendingPayables() {
  const navigate = useNavigate();
  const [entities, setEntities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('ALL');
  const [ledgerModal, setLedgerModal] = useState(null); // { row, loading, data }
  const [settleModal, setSettleModal] = useState(null); // { row }

  // Same Back-button highlight as Pending Balance, with its own key.
  const [highlightKey] = useState(() => {
    const key = sessionStorage.getItem('pendingPayablesHighlight');
    sessionStorage.removeItem('pendingPayablesHighlight');
    return key;
  });

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/ledgers/entity-balances');
      setEntities(data || []);
    } catch {
      toast.error('Failed to load payables');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Bank / Card / UPI are the shop's own money, not parties it owes.
  const allRows = entities
    .filter(e => !e.is_asset_account)
    .map(e => ({
      category: e.type || 'OTHER',
      name: e.name || '',
      phone: e.phone || '',
      entityId: e.id,
      balance: -parseFloat(e.net_balance ?? 0), // Cr balance → amount we owe
    }))
    .filter(r => r.balance > 0.01);

  const categories = ['ALL', ...Array.from(new Set(allRows.map(r => r.category))).sort()];

  let rows = category === 'ALL' ? allRows : allRows.filter(r => r.category === category);
  const s = search.trim().toUpperCase();
  if (s) rows = rows.filter(r => r.name.toUpperCase().includes(s) || r.phone.includes(s));
  rows = [...rows].sort((a, b) => b.balance - a.balance);
  const totalBalance = rows.reduce((sum, r) => sum + r.balance, 0);

  const goToAccount = (r) => {
    sessionStorage.setItem('pendingPayablesHighlight', `e${r.entityId}`);
    navigate(`/accounts/entity-ledger?id=${r.entityId}&name=${encodeURIComponent(r.name)}`);
  };

  const openLedgerModal = async (r) => {
    setLedgerModal({ row: r, loading: true, data: null });
    try {
      const { data } = await api.get(`/ledgers/statement/${r.entityId}`);
      setLedgerModal({ row: r, loading: false, data });
    } catch {
      toast.error('Failed to load ledger');
      setLedgerModal(null);
    }
  };

  const colCount = category === 'ALL' ? 5 : 4;

  return (
    <div className="container-fluid py-3">
      <div className="page-header mb-3">
        <h2 className="mb-0 fw-bold text-uppercase">🧾 Pending Payables</h2>
        <p className="text-muted small mb-0 text-uppercase">Parties the shop still has to pay — suppliers, distributors &amp; anyone with a payable (Cr) balance</p>
      </div>

      <div className="card shadow-sm border-0 mb-3">
        <div className="card-body py-3 d-flex flex-wrap gap-3 align-items-center">
          <input
            className="form-control"
            style={{ maxWidth: 320 }}
            placeholder="Search party or phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            className="form-select fw-bold"
            style={{ maxWidth: 260 }}
            value={category}
            onChange={e => setCategory(e.target.value)}
          >
            {categories.map(c => <option key={c} value={c}>{c === 'ALL' ? 'All' : typeLabel(c)}</option>)}
          </select>
          {!loading && (
            <span className="ms-auto fw-bold text-danger">
              Total to pay: ₹{totalBalance.toLocaleString('en-IN')}
            </span>
          )}
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
                <th className="text-end">Balance (To Pay)</th>
                <th className="text-center" style={{ width: 130 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={colCount} className="text-center py-5"><div className="spinner-border text-primary" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={colCount} className="text-center py-5 text-muted fw-bold">🎉 Nothing pending to pay</td></tr>
              ) : rows.map((r, idx) => {
                const rowKey = `e${r.entityId}`;
                const isHighlighted = highlightKey && rowKey === highlightKey;
                return (
                  <tr
                    key={rowKey}
                    ref={isHighlighted ? (el) => el?.scrollIntoView({ block: 'center' }) : undefined}
                    style={isHighlighted ? { background: '#e2e8f0' } : undefined}
                  >
                    <td className="fw-bold text-muted">{idx + 1}</td>
                    <td>
                      <span className="fw-bold text-decoration-underline cursor-pointer" style={{ color: '#1e293b' }} onClick={() => goToAccount(r)}>
                        {r.name}
                      </span>
                      {r.phone && <div className="x-small text-muted">📞 {r.phone}</div>}
                    </td>
                    {category === 'ALL' && (
                      <td><span className="badge bg-light text-dark border">{typeLabel(r.category)}</span></td>
                    )}
                    <td className="text-end fw-bold text-danger" style={{ whiteSpace: 'nowrap' }}>₹{r.balance.toLocaleString('en-IN')}</td>
                    <td className="text-center">
                      <div className="d-flex gap-1 justify-content-center">
                        <button className="btn btn-sm btn-outline-primary" onClick={() => openLedgerModal(r)}>VIEW</button>
                        <button
                          className="btn btn-sm btn-outline-dark"
                          title="Record a payment made to this party"
                          onClick={() => setSettleModal({ row: r })}
                        >
                          💵
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
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

      {ledgerModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1055 }}>
          <div className="modal-dialog modal-dialog-centered modal-xl">
            <div className="modal-content border-0 shadow-lg rounded-4">
              <div className="modal-header border-0 bg-dark text-white rounded-top-4 px-4 pt-4 pb-3">
                <div>
                  <h5 className="modal-title fw-bold mb-0 text-uppercase">{ledgerModal.row.name}</h5>
                  <div className="small opacity-75 d-flex gap-2 align-items-center mt-1">
                    <span className="badge bg-light text-dark">{ledgerModal.data?.entity?.type || 'Entity'}</span>
                    {ledgerModal.data && (
                      <span className={`fw-bold text-uppercase ${parseFloat(ledgerModal.data.closing_balance) >= 0 ? 'text-success' : 'text-danger'}`}>
                        {parseFloat(ledgerModal.data.closing_balance) >= 0 ? 'Receivable' : 'Payable'}
                      </span>
                    )}
                  </div>
                </div>
                <button className="btn-close btn-close-white" onClick={() => setLedgerModal(null)}></button>
              </div>
              <div className="modal-body p-0" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
                {ledgerModal.loading ? (
                  <div className="text-center py-5"><div className="spinner-border text-primary" /></div>
                ) : (
                  <>
                    <div className="d-flex gap-4 px-4 py-3 border-bottom bg-light">
                      <div><span className="x-small text-muted d-block">DEBIT TOTAL</span><span className="fw-bold">₹{(ledgerModal.data?.entries || []).reduce((sum, e) => sum + parseFloat(e.debit || 0), 0).toLocaleString('en-IN')}</span></div>
                      <div><span className="x-small text-muted d-block">CREDIT TOTAL</span><span className="fw-bold">₹{(ledgerModal.data?.entries || []).reduce((sum, e) => sum + parseFloat(e.credit || 0), 0).toLocaleString('en-IN')}</span></div>
                      <div><span className="x-small text-muted d-block">CLOSING BALANCE</span><span className="fw-bold">₹{Math.abs(parseFloat(ledgerModal.data?.closing_balance || 0)).toLocaleString('en-IN')} {parseFloat(ledgerModal.data?.closing_balance || 0) >= 0 ? 'Dr' : 'Cr'}</span></div>
                    </div>
                    <div className="table-responsive">
                      <table className="table table-hover align-middle mb-0">
                        <thead className="table-dark text-uppercase">
                          <tr>
                            <th>Date</th><th>Type</th>
                            <th className="text-end">Debit (Dr)</th><th className="text-end">Credit (Cr)</th>
                            <th className="text-end">Balance</th><th>Narration</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(ledgerModal.data?.entries || []).length === 0 ? (
                            <tr><td colSpan={6} className="text-center py-4 text-muted fw-bold">No ledger entries</td></tr>
                          ) : ledgerModal.data.entries.map((item, idx) => (
                            <tr key={idx}>
                              <td className="text-nowrap">{new Date(item.date).toLocaleDateString('en-GB')}</td>
                              <td><span className="badge bg-secondary">{voucherTypeLabel(item.display_type || item.voucher_type)}</span></td>
                              <td className="text-end">{parseFloat(item.debit || 0) > 0 ? `₹${parseFloat(item.debit).toLocaleString('en-IN')}` : '—'}</td>
                              <td className="text-end">{parseFloat(item.credit || 0) > 0 ? `₹${parseFloat(item.credit).toLocaleString('en-IN')}` : '—'}</td>
                              <td className="text-end fw-bold text-nowrap">₹{Math.abs(parseFloat(item.running_balance || 0)).toLocaleString('en-IN')} {parseFloat(item.running_balance || 0) >= 0 ? 'Dr' : 'Cr'}</td>
                              <td className="small">
                                <NarrationBreakdown breakdown={item.breakdown}>{item.particulars}</NarrationBreakdown>
                                {item.product_names && <>{' '}<mark className="px-1">{item.product_names}</mark></>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
              <div className="modal-footer border-0 px-4 pb-4 pt-2 gap-2">
                <button type="button" className="btn btn-light fw-bold px-4" onClick={() => setLedgerModal(null)}>Close</button>
                <button type="button" className="btn btn-primary fw-bold px-4" onClick={() => goToAccount(ledgerModal.row)}>
                  Open Full Ledger ↗
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <SettlementModal
        show={!!settleModal}
        entityId={settleModal?.row.entityId}
        entityName={settleModal?.row.name}
        currentBalance={settleModal ? -settleModal.row.balance : undefined}
        defaultType="OUT"
        onClose={() => setSettleModal(null)}
        onSuccess={load}
      />
    </div>
  );
}
