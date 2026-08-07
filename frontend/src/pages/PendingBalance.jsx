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

const defaultReminderMessage = (name, balance) =>
  `Dear ${name},\n\nThis is a reminder from *Tinku Mobiles* that you have a pending balance of *₹${Number(balance).toLocaleString('en-IN')}*.\n\nPlease clear it at your earliest convenience. Thank you!\n\n_Tinku Mobiles Management System_`;

export default function PendingBalance() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [entities, setEntities] = useState([]);
  const [entityByName, setEntityByName] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('ALL');
  const [reminderModal, setReminderModal] = useState(null); // { row, message, sending }
  const [noteModal, setNoteModal] = useState(null); // { row, promise_date, note, saving }
  const [notes, setNotes] = useState([]);
  const [notesOnly, setNotesOnly] = useState(false);

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
      const [invRes, entRes, notesRes] = await Promise.all([
        api.get('/sale-invoices', { params: { has_balance: 1, per_page: 1000 } }),
        api.get('/ledgers/entity-balances'),
        api.get('/entity-notes'),
      ]);
      setInvoices(invRes.data.data || invRes.data);
      setEntities(entRes.data || []);
      setNotes(notesRes.data || []);
      const map = {};
      (entRes.data || []).forEach(e => { map[(e.name || '').toUpperCase()] = e; });
      setEntityByName(map);
    } catch (e) {
      toast.error('Failed to load pending balances');
    } finally {
      setLoading(false);
    }
  };

  // Latest promise-to-pay note for a row — matched by entity first, falling
  // back to name+phone for rows without a resolvable entity (e.g. some
  // Personal Finance rows).
  const latestNoteForRow = (r) => {
    const candidates = notes.filter(n =>
      n.status === 'PENDING' && (
        (r.entityId && n.entity_id === r.entityId) ||
        (!n.entity_id && (n.name || '').toUpperCase() === (r.name || '').toUpperCase() && (n.phone || '') === (r.phone || ''))
      )
    );
    if (candidates.length === 0) return null;
    return candidates.reduce((latest, n) => (!latest || n.created_at > latest.created_at ? n : latest), null);
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

  // 3: Personal Finance (Shop Finance/EMI) — a fallback only. A shop-financed
  // sale posts its full amount (plus interest, minus EMI collections) to the
  // customer's own Entity ledger, so whenever that entity exists it's already
  // counted once in customerRows above — adding this on top would double-count
  // the exact same debt. This only fills the balance in for the rare case
  // where the customer has no resolvable Entity (so customerRows misses them).
  const personalFinanceByCustomer = new Map();
  invoices.forEach(inv => {
    if (!inv.finance_plan) return;
    const name = inv.customer?.name || 'UNKNOWN';
    if (entityByName[name.toUpperCase()]) return; // already counted via customerRows
    const bal = invoiceBalance(inv);
    if (bal <= 0.01) return;
    const key = name.toUpperCase();
    if (!personalFinanceByCustomer.has(key)) {
      personalFinanceByCustomer.set(key, { name, phone: inv.customer?.phone || '', balance: 0 });
    }
    personalFinanceByCustomer.get(key).balance += bal;
  });
  const personalFinanceRows = Array.from(personalFinanceByCustomer.values()).map(r => ({ category: 'PERSONAL_FINANCE', ...r, entityId: null }));

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

  // Same person can carry a regular Customer balance and a separate Personal
  // Finance/EMI balance — genuinely different relationships (see comment
  // above), but showing them as two rows for the same name/phone reads as a
  // confusing duplicate. When viewing "All", merge them into one row with
  // a combined total and a badge per category instead.
  if (category === 'ALL') {
    const merged = new Map();
    rows.forEach(r => {
      const key = r.entityId ? `e${r.entityId}` : `${r.name.toUpperCase()}|${r.phone}`;
      if (!merged.has(key)) {
        merged.set(key, { ...r, categories: [r.category], balance: 0, entityId: r.entityId || null });
      }
      const m = merged.get(key);
      m.balance += r.balance;
      if (!m.entityId && r.entityId) m.entityId = r.entityId;
      if (!m.categories.includes(r.category)) m.categories.push(r.category);
    });
    rows = Array.from(merged.values());
  }

  rows = rows.map(r => {
    const latest = latestNoteForRow(r);
    return { ...r, noteDate: latest?.promise_date || null };
  });
  rows.sort((a, b) => b.balance - a.balance);

  const s = search.trim().toUpperCase();
  if (s) {
    rows = rows.filter(r => r.name.toUpperCase().includes(s) || r.phone.includes(s));
  }

  if (notesOnly) {
    rows = rows.filter(r => r.noteDate);
  }

  const totalBalance = rows.reduce((sum, r) => sum + r.balance, 0);

  const openReminderModal = (r) => {
    setReminderModal({ row: r, message: defaultReminderMessage(r.name, r.balance), sending: false });
  };

  const sendReminder = async () => {
    if (!reminderModal) return;
    setReminderModal(m => ({ ...m, sending: true }));
    try {
      const { data } = await api.post('/pending-balance/send-reminder', {
        name: reminderModal.row.name,
        phone: reminderModal.row.phone,
        message: reminderModal.message,
      });
      toast.success(data.message || 'Reminder sent');
      setReminderModal(null);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to send reminder');
      setReminderModal(m => ({ ...m, sending: false }));
    }
  };

  const openNoteModal = (r) => {
    setNoteModal({ row: r, promise_date: new Date().toISOString().slice(0, 10), note: '', saving: false });
  };

  const saveNote = async () => {
    if (!noteModal) return;
    setNoteModal(m => ({ ...m, saving: true }));
    try {
      const { data } = await api.post('/entity-notes', {
        entity_id: noteModal.row.entityId || null,
        name: noteModal.row.name,
        phone: noteModal.row.phone || null,
        category: noteModal.row.category,
        promise_date: noteModal.promise_date,
        note: noteModal.note,
        balance_at_time: noteModal.row.balance,
      });
      setNotes(prev => [...prev, data]);
      toast.success('Promise-to-pay note saved');
      setNoteModal(null);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to save note');
      setNoteModal(m => ({ ...m, saving: false }));
    }
  };

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
          <button
            type="button"
            className={`btn btn-sm rounded-pill fw-bold ${notesOnly ? 'btn-warning' : 'btn-outline-secondary'}`}
            onClick={() => setNotesOnly(v => !v)}
          >
            📝 {notesOnly ? 'Showing: Notes Only' : 'Show Notes Only'}
          </button>
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
                <th className="text-center" style={{ width: 130 }}>Notes Date</th>
                <th className="text-end">Balance</th>
                <th className="text-center" style={{ width: 150 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={category === 'ALL' ? 6 : 5} className="text-center py-5"><div className="spinner-border text-primary" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={category === 'ALL' ? 6 : 5} className="text-center py-5 text-muted fw-bold">🎉 No pending balances found</td></tr>
              ) : rows.map((r, idx) => (
                <tr key={(r.entityId || r.name) + '-' + idx}>
                  <td className="fw-bold text-muted">{idx + 1}</td>
                  <td>
                    <span className="fw-bold text-decoration-underline cursor-pointer" style={{ color: '#1e293b' }} onClick={() => goToAccount(r)}>
                      {r.name}
                    </span>
                    {r.phone && <div className="x-small text-muted">📞 {r.phone}</div>}
                  </td>
                  {category === 'ALL' && (
                    <td>
                      {(r.categories || [r.category]).map(c => (
                        <span key={c} className="badge bg-light text-dark border me-1">{categoryLabel(c)}</span>
                      ))}
                    </td>
                  )}
                  <td className="text-center">
                    {r.noteDate ? (
                      <span className={`badge ${r.noteDate < new Date().toISOString().slice(0, 10) ? 'bg-danger' : 'bg-warning text-dark'}`}>
                        {r.noteDate}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="text-end fw-bold text-danger" style={{ whiteSpace: 'nowrap' }}>₹{r.balance.toLocaleString('en-IN')}</td>
                  <td className="text-center">
                    <div className="d-flex gap-1 justify-content-center">
                      <button className="btn btn-sm btn-outline-primary" onClick={() => goToAccount(r)}>VIEW</button>
                      <button
                        className="btn btn-sm btn-outline-success"
                        title={r.phone ? 'Send WhatsApp reminder' : 'No phone number on file'}
                        disabled={!r.phone}
                        onClick={() => openReminderModal(r)}
                      >
                        📲
                      </button>
                      <button
                        className="btn btn-sm btn-outline-warning"
                        title="Note when they promised to pay"
                        onClick={() => openNoteModal(r)}
                      >
                        📝
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {!loading && rows.length > 0 && (
              <tfoot>
                <tr className="fw-bold bg-dark text-white">
                  <td colSpan={category === 'ALL' ? 3 : 2} className="text-uppercase">Total ({rows.length})</td>
                  <td></td>
                  <td className="text-end">₹{totalBalance.toLocaleString('en-IN')}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {reminderModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1055 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-4">
              <div className="modal-header border-0 bg-success text-white rounded-top-4 px-4 pt-4 pb-3">
                <div>
                  <h5 className="modal-title fw-bold mb-0">📲 Send WhatsApp Reminder</h5>
                  <div className="small opacity-75">To {reminderModal.row.name} {reminderModal.row.phone ? `(${reminderModal.row.phone})` : ''}</div>
                </div>
                <button className="btn-close btn-close-white" onClick={() => setReminderModal(null)} disabled={reminderModal.sending}></button>
              </div>
              <div className="modal-body px-4 py-3">
                <label className="form-label fw-bold x-small text-uppercase text-muted">Message (editable)</label>
                <textarea
                  className="form-control"
                  rows={7}
                  value={reminderModal.message}
                  onChange={e => setReminderModal(m => ({ ...m, message: e.target.value }))}
                />
              </div>
              <div className="modal-footer border-0 px-4 pb-4 pt-2 gap-2">
                <button type="button" className="btn btn-light fw-bold px-4" onClick={() => setReminderModal(null)} disabled={reminderModal.sending}>
                  Cancel
                </button>
                <button type="button" className="btn btn-success fw-bold px-4" onClick={sendReminder} disabled={reminderModal.sending || !reminderModal.message.trim()}>
                  {reminderModal.sending ? <><span className="spinner-border spinner-border-sm me-2"></span>Sending...</> : '📲 Send Reminder'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {noteModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1055 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-4">
              <div className="modal-header border-0 bg-warning text-dark rounded-top-4 px-4 pt-4 pb-3">
                <div>
                  <h5 className="modal-title fw-bold mb-0">📝 Promise to Pay</h5>
                  <div className="small opacity-75">{noteModal.row.name} — ₹{noteModal.row.balance.toLocaleString('en-IN')} pending</div>
                </div>
                <button className="btn-close" onClick={() => setNoteModal(null)} disabled={noteModal.saving}></button>
              </div>
              <div className="modal-body px-4 py-3">
                <div className="mb-3">
                  <label className="form-label fw-bold x-small text-uppercase text-muted">They said they'll pay on</label>
                  <input
                    type="date"
                    className="form-control"
                    value={noteModal.promise_date}
                    onChange={e => setNoteModal(m => ({ ...m, promise_date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="form-label fw-bold x-small text-uppercase text-muted">Note (optional)</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    placeholder="E.g. Will pay after salary, asked to call back next week..."
                    value={noteModal.note}
                    onChange={e => setNoteModal(m => ({ ...m, note: e.target.value }))}
                  />
                </div>
              </div>
              <div className="modal-footer border-0 px-4 pb-4 pt-2 gap-2">
                <button type="button" className="btn btn-light fw-bold px-4" onClick={() => setNoteModal(null)} disabled={noteModal.saving}>
                  Cancel
                </button>
                <button type="button" className="btn btn-warning fw-bold px-4" onClick={saveNote} disabled={noteModal.saving || !noteModal.promise_date}>
                  {noteModal.saving ? <><span className="spinner-border spinner-border-sm me-2"></span>Saving...</> : '📝 Save Note'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
