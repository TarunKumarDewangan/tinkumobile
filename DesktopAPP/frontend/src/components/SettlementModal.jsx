import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../api/axios';
import { isAssetEntityType } from '../utils/assetEntityTypes';
import PaymentSplitInput from './PaymentSplitInput';
import { newSingleLine, buildPaymentPayload, paymentLinesSumMatches, buildModeOptions } from '../utils/paymentSplit';

/**
 * Shared "Record Settlement" modal — used from both Entity Ledger and
 * Pending Balance, so both pages settle through the exact same request
 * shape and can never drift apart.
 *
 * Two ways to apply the money:
 * - Combined Balance (default): FIFO across every open invoice, same as
 *   always.
 * - Specific Purchase/Sale: pick one exact open invoice; the amount is
 *   capped to that invoice's own outstanding so it can never spill onto
 *   other invoices. Invoices already carrying an active Shop Finance plan
 *   are excluded server-side — those settle from Finance Tracker instead,
 *   which is the only place that keeps the finance plan's own paid-tracker
 *   in sync.
 */
export default function SettlementModal({ show, entityId, entityName, currentBalance, defaultType = 'IN', onClose, onSuccess }) {
  const [settleData, setSettleData] = useState({
    amount: '',
    type: defaultType,
    payment_mode: 'CASH',
    category: 'ENTITY_SETTLEMENT',
    description: '',
    transaction_date: new Date().toISOString().split('T')[0],
  });
  const [categories] = useState(['ENTITY_SETTLEMENT', 'SHOP_EXPENSE', 'PERSONAL', 'LOAN_PAYMENT']);
  const [bankEntities, setBankEntities] = useState([]);
  const [settlePaymentLines, setSettlePaymentLines] = useState(newSingleLine('CASH'));
  const [submitting, setSubmitting] = useState(false);

  const [applyMode, setApplyMode] = useState('COMBINED'); // 'COMBINED' | 'SPECIFIC'
  const [openInvoices, setOpenInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');

  const settleModeOptions = buildModeOptions(
    [{ value: 'CASH', label: 'Cash' }, { value: 'UPI', label: 'UPI / Digital' }, { value: 'BANK_TRANSFER', label: 'Bank Transfer' }],
    bankEntities
  ).concat([{ value: 'ADJUSTMENT', label: 'Discount / Adjustment' }, { value: 'OTHER', label: 'Other Mode' }]);

  useEffect(() => {
    if (!show) return;
    setSettleData({
      amount: '',
      type: defaultType,
      payment_mode: 'CASH',
      category: 'ENTITY_SETTLEMENT',
      description: '',
      transaction_date: new Date().toISOString().split('T')[0],
    });
    setSettlePaymentLines(newSingleLine('CASH'));
    setApplyMode('COMBINED');
    setOpenInvoices([]);
    setSelectedInvoiceId('');

    api.get('/entities')
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : (data.data || []);
        setBankEntities(list.filter(e => isAssetEntityType(e.type)));
      })
      .catch(() => {});
  }, [show, defaultType]);

  useEffect(() => {
    if (!show || applyMode !== 'SPECIFIC' || !entityId) return;
    setLoadingInvoices(true);
    setSelectedInvoiceId('');
    api.get(`/entities/${entityId}/open-invoices`, { params: { type: settleData.type } })
      .then(({ data }) => setOpenInvoices(data.invoices || []))
      .catch(() => setOpenInvoices([]))
      .finally(() => setLoadingInvoices(false));
  }, [show, applyMode, entityId, settleData.type]);

  const selectedInvoice = openInvoices.find(i => String(i.id) === String(selectedInvoiceId));

  const selectInvoice = (id) => {
    setSelectedInvoiceId(id);
    const inv = openInvoices.find(i => String(i.id) === String(id));
    if (inv) {
      setSettleData(prev => ({ ...prev, amount: inv.outstanding }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!settleData.amount || settleData.amount <= 0) return toast.error('Enter valid amount');
    if (!paymentLinesSumMatches(settlePaymentLines, settleData.amount)) {
      return toast.error("Split doesn't add up to the total amount");
    }
    if (applyMode === 'SPECIFIC') {
      if (!selectedInvoiceId) return toast.error('Select an invoice to settle against');
      if (selectedInvoice && parseFloat(settleData.amount) > parseFloat(selectedInvoice.outstanding) + 0.01) {
        return toast.error(`Amount can't exceed this invoice's pending balance of ₹${Number(selectedInvoice.outstanding).toLocaleString('en-IN')}`);
      }
    }

    setSubmitting(true);
    try {
      const finalData = { ...settleData, ...buildPaymentPayload(settlePaymentLines) };
      const { data } = await api.post('/entities/settle', {
        ...finalData,
        entity_name: entityName,
        invoice_id: applyMode === 'SPECIFIC' ? selectedInvoiceId : undefined,
      });
      const applied = data.applied_to_invoices || [];
      if (applied.length > 0) {
        const summary = applied.map(a => `#${a.invoice_no} (+₹${Number(a.amount).toLocaleString('en-IN')})`).join(', ');
        toast.success(`Settlement recorded — applied to: ${summary}`);
      } else {
        toast.success('Settlement recorded');
      }
      onSuccess?.();
      onClose?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error recording settlement');
    } finally {
      setSubmitting(false);
    }
  };

  if (!show) return null;

  const isAsset = currentBalance?.is_asset_account;
  const netBalance = parseFloat(currentBalance?.net_balance ?? currentBalance ?? 0);

  return (
    <div className="modal show d-block animate-fadeIn" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', zIndex: 1060 }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0 shadow-2xl rounded-4 overflow-hidden">
          <div className="modal-header border-0 p-4 bg-primary text-white">
            <div>
              <h5 className="modal-title fw-bold mb-0">Record Settlement</h5>
              <p className="xx-small text-white-50 mb-0 text-uppercase tracking-wider mt-1">
                Settle outstanding dues for {entityName}
              </p>
            </div>
            <button type="button" className="btn-close btn-close-white shadow-none" onClick={onClose}></button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="modal-body p-4">
              {currentBalance !== undefined && currentBalance !== null && (
                <div className="d-flex justify-content-between align-items-center bg-light p-3 rounded-3 mb-4 border">
                  <span className="x-small text-muted fw-bold">{isAsset ? 'Current Balance:' : 'Current Outstanding:'}</span>
                  <span className={`fw-bold x-small ${netBalance >= 0 ? 'text-success' : 'text-danger'}`}>
                    {isAsset && netBalance < 0 ? '−' : ''}₹{Math.abs(netBalance).toLocaleString()} {isAsset ? '' : (netBalance >= 0 ? 'Receivable (Dr)' : 'Payable (Cr)')}
                  </span>
                </div>
              )}

              <div className="row g-3">
                <div className="col-12">
                  <label className="form-label x-small fw-bold text-dark">SETTLEMENT TYPE</label>
                  <div className="d-flex gap-3">
                    <label className={`btn btn-outline-success flex-grow-1 text-start p-2 rounded-3 ${settleData.type === 'IN' ? 'active fw-bold' : ''}`}>
                      <input
                        type="radio"
                        name="settle_type"
                        className="d-none"
                        checked={settleData.type === 'IN'}
                        onChange={() => setSettleData({ ...settleData, type: 'IN' })}
                      />
                      <div className="x-small">📥 Received In</div>
                      <div className="xx-small text-muted">Customer paying us</div>
                    </label>
                    <label className={`btn btn-outline-danger flex-grow-1 text-start p-2 rounded-3 ${settleData.type === 'OUT' ? 'active fw-bold' : ''}`}>
                      <input
                        type="radio"
                        name="settle_type"
                        className="d-none"
                        checked={settleData.type === 'OUT'}
                        onChange={() => setSettleData({ ...settleData, type: 'OUT' })}
                      />
                      <div className="x-small">📤 Paid Out</div>
                      <div className="xx-small text-muted">Paying supplier/party</div>
                    </label>
                  </div>
                </div>

                <div className="col-12">
                  <label className="form-label x-small fw-bold text-dark">APPLY TO</label>
                  <div className="d-flex gap-3">
                    <label className={`btn btn-outline-primary flex-grow-1 text-start p-2 rounded-3 ${applyMode === 'COMBINED' ? 'active fw-bold' : ''}`}>
                      <input type="radio" name="apply_mode" className="d-none" checked={applyMode === 'COMBINED'} onChange={() => setApplyMode('COMBINED')} />
                      <div className="x-small">🧮 Combined Balance</div>
                      <div className="xx-small text-muted">Applied oldest-invoice-first</div>
                    </label>
                    <label className={`btn btn-outline-primary flex-grow-1 text-start p-2 rounded-3 ${applyMode === 'SPECIFIC' ? 'active fw-bold' : ''}`}>
                      <input type="radio" name="apply_mode" className="d-none" checked={applyMode === 'SPECIFIC'} onChange={() => setApplyMode('SPECIFIC')} />
                      <div className="x-small">🎯 Specific Purchase/Sale</div>
                      <div className="xx-small text-muted">Pay down one exact invoice</div>
                    </label>
                  </div>
                </div>

                {applyMode === 'SPECIFIC' && (
                  <div className="col-12">
                    <label className="form-label x-small fw-bold text-dark">SELECT INVOICE</label>
                    {loadingInvoices ? (
                      <div className="text-muted x-small">Loading open invoices...</div>
                    ) : openInvoices.length === 0 ? (
                      <div className="text-muted x-small fst-italic">No open invoices found for this {settleData.type === 'IN' ? 'customer' : 'supplier'}.</div>
                    ) : (
                      <select className="form-select x-small" value={selectedInvoiceId} onChange={e => selectInvoice(e.target.value)}>
                        <option value="">— Select an invoice —</option>
                        {openInvoices.map(inv => (
                          <option key={inv.id} value={inv.id}>
                            #{inv.invoice_no} — {inv.date} — Pending ₹{Number(inv.outstanding).toLocaleString('en-IN')}
                          </option>
                        ))}
                      </select>
                    )}
                    {selectedInvoice && (
                      <div className="x-small text-muted mt-1">
                        Pending balance for this invoice: <span className="fw-bold text-dark">₹{Number(selectedInvoice.outstanding).toLocaleString('en-IN')}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="col-12 col-md-6">
                  <label className="form-label x-small fw-bold text-dark">AMOUNT (₹) <span className="text-danger">*</span></label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={applyMode === 'SPECIFIC' && selectedInvoice ? selectedInvoice.outstanding : undefined}
                    className="form-control fw-bold border-primary"
                    placeholder="0.00"
                    required
                    autoFocus
                    disabled={applyMode === 'SPECIFIC' && !selectedInvoiceId}
                    value={settleData.amount}
                    onChange={e => setSettleData({ ...settleData, amount: e.target.value })}
                  />
                </div>

                <div className="col-12">
                  <label className="form-label x-small fw-bold text-dark">PAYMENT MODE</label>
                  <PaymentSplitInput
                    totalAmount={settleData.amount}
                    lines={settlePaymentLines}
                    onChange={setSettlePaymentLines}
                    modeOptions={settleModeOptions}
                    size="x-small"
                  />
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label x-small fw-bold text-dark">SETTLEMENT DATE</label>
                  <input
                    type="date"
                    className="form-control x-small"
                    required
                    value={settleData.transaction_date}
                    onChange={e => setSettleData({ ...settleData, transaction_date: e.target.value })}
                  />
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label x-small fw-bold text-dark">CATEGORY</label>
                  <select
                    className="form-select x-small text-uppercase"
                    value={settleData.category}
                    onChange={e => setSettleData({ ...settleData, category: e.target.value })}
                  >
                    {categories.map((c, idx) => (
                      <option key={idx} value={c}>{c.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>

                <div className="col-12">
                  <label className="form-label x-small fw-bold text-muted mb-1">PARTICULARS / NOTES</label>
                  <textarea
                    className="form-control x-small"
                    rows="2"
                    placeholder="E.g. Settle old bill balance..."
                    value={settleData.description}
                    onChange={e => setSettleData({ ...settleData, description: e.target.value })}
                  ></textarea>
                </div>
              </div>
            </div>

            <div className="modal-footer border-0 p-3 bg-light justify-content-end gap-2">
              <button type="button" className="btn btn-outline-secondary btn-sm rounded-pill px-3 fw-bold" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary btn-sm rounded-pill px-4 fw-bold" disabled={submitting}>Confirm Settlement</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
