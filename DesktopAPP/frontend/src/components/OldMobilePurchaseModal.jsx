import { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import { Modal, Button } from 'react-bootstrap';
import api from '../api/axios';
import { buildModeOptions } from '../utils/paymentSplit';
import { isAssetEntityType } from '../utils/assetEntityTypes';

// Same fields/flow as OldMobilePurchaseForm.jsx (/old-mobiles/new), packaged
// as a modal so it can be triggered from inside another form (e.g. New Sale)
// without navigating away. Customer + shop + date are supplied by the caller
// and locked — everything else (Exchange Credit / Pay Later, per-device
// cash + exchange split, cash-remainder payment mode, and the Adjust vs
// Reserve choice) behaves exactly like the full page. Keep the two in sync.
export default function OldMobilePurchaseModal({ show, onHide, shopId, customerId, customerName, purchaseDate, onSaved }) {
  const emptyDevice = () => ({
    model_name: '', imei: '', ram: '', storage: '', color: '',
    purchase_price: '', selling_price: '', condition_note: '',
    // Only used when Exchange Credit is on — how much of this device's price
    // is credited. Blank means "all of it"; a smaller number leaves the rest
    // to be paid as cash now.
    exchange_credit_amount: '',
  });

  const [isExchange, setIsExchange] = useState(true);
  const [payLater, setPayLater] = useState(false);
  const [devices, setDevices] = useState([emptyDevice()]);
  const [saving, setSaving] = useState(false);
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [bankEntities, setBankEntities] = useState([]);
  // Set when the customer currently owes the shop — asks whether the credit
  // should pay that down now (Adjust) or be kept untouched (Reserve).
  const [exchangeModePrompt, setExchangeModePrompt] = useState(null); // { customerBalance }

  const modeOptions = useMemo(() => buildModeOptions(
    [{ value: 'CASH', label: 'CASH' }, { value: 'PHONEPE', label: 'PHONEPE' }, { value: 'GPAY', label: 'GPAY' }, { value: 'BANK / NEFT', label: 'BANK / NEFT' }],
    bankEntities
  ).concat([{ value: 'OTHER', label: 'OTHER' }]), [bankEntities]);

  useEffect(() => {
    if (show) {
      setDevices([emptyDevice()]);
      setIsExchange(true);
      setPayLater(false);
      setPaymentMode('CASH');
      setExchangeModePrompt(null);
      api.get('/entities').then(res => setBankEntities((res.data || []).filter(e => isAssetEntityType(e.type)))).catch(() => {});
    }
  }, [show]);

  const updateDevice = (idx, field, val) => {
    setDevices(prev => prev.map((d, i) => i === idx ? { ...d, [field]: val } : d));
  };
  const addDevice = () => setDevices(prev => [...prev, emptyDevice()]);
  const removeDevice = (idx) => setDevices(prev => prev.filter((_, i) => i !== idx));
  const totalPurchasePrice = devices.reduce((sum, d) => sum + (parseFloat(d.purchase_price) || 0), 0);
  // Cash portion of a device: full price when not on Exchange Credit, or
  // (price - credited amount) when it is — same math the backend uses.
  const cashPortion = (d) => {
    const price = parseFloat(d.purchase_price) || 0;
    if (!isExchange) return price;
    const credit = d.exchange_credit_amount !== '' ? (parseFloat(d.exchange_credit_amount) || 0) : price;
    return Math.max(0, price - credit);
  };
  const totalCashDue = devices.reduce((sum, d) => sum + cashPortion(d), 0);

  const close = () => { if (!saving) onHide(); };

  const submitPurchase = async (exchangeCreditMode) => {
    setSaving(true);
    try {
      await api.post('/old-mobiles/bulk', {
        shop_id: shopId,
        customer_id: customerId,
        purchase_date: purchaseDate || new Date().toISOString().split('T')[0],
        is_exchange: isExchange ? 1 : 0,
        exchange_credit_mode: isExchange ? exchangeCreditMode : undefined,
        pay_later: (!isExchange && payLater) ? 1 : 0,
        payment_mode: (!payLater && totalCashDue > 0) ? (paymentMode || 'CASH') : undefined,
        items: devices.map(d => ({
          ...d,
          purchase_price: parseFloat(d.purchase_price),
          selling_price: d.selling_price ? parseFloat(d.selling_price) : 0,
          exchange_credit_amount: (isExchange && d.exchange_credit_amount !== '')
            ? parseFloat(d.exchange_credit_amount)
            : undefined,
        })),
      });
      toast.success(devices.length > 1 ? `${devices.length} old mobile purchases recorded successfully!` : 'Old mobile purchase recorded successfully!');
      onSaved?.();
      onHide();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error recording old mobile purchase');
    } finally {
      setSaving(false);
      setExchangeModePrompt(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    if (!shopId) {
      toast.error('Please select a branch/shop first');
      return;
    }
    if (!customerId) {
      toast.error('Please select a customer first');
      return;
    }
    const invalidDevice = devices.findIndex(d => !d.model_name.trim() || d.purchase_price === '' || parseFloat(d.purchase_price) < 0);
    if (invalidDevice !== -1) {
      toast.error(`Device ${invalidDevice + 1}: Model Name and Purchase Price are required`);
      return;
    }

    if (!isExchange) {
      submitPurchase(null);
      return;
    }

    // Exchange Credit: if this customer currently owes the shop money, ask
    // whether the credit should pay that down now, or be reserved untouched
    // — same rule as the full page.
    try {
      const { data } = await api.get(`/entities/customer-ledger?customer_id=${customerId}`);
      const bal = parseFloat(data.entity?.net_balance || 0);
      if (bal > 0.01) {
        setExchangeModePrompt({ customerBalance: bal });
        return;
      }
    } catch (e) {}
    submitPurchase('reserve');
  };

  return (
    <Modal show={show} onHide={close} centered size="lg" className="text-uppercase">
      <Modal.Header closeButton className={exchangeModePrompt ? 'bg-warning text-dark' : 'bg-primary text-white'}>
        <Modal.Title className="fw-bold small">
          {exchangeModePrompt
            ? '🤝 Apply Exchange Credit'
            : `📲 RECORD OLD MOBILE PURCHASE / EXCHANGE ${customerName ? `— ${customerName}` : ''}`}
        </Modal.Title>
      </Modal.Header>

      {exchangeModePrompt ? (
        <Modal.Body className="p-4">
          <p className="mb-3">
            <strong>{customerName || 'This customer'}</strong> currently owes
            {' '}<strong className="text-danger">₹{exchangeModePrompt.customerBalance.toLocaleString('en-IN')}</strong>.
            This purchase gives <strong className="text-success">₹{(totalPurchasePrice - totalCashDue).toLocaleString('en-IN')}</strong> exchange credit — how should it be applied?
          </p>
          <div className="d-grid gap-2">
            <Button variant="outline-primary" className="fw-bold text-start py-3" disabled={saving} onClick={() => submitPurchase('adjust')}>
              💳 Adjust against existing balance
              <div className="x-small fw-normal text-muted mt-1" style={{ textTransform: 'none' }}>Reduces what they owe right now.</div>
            </Button>
            <Button variant="outline-success" className="fw-bold text-start py-3" disabled={saving} onClick={() => submitPurchase('reserve')}>
              🔒 Reserve for their next purchase
              <div className="x-small fw-normal text-muted mt-1" style={{ textTransform: 'none' }}>Doesn't touch their current balance — stays guaranteed available for a future sale.</div>
            </Button>
          </div>
          <div className="text-end mt-3">
            <Button variant="link" className="text-muted fw-bold" disabled={saving} onClick={() => setExchangeModePrompt(null)}>← Back to details</Button>
          </div>
        </Modal.Body>
      ) : (
      <form onSubmit={handleSubmit}>
        <Modal.Body className="p-4" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <div className="p-3 bg-light rounded-3 border mb-3">
            <div className="form-check form-switch d-flex align-items-center gap-3">
              <input
                className="form-check-input custom-switch-lg"
                type="checkbox"
                id="modalIsExchangeSwitch"
                checked={isExchange}
                onChange={e => { setIsExchange(e.target.checked); if (e.target.checked) setPayLater(false); }}
              />
              <div>
                <label className="form-check-label text-dark fw-bold d-block" htmlFor="modalIsExchangeSwitch">
                  🔄 Record as Exchange Credit
                </label>
                <small className="text-muted">
                  Adds this purchase amount directly to the customer's ledger credit so it can be used to pay for future mobile sales.
                </small>
              </div>
            </div>
          </div>

          {!isExchange && (
            <div className="p-3 bg-light rounded-3 border mb-3">
              <div className="form-check form-switch d-flex align-items-center gap-3">
                <input
                  className="form-check-input custom-switch-lg"
                  type="checkbox"
                  id="modalPayLaterSwitch"
                  checked={payLater}
                  onChange={e => setPayLater(e.target.checked)}
                />
                <div>
                  <label className="form-check-label text-dark fw-bold d-block" htmlFor="modalPayLaterSwitch">
                    🕒 Pay Later
                  </label>
                  <small className="text-muted">
                    No cash paid now — records this as an amount the shop owes the seller (Payable), settle it later from the seller's Entity Ledger.
                  </small>
                </div>
              </div>
            </div>
          )}

          {!payLater && totalCashDue > 0 && (
            <div className="mb-4">
              <label className="form-label text-muted small fw-bold">
                {isExchange ? `PAID VIA (CASH REMAINDER — ₹${totalCashDue.toLocaleString('en-IN')})` : 'PAID VIA'}
              </label>
              <select className="form-select bg-white text-dark border-secondary-subtle fw-semibold"
                value={paymentMode || 'CASH'} onChange={e => setPaymentMode(e.target.value)}>
                {modeOptions.map((o, i) => (
                  <option key={o.value || `sep-${i}`} value={o.value} disabled={o.disabled}>{o.label}</option>
                ))}
              </select>
              <div className="form-text xx-small">Applies to the whole batch — for individual device splits, edit that device afterward.</div>
            </div>
          )}

          {devices.map((d, idx) => (
            <div key={idx} className="card border-0 bg-white border border-secondary-subtle-subtle shadow-sm rounded-4 p-4 mb-3">
              <div className="d-flex justify-content-between align-items-center mb-3 border-bottom border-secondary-subtle pb-2">
                <h6 className="text-dark mb-0 fw-bold">📱 Device {idx + 1}{devices.length > 1 ? ` of ${devices.length}` : ''}</h6>
                {devices.length > 1 && (
                  <button type="button" className="btn btn-sm btn-outline-danger fw-bold" onClick={() => removeDevice(idx)}>
                    ✕ Remove
                  </button>
                )}
              </div>

              <div className="row g-3">
                <div className="col-12">
                  <label className="form-label text-muted small fw-bold">MODEL NAME <span className="text-danger">*</span></label>
                  <input
                    type="text"
                    className="form-control bg-white text-dark border-secondary-subtle text-uppercase fw-semibold"
                    placeholder="e.g. IPHONE 13 PRO MAX"
                    required
                    value={d.model_name}
                    onChange={e => updateDevice(idx, 'model_name', e.target.value)}
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label text-muted small fw-bold">IMEI / SERIAL NO.</label>
                  <input
                    type="text"
                    className="form-control bg-white text-dark border-secondary-subtle fw-semibold text-uppercase"
                    placeholder="15-digit IMEI"
                    value={d.imei}
                    onChange={e => updateDevice(idx, 'imei', e.target.value)}
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label text-muted small fw-bold">COLOR</label>
                  <input
                    type="text"
                    className="form-control bg-white text-dark border-secondary-subtle text-uppercase fw-semibold"
                    placeholder="e.g. ALPINE GREEN"
                    value={d.color}
                    onChange={e => updateDevice(idx, 'color', e.target.value)}
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label text-muted small fw-bold">RAM CAPACITY</label>
                  <input
                    type="text"
                    className="form-control bg-white text-dark border-secondary-subtle text-uppercase"
                    placeholder="e.g. 8 GB"
                    value={d.ram}
                    onChange={e => updateDevice(idx, 'ram', e.target.value)}
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label text-muted small fw-bold">STORAGE SIZE</label>
                  <input
                    type="text"
                    className="form-control bg-white text-dark border-secondary-subtle text-uppercase"
                    placeholder="e.g. 128 GB"
                    value={d.storage}
                    onChange={e => updateDevice(idx, 'storage', e.target.value)}
                  />
                </div>

                <div className="col-12">
                  <label className="form-label text-muted small fw-bold">CONDITION / DEFECT NOTES</label>
                  <textarea
                    rows="2"
                    className="form-control bg-white text-dark border-secondary-subtle"
                    placeholder="Describe condition, scratches, defects, or box/charger presence..."
                    value={d.condition_note}
                    onChange={e => updateDevice(idx, 'condition_note', e.target.value)}
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label text-muted small fw-bold">PURCHASE PRICE (PAYOUT/CREDIT) <span className="text-danger">*</span></label>
                  <div className="input-group">
                    <span className="input-group-text bg-white border-secondary-subtle text-success fw-bold">₹</span>
                    <input
                      type="number"
                      className="form-control bg-white text-dark border-secondary-subtle fw-bold text-success"
                      placeholder="0.00"
                      required
                      min="0"
                      value={d.purchase_price}
                      onChange={e => updateDevice(idx, 'purchase_price', e.target.value)}
                    />
                  </div>
                </div>

                {isExchange && (
                  <div className="col-12">
                    <div className="p-3 bg-light rounded-3 border border-secondary-subtle">
                      <label className="form-label text-muted small fw-bold mb-1">
                        EXCHANGE CREDIT AMOUNT <span className="text-muted fw-normal">(leave blank for the full amount)</span>
                      </label>
                      <div className="input-group" style={{ maxWidth: 260 }}>
                        <span className="input-group-text bg-white border-secondary-subtle text-primary fw-bold">₹</span>
                        <input
                          type="number"
                          className="form-control bg-white text-dark border-secondary-subtle fw-bold"
                          placeholder={d.purchase_price ? parseFloat(d.purchase_price).toFixed(2) : '0.00'}
                          min="0"
                          max={d.purchase_price || undefined}
                          value={d.exchange_credit_amount}
                          onChange={e => updateDevice(idx, 'exchange_credit_amount', e.target.value)}
                        />
                      </div>
                      {cashPortion(d) > 0 && (
                        <div className="small text-success fw-bold mt-2">
                          💵 Cash paid now for this device: ₹{cashPortion(d).toLocaleString('en-IN')}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="col-md-6">
                  <label className="form-label text-muted small fw-bold">TARGET SELLING PRICE</label>
                  <div className="input-group">
                    <span className="input-group-text bg-white border-secondary-subtle text-warning fw-bold">₹</span>
                    <input
                      type="number"
                      className="form-control bg-white text-dark border-secondary-subtle fw-bold text-warning"
                      placeholder="0.00"
                      min="0"
                      value={d.selling_price}
                      onChange={e => updateDevice(idx, 'selling_price', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}

          <button
            type="button"
            className="btn btn-outline-primary fw-bold w-100 mb-3 py-2 rounded-pill"
            onClick={addDevice}
          >
            ➕ Add Another Device
          </button>

          <div className="d-flex justify-content-between align-items-center bg-light rounded-3 p-3 border">
            <span className="text-muted small fw-bold text-uppercase">
              {devices.length} device{devices.length > 1 ? 's' : ''} — Total {payLater ? 'Payable (Pay Later)' : 'Payout'}
            </span>
            <span className="fs-5 fw-bold text-success">₹{totalPurchasePrice.toLocaleString('en-IN')}</span>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" className="fw-bold" onClick={close} disabled={saving}>CANCEL</Button>
          <Button type="submit" variant="success" className="fw-bold px-4" disabled={saving}>
            {saving ? 'SAVING...' : `💾 SAVE PURCHASE RECORD${devices.length > 1 ? 'S' : ''}`}
          </Button>
        </Modal.Footer>
      </form>
      )}
    </Modal>
  );
}
