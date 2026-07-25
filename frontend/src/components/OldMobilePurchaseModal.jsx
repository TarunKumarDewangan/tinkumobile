import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { Modal, Button } from 'react-bootstrap';
import api from '../api/axios';

// Same fields/flow as OldMobilePurchaseForm.jsx, packaged as a modal so it
// can be triggered from inside another form (e.g. New Sale) without
// navigating away. Customer + shop are supplied by the caller and locked —
// this modal only lets staff record the trade-in device(s) and payout mode.
export default function OldMobilePurchaseModal({ show, onHide, shopId, customerId, customerName, purchaseDate, onSaved }) {
  const emptyDevice = () => ({
    model_name: '', imei: '', ram: '', storage: '', color: '',
    purchase_price: '', selling_price: '', condition_note: '',
  });

  const [isExchange, setIsExchange] = useState(true);
  const [devices, setDevices] = useState([emptyDevice()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (show) {
      setDevices([emptyDevice()]);
      setIsExchange(true);
    }
  }, [show]);

  const updateDevice = (idx, field, val) => {
    setDevices(prev => prev.map((d, i) => i === idx ? { ...d, [field]: val } : d));
  };
  const addDevice = () => setDevices(prev => [...prev, emptyDevice()]);
  const removeDevice = (idx) => setDevices(prev => prev.filter((_, i) => i !== idx));
  const totalPurchasePrice = devices.reduce((sum, d) => sum + (parseFloat(d.purchase_price) || 0), 0);

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

    setSaving(true);
    try {
      await api.post('/old-mobiles/bulk', {
        shop_id: shopId,
        customer_id: customerId,
        purchase_date: purchaseDate || new Date().toISOString().split('T')[0],
        is_exchange: isExchange ? 1 : 0,
        items: devices.map(d => ({
          ...d,
          purchase_price: parseFloat(d.purchase_price),
          selling_price: d.selling_price ? parseFloat(d.selling_price) : 0,
        })),
      });
      toast.success(devices.length > 1 ? `${devices.length} old mobile purchases recorded successfully!` : 'Old mobile purchase recorded successfully!');
      onSaved?.();
      onHide();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error recording old mobile purchase');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered size="lg" className="text-uppercase">
      <Modal.Header closeButton className="bg-primary text-white">
        <Modal.Title className="fw-bold small">📲 RECORD OLD MOBILE PURCHASE / EXCHANGE {customerName ? `— ${customerName}` : ''}</Modal.Title>
      </Modal.Header>
      <form onSubmit={handleSubmit}>
        <Modal.Body className="p-4" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <div className="p-3 bg-light rounded-3 border mb-4">
            <div className="form-check form-switch d-flex align-items-center gap-3">
              <input
                className="form-check-input custom-switch-lg"
                type="checkbox"
                id="modalIsExchangeSwitch"
                checked={isExchange}
                onChange={e => setIsExchange(e.target.checked)}
              />
              <div>
                <label className="form-check-label text-dark fw-bold d-block" htmlFor="modalIsExchangeSwitch">
                  🔄 Record as Exchange Credit
                </label>
                <small className="text-muted">
                  Adds this purchase amount directly to the customer's ledger credit so it can be used towards this sale.
                </small>
              </div>
            </div>
          </div>

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
              {devices.length} device{devices.length > 1 ? 's' : ''} — Total Payout
            </span>
            <span className="fs-5 fw-bold text-success">₹{totalPurchasePrice.toLocaleString('en-IN')}</span>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" className="fw-bold" onClick={onHide} disabled={saving}>CANCEL</Button>
          <Button type="submit" variant="success" className="fw-bold px-4" disabled={saving}>
            {saving ? 'SAVING...' : `💾 SAVE PURCHASE RECORD${devices.length > 1 ? 'S' : ''}`}
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}
