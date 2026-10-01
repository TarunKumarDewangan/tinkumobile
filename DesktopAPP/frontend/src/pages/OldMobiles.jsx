import { useState, useEffect, useMemo } from 'react';
import pinGate from '../utils/pinGate';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../api/axios';
import { formatDate } from '../utils/formatters';
import Modal from '../components/Modal';
import PaymentSplitInput from '../components/PaymentSplitInput';
import { buildModeOptions, buildPaymentPayload, newSingleLine, paymentLinesSumMatches } from '../utils/paymentSplit';
import { isAssetEntityType } from '../utils/assetEntityTypes';

const BASE_MODES = ['CASH', 'PHONEPE', 'GPAY', 'UPI', 'BANK / NEFT'];

const emptyFilters = { search: '', model_name: '', imei: '', from: '', to: '', type: '' };

export default function OldMobiles() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(emptyFilters);
  const navigate = useNavigate();

  // CRUD States
  const [viewingItem, setViewingItem] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [editForm, setEditForm] = useState({
    customer_id: '',
    customer_name: '',
    customer_phone: '',
    model_name: '',
    imei: '',
    purchase_price: '',
    selling_price: '',
    is_exchange: true,
    pay_later: false,
    exchange_credit_amount: '',
    payment_mode: 'CASH',
    ram: '',
    storage: '',
    color: '',
    condition_note: '',
    purchase_date: ''
  });
  // Live "does this name/phone match an existing customer" search, so an
  // edit doesn't accidentally create a duplicate customer record instead of
  // linking to the seller's real, existing ledger.
  const [customerMatches, setCustomerMatches] = useState([]);
  const [customerSearching, setCustomerSearching] = useState(false);
  // How the cash portion is paid — pre-filled from the purchase's real
  // payout entries so an edit keeps PhonePe/bank/split instead of turning
  // everything into CASH.
  const [payLines, setPayLines] = useState(newSingleLine('CASH', 0));
  const [bankEntities, setBankEntities] = useState([]);
  const modeOptions = useMemo(() => {
    const opts = buildModeOptions(BASE_MODES.map(m => ({ value: m, label: m })), bankEntities)
      .concat([{ value: 'OTHER', label: 'OTHER' }]);
    // Keep any mode the purchase was originally paid with selectable, even
    // if it isn't in today's list, so it isn't lost on save.
    payLines.forEach(l => {
      if (l.mode && !opts.some(o => o.value === l.mode)) opts.unshift({ value: l.mode, label: l.mode });
    });
    return opts;
  }, [bankEntities, payLines]);

  useEffect(() => {
    api.get('/entities').then(res => setBankEntities((res.data || []).filter(e => isAssetEntityType(e.type)))).catch(() => {});
  }, []);

  // Cash paid now on this purchase: full price for a cash payout, or the part
  // of the price not covered by exchange credit; nothing for Pay Later.
  const editCashAmount = (() => {
    if (editForm.pay_later) return 0;
    const price = parseFloat(editForm.purchase_price) || 0;
    if (!editForm.is_exchange) return price;
    const credit = editForm.exchange_credit_amount !== '' ? (parseFloat(editForm.exchange_credit_amount) || 0) : price;
    return Math.max(0, price - credit);
  })();

  const loadList = () => {
    setLoading(true);
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    api.get('/old-mobiles', { params })
      .then(r => setList(r.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const t = setTimeout(loadList, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // Devices bought from the same customer in one visit (the bulk purchase
  // form) all share a batch_id — group them here purely for display so the
  // list shows one combined entry, while each row underneath still stays
  // its own record for individual view/edit/delete.
  const groups = [];
  const batchIndex = new Map();
  list.forEach(m => {
    if (m.batch_id && batchIndex.has(m.batch_id)) {
      groups[batchIndex.get(m.batch_id)].push(m);
    } else {
      if (m.batch_id) batchIndex.set(m.batch_id, groups.length);
      groups.push([m]);
    }
  });

  const handleDelete = async (id) => {
    if (!await pinGate.confirm()) return;
    try {
      await api.delete(`/old-mobiles/${id}`);
      toast.success("Old mobile purchase deleted successfully");
      loadList();
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to delete old mobile purchase");
    }
  };

  const handleEditClick = async (item) => {
    if (!await pinGate.confirm()) return;
    setEditingItem(item);
    setCustomerMatches([]);
    setEditForm({
      customer_id: item.customer?.id || item.customer_id || '',
      customer_name: item.customer?.name || item.customer_name || '',
      customer_phone: item.customer?.phone || item.customer_phone || '',
      model_name: item.model_name || '',
      imei: item.imei || '',
      purchase_price: item.purchase_price || '',
      selling_price: item.selling_price || '',
      is_exchange: item.is_exchange ?? true,
      pay_later: item.pay_later ?? false,
      exchange_credit_amount: item.exchange_credit_amount || '',
      // Keep how the credit was applied — older rows with no mode were
      // effectively Adjust (no wallet), so default those to Adjust.
      exchange_credit_mode: item.exchange_credit_mode || 'adjust',
      ram: item.ram || '',
      storage: item.storage || '',
      color: item.color || '',
      condition_note: item.condition_note || '',
      purchase_date: item.purchase_date ? item.purchase_date.split('T')[0] : ''
    });

    // Pre-fill "Paid via" from how the cash part was really paid.
    setPayLines(newSingleLine('CASH', 0));
    try {
      const { data } = await api.get(`/old-mobiles/${item.id}`);
      const lines = data.payout_payment_lines || [];
      if (lines.length > 1) {
        setPayLines(lines.map(l => ({ mode: l.payment_mode, otherMode: '', amount: l.amount })));
      } else if (lines.length === 1) {
        setPayLines(newSingleLine(lines[0].payment_mode || 'CASH', lines[0].amount));
      }
    } catch (e) {}
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (editCashAmount > 0 && !paymentLinesSumMatches(payLines, editCashAmount)) {
      toast.error(`Split payment must add up to the cash amount ₹${editCashAmount.toLocaleString('en-IN')}`);
      return;
    }
    const payload = {
      ...editForm,
      exchange_credit_mode: editForm.is_exchange ? editForm.exchange_credit_mode : undefined,
      ...(editCashAmount > 0 ? buildPaymentPayload(payLines) : { payment_mode: undefined }),
    };
    try {
      await api.put(`/old-mobiles/${editingItem.id}`, payload);
      toast.success("Old mobile purchase updated successfully");
      setEditingItem(null);
      loadList();
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to update old mobile purchase");
    }
  };

  // Live-search existing customers as the name/phone is typed — lets an edit
  // link back to the seller's real, existing ledger instead of drifting into
  // a duplicate record. Typing a name/phone with no match just falls through
  // to the normal create-a-new-customer-on-save behavior, unchanged.
  useEffect(() => {
    if (!editingItem || editForm.customer_id) { setCustomerMatches([]); return; }
    const q = editForm.customer_name || editForm.customer_phone;
    if (!q || q.length < 2) { setCustomerMatches([]); return; }
    setCustomerSearching(true);
    const t = setTimeout(() => {
      api.get('/customers', { params: { search: q } })
        .then(r => setCustomerMatches(r.data.slice(0, 6)))
        .catch(() => setCustomerMatches([]))
        .finally(() => setCustomerSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [editForm.customer_name, editForm.customer_phone, editForm.customer_id, editingItem]);

  const selectEditCustomer = (c) => {
    setEditForm(f => ({ ...f, customer_id: c.id, customer_name: c.name, customer_phone: c.phone }));
    setCustomerMatches([]);
  };
  const clearEditCustomer = () => {
    setEditForm(f => ({ ...f, customer_id: '', customer_name: '', customer_phone: '' }));
  };

  return (
    <div className="container-fluid px-4 py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1 text-dark d-flex align-items-center gap-2">
            <span>📲</span> Old Mobile Purchases
          </h2>
          <p className="text-muted mb-0">Track and manage second-hand mobile devices acquired from customers.</p>
        </div>
        <button 
          onClick={() => navigate('/old-mobiles/new')}
          className="btn btn-primary d-flex align-items-center gap-2 px-4 py-2 shadow-sm rounded-pill hover-scale"
        >
          <span>➕</span> Record Purchase / Exchange
        </button>
      </div>

      <div className="card border-0 bg-white shadow-sm rounded-4 border-secondary-subtle mb-3 p-3">
        <div className="row g-2 align-items-end">
          <div className="col-6 col-md-3">
            <label className="form-label small fw-bold text-muted mb-1">Search Name/Phone</label>
            <input type="text" className="form-control form-control-sm" placeholder="Name or phone..."
              value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })} />
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label small fw-bold text-muted mb-1">Model Name</label>
            <input type="text" className="form-control form-control-sm" placeholder="e.g. Vivo Y30"
              value={filters.model_name} onChange={e => setFilters({ ...filters, model_name: e.target.value })} />
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label small fw-bold text-muted mb-1">IMEI</label>
            <input type="text" className="form-control form-control-sm" placeholder="Search by IMEI"
              value={filters.imei} onChange={e => setFilters({ ...filters, imei: e.target.value })} />
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label small fw-bold text-muted mb-1">From</label>
            <input type="date" className="form-control form-control-sm"
              value={filters.from} onChange={e => setFilters({ ...filters, from: e.target.value })} />
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label small fw-bold text-muted mb-1">To</label>
            <input type="date" className="form-control form-control-sm"
              value={filters.to} onChange={e => setFilters({ ...filters, to: e.target.value })} />
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label small fw-bold text-muted mb-1">Type</label>
            <select className="form-select form-select-sm" value={filters.type} onChange={e => setFilters({ ...filters, type: e.target.value })}>
              <option value="">All Types</option>
              <option value="exchange">🔄 Exchange</option>
              <option value="cash">💵 Cash Payout</option>
              <option value="pay_later">🕒 Pay Later</option>
            </select>
          </div>
          <div className="col-6 col-md-1">
            <button type="button" className="btn btn-sm btn-outline-secondary w-100" onClick={() => setFilters(emptyFilters)}>
              ✕ Clear
            </button>
          </div>
        </div>
      </div>

      <div className="card border-0 bg-white shadow-sm rounded-4 border-secondary-subtle overflow-hidden">
        {loading ? (
          <div className="d-flex justify-content-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th className="py-3 px-4 text-muted">Date</th>
                  <th className="py-3 text-muted">Customer (Seller)</th>
                  <th className="py-3 text-muted">Model Details</th>
                  <th className="py-3 text-muted">IMEI</th>
                  <th className="py-3 text-muted">Purchase Value</th>
                  <th className="py-3 text-muted">Type</th>
                  <th className="py-3 text-muted">Specs & Cond</th>
                  <th className="py-3 text-muted">Resale Target</th>
                  <th className="py-3 text-muted">Staff</th>
                  <th className="py-3 px-4 text-muted text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {groups.map(group => {
                  const groupTotal = group.reduce((sum, m) => sum + parseFloat(m.purchase_price || 0), 0);
                  return group.map((m, idx) => (
                    <tr key={m.id} className={group.length > 1 ? 'border-top border-2 border-info-subtle' : ''} style={idx > 0 ? { borderTop: 'none' } : undefined}>
                      {idx === 0 && (
                        <>
                          <td className="py-3 px-4 text-muted" rowSpan={group.length}>{formatDate(m.purchase_date)}</td>
                          <td className="py-3" rowSpan={group.length}>
                            <div className="fw-bold text-dark">{m.customer?.name}</div>
                            <small className="text-muted">{m.customer?.phone}</small>
                            {group.length > 1 && (
                              <div className="mt-1">
                                <span className="badge bg-info-subtle text-info border border-info-subtle rounded-pill px-2 py-1">
                                  {group.length} devices • Total ₹{groupTotal.toLocaleString('en-IN')}
                                </span>
                              </div>
                            )}
                          </td>
                        </>
                      )}
                      <td className="py-3">
                        <span className="fw-semibold text-dark">{m.model_name}</span>
                      </td>
                      <td className="py-3">
                        {m.imei ? (
                          <code className="text-primary">
                            <Link to={`/old-mobiles/sales/new?category=mobile-old&imei=${m.imei}`} style={{color: 'inherit', textDecoration: 'underline'}} title="Click to create sale for this set">{m.imei}</Link>
                          </code>
                        ) : '—'}
                      </td>
                      <td className="py-3 fw-bold text-success">
                        ₹{parseFloat(m.purchase_price).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3">
                        {m.is_exchange ? (
                          <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-3 py-1">
                            🔄 Exchange
                          </span>
                        ) : m.pay_later ? (
                          <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle rounded-pill px-3 py-1">
                            🕒 Pay Later
                          </span>
                        ) : (
                          <span className="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill px-3 py-1">
                            💵 Cash Payout
                          </span>
                        )}
                      </td>
                      <td className="py-3">
                        <div className="d-flex gap-1 flex-wrap mb-1">
                          {m.ram && <span className="badge bg-secondary rounded-pill text-xs">{m.ram} RAM</span>}
                          {m.storage && <span className="badge bg-secondary rounded-pill text-xs">{m.storage} ROM</span>}
                          {m.color && <span className="badge bg-dark rounded-pill text-xs">{m.color}</span>}
                        </div>
                        <small className="text-muted text-truncate d-inline-block" style={{maxWidth: '150px'}} title={m.condition_note}>
                          {m.condition_note || 'No notes'}
                        </small>
                      </td>
                      <td className="py-3 fw-bold text-warning">
                        {parseFloat(m.selling_price) > 0 ? `₹${parseFloat(m.selling_price).toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td className="py-3 text-muted">{m.user?.name}</td>
                      <td className="py-3 px-4 text-end">
                        <div className="d-flex justify-content-end gap-3">
                          <button onClick={() => setViewingItem(m)} className="btn btn-sm btn-link text-primary text-decoration-none fw-bold p-0">View</button>
                          <button onClick={() => handleEditClick(m)} className="btn btn-sm btn-link text-secondary text-decoration-none fw-bold p-0">Edit</button>
                          <button onClick={() => handleDelete(m.id)} className="btn btn-sm btn-link text-danger text-decoration-none fw-bold p-0">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ));
                })}
                {list.length === 0 && (
                  <tr>
                    <td colSpan={10} className="text-center py-5 text-muted">
                      <div className="fs-1 mb-2">📱</div>
                      No old mobile purchases found. Record a purchase to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* VIEW MODAL */}
      <Modal show={!!viewingItem} onClose={() => setViewingItem(null)} title="Old Mobile Purchase Details">
        {viewingItem && (
          <div className="table-responsive">
            <table className="table table-bordered mb-0 align-middle text-uppercase">
              <tbody>
                <tr>
                  <th className="bg-light text-muted fw-bold" style={{ width: '40%' }}>Purchase Date</th>
                  <td>{formatDate(viewingItem.purchase_date)}</td>
                </tr>
                <tr>
                  <th className="bg-light text-muted fw-bold">Customer Name</th>
                  <td className="fw-bold">{viewingItem.customer?.name || viewingItem.customer_name}</td>
                </tr>
                <tr>
                  <th className="bg-light text-muted fw-bold">Customer Phone</th>
                  <td>{viewingItem.customer?.phone || viewingItem.customer_phone || '—'}</td>
                </tr>
                <tr>
                  <th className="bg-light text-muted fw-bold">Model Name</th>
                  <td className="fw-bold text-primary">{viewingItem.model_name}</td>
                </tr>
                <tr>
                  <th className="bg-light text-muted fw-bold">IMEI / Serial</th>
                  <td>
                    {viewingItem.imei ? (
                      <code>
                        <Link to={`/old-mobiles/sales/new?category=mobile-old&imei=${viewingItem.imei}`} style={{color: 'inherit', textDecoration: 'underline'}} title="Click to create sale for this set">{viewingItem.imei}</Link>
                      </code>
                    ) : '—'}
                  </td>
                </tr>
                <tr>
                  <th className="bg-light text-muted fw-bold">Specifications</th>
                  <td>
                    {viewingItem.ram && <span className="badge bg-secondary me-1">{viewingItem.ram} RAM</span>}
                    {viewingItem.storage && <span className="badge bg-secondary me-1">{viewingItem.storage} ROM</span>}
                    {viewingItem.color && <span className="badge bg-dark">{viewingItem.color}</span>}
                    {!viewingItem.ram && !viewingItem.storage && !viewingItem.color && '—'}
                  </td>
                </tr>
                <tr>
                  <th className="bg-light text-muted fw-bold">Purchase Price</th>
                  <td className="fw-bold text-success">₹{parseFloat(viewingItem.purchase_price).toLocaleString('en-IN')}</td>
                </tr>
                <tr>
                  <th className="bg-light text-muted fw-bold">Resale Target Price</th>
                  <td className="fw-bold text-warning">
                    {parseFloat(viewingItem.selling_price) > 0 ? `₹${parseFloat(viewingItem.selling_price).toLocaleString('en-IN')}` : '—'}
                  </td>
                </tr>
                <tr>
                  <th className="bg-light text-muted fw-bold">Payout Type</th>
                  <td>
                    {viewingItem.is_exchange ? (
                      <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-3 py-1">🔄 Exchange</span>
                    ) : viewingItem.pay_later ? (
                      <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle rounded-pill px-3 py-1">🕒 Pay Later</span>
                    ) : (
                      <span className="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill px-3 py-1">💵 Cash Payout</span>
                    )}
                  </td>
                </tr>
                <tr>
                  <th className="bg-light text-muted fw-bold">Condition & Notes</th>
                  <td>{viewingItem.condition_note || 'No notes recorded'}</td>
                </tr>
                <tr>
                  <th className="bg-light text-muted fw-bold">Recorded By</th>
                  <td>{viewingItem.user?.name}</td>
                </tr>
              </tbody>
            </table>
            <div className="text-end mt-3">
              <button className="btn btn-secondary px-4 fw-bold" onClick={() => setViewingItem(null)}>Close</button>
            </div>
          </div>
        )}
      </Modal>

      {/* EDIT MODAL */}
      <Modal show={!!editingItem} onClose={() => setEditingItem(null)} title="Edit Old Mobile Purchase">
        <form onSubmit={handleEditSubmit}>
          <div className="row g-3">
            <div className="col-12 col-md-6" style={{ position: 'relative' }}>
              <label className="form-label small fw-bold text-muted">
                Customer Name {editForm.customer_id && <span className="badge bg-success-subtle text-success border border-success-subtle ms-1">Linked to existing customer</span>}
              </label>
              <input type="text" className="form-control text-uppercase" required
                value={editForm.customer_name}
                onChange={e => setEditForm({ ...editForm, customer_name: e.target.value.toUpperCase(), customer_id: '' })}
                autoComplete="off" />
              {editForm.customer_id ? (
                <button type="button" className="btn btn-link btn-sm p-0 x-small mt-1" onClick={clearEditCustomer}>✕ Not this customer — search again</button>
              ) : (customerSearching || customerMatches.length > 0) && (
                <div className="list-group shadow-sm" style={{ position: 'absolute', zIndex: 20, width: '100%' }}>
                  {customerSearching && <div className="list-group-item x-small text-muted">Searching…</div>}
                  {customerMatches.map(c => (
                    <button type="button" key={c.id} className="list-group-item list-group-item-action py-2"
                      onClick={() => selectEditCustomer(c)}>
                      <div className="fw-bold small">{c.name}</div>
                      <div className="x-small text-muted">📞 {c.phone}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label small fw-bold text-muted">Customer Phone</label>
              <input type="text" className="form-control" required
                value={editForm.customer_phone}
                onChange={e => setEditForm({ ...editForm, customer_phone: e.target.value, customer_id: '' })} />
              {!editForm.customer_id && (
                <div className="form-text xx-small">No match? A new customer is created automatically from this name &amp; phone when you save.</div>
              )}
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label small fw-bold text-muted">Model Name</label>
              <input type="text" className="form-control text-uppercase" required value={editForm.model_name} onChange={e => setEditForm({ ...editForm, model_name: e.target.value.toUpperCase() })} />
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label small fw-bold text-muted">IMEI / Serial</label>
              <input type="text" className="form-control" value={editForm.imei} onChange={e => setEditForm({ ...editForm, imei: e.target.value })} />
            </div>
            <div className="col-12 col-md-4">
              <label className="form-label small fw-bold text-muted">RAM</label>
              <input type="text" className="form-control text-uppercase" placeholder="e.g. 8GB" value={editForm.ram} onChange={e => setEditForm({ ...editForm, ram: e.target.value.toUpperCase() })} />
            </div>
            <div className="col-12 col-md-4">
              <label className="form-label small fw-bold text-muted">Storage</label>
              <input type="text" className="form-control text-uppercase" placeholder="e.g. 128GB" value={editForm.storage} onChange={e => setEditForm({ ...editForm, storage: e.target.value.toUpperCase() })} />
            </div>
            <div className="col-12 col-md-4">
              <label className="form-label small fw-bold text-muted">Color</label>
              <input type="text" className="form-control text-uppercase" placeholder="e.g. BLACK" value={editForm.color} onChange={e => setEditForm({ ...editForm, color: e.target.value.toUpperCase() })} />
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label small fw-bold text-muted">Purchase Date</label>
              <input type="date" className="form-control" required value={editForm.purchase_date} onChange={e => setEditForm({ ...editForm, purchase_date: e.target.value })} />
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label small fw-bold text-muted">Payout Type</label>
              <select
                className="form-select text-uppercase"
                value={editForm.is_exchange ? 'exchange' : editForm.pay_later ? 'pay_later' : 'cash'}
                onChange={e => {
                  const v = e.target.value;
                  setEditForm({ ...editForm, is_exchange: v === 'exchange', pay_later: v === 'pay_later', exchange_credit_amount: v === 'exchange' ? editForm.exchange_credit_amount : '' });
                }}
              >
                <option value="exchange">Exchange (Trade-in Credit)</option>
                <option value="cash">Cash Payout (Now)</option>
                <option value="pay_later">Pay Later (Payable)</option>
              </select>
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label small fw-bold text-muted">Purchase Value (₹)</label>
              <input type="number" step="0.01" className="form-control fw-bold text-success" required value={editForm.purchase_price} onChange={e => setEditForm({ ...editForm, purchase_price: e.target.value })} />
            </div>
            {editForm.is_exchange && (
              <div className="col-12">
                <div className="p-3 bg-light rounded-3 border border-secondary-subtle">
                  <label className="form-label small fw-bold mb-1">
                    Exchange Credit Amount <span className="text-muted fw-normal">(leave blank for the full amount)</span>
                  </label>
                  <div className="input-group" style={{ maxWidth: 260 }}>
                    <span className="input-group-text bg-white border-secondary-subtle text-primary fw-bold">₹</span>
                    <input type="number" step="0.01" min="0" max={editForm.purchase_price || undefined}
                      className="form-control fw-bold"
                      placeholder={editForm.purchase_price ? parseFloat(editForm.purchase_price).toFixed(2) : '0.00'}
                      value={editForm.exchange_credit_amount}
                      onChange={e => setEditForm({ ...editForm, exchange_credit_amount: e.target.value })} />
                  </div>
                  {(() => {
                    const price = parseFloat(editForm.purchase_price) || 0;
                    const credit = editForm.exchange_credit_amount !== '' ? (parseFloat(editForm.exchange_credit_amount) || 0) : price;
                    const cash = Math.max(0, price - credit);
                    return cash > 0 ? (
                      <div className="small text-success fw-bold mt-2">💵 Cash paid now: ₹{cash.toLocaleString('en-IN')}</div>
                    ) : null;
                  })()}
                  <label className="form-label small fw-bold mb-1 mt-3">How is the exchange credit used?</label>
                  <select
                    className="form-select"
                    value={editForm.exchange_credit_mode}
                    onChange={e => setEditForm({ ...editForm, exchange_credit_mode: e.target.value })}
                  >
                    <option value="adjust">💳 Adjust against existing balance — reduces what they owe right now</option>
                    <option value="reserve">🔒 Reserve for their next purchase — kept in their wallet, balance untouched</option>
                  </select>
                  {editingItem && editForm.exchange_credit_mode !== (editingItem.exchange_credit_mode || 'adjust') && (
                    <div className="small text-warning-emphasis fw-bold mt-1">
                      ⚠️ Changing this moves the credit {editForm.exchange_credit_mode === 'reserve' ? 'off their balance and into their wallet' : 'out of their wallet and onto their balance'}.
                    </div>
                  )}
                </div>
              </div>
            )}
            {editCashAmount > 0 && (
              <div className="col-12">
                <label className="form-label small fw-bold text-muted">
                  Paid via {editForm.is_exchange ? `(cash part — ₹${editCashAmount.toLocaleString('en-IN')})` : `(₹${editCashAmount.toLocaleString('en-IN')})`}
                </label>
                <PaymentSplitInput
                  totalAmount={editCashAmount}
                  lines={payLines}
                  onChange={setPayLines}
                  modeOptions={modeOptions}
                />
              </div>
            )}
            <div className="col-12 col-md-6">
              <label className="form-label small fw-bold text-muted">Target Reselling Price (₹)</label>
              <input type="number" step="0.01" className="form-control fw-bold text-warning" value={editForm.selling_price} onChange={e => setEditForm({ ...editForm, selling_price: e.target.value })} />
            </div>
            <div className="col-12">
              <label className="form-label small fw-bold text-muted">Condition Notes</label>
              <textarea className="form-control text-uppercase" rows="2" value={editForm.condition_note} onChange={e => setEditForm({ ...editForm, condition_note: e.target.value.toUpperCase() })}></textarea>
            </div>
          </div>
          <div className="text-end mt-4 d-flex justify-content-end gap-2">
            <button type="button" className="btn btn-secondary fw-bold" onClick={() => setEditingItem(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary fw-bold px-4">Save Changes</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
