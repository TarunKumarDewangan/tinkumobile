import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import debounce from 'lodash/debounce';
import { Modal, Button } from 'react-bootstrap';
import api from '../api/axios';
import { useAuth } from '../contexts/AuthContext';
import { buildModeOptions } from '../utils/paymentSplit';
import { isAssetEntityType } from '../utils/assetEntityTypes';

export default function OldMobilePurchaseForm() {
  const { user, isOwner, hasFullAccess } = useAuth();
  const navigate = useNavigate();

  const emptyDevice = () => ({
    model_name: '', imei: '', ram: '', storage: '', color: '',
    purchase_price: '', selling_price: '', condition_note: '',
  });

  // Form State — shop/customer/date/payout-mode are shared across every
  // device in this visit; each device gets its own row in `devices`.
  const [form, setForm] = useState({
    shop_id: '',
    customer_id: '',
    customer_name: '',
    customer_phone: '',
    customer_address: '',
    is_exchange: true,
    pay_later: false,
    purchase_date: new Date().toISOString().split('T')[0],
    payment_mode: 'CASH',
  });
  const [devices, setDevices] = useState([emptyDevice()]);
  const [bankEntities, setBankEntities] = useState([]);
  const modeOptions = useMemo(() => buildModeOptions(
    [{ value: 'CASH', label: 'CASH' }, { value: 'PHONEPE', label: 'PHONEPE' }, { value: 'GPAY', label: 'GPAY' }, { value: 'BANK / NEFT', label: 'BANK / NEFT' }],
    bankEntities
  ).concat([{ value: 'OTHER', label: 'OTHER' }]), [bankEntities]);

  const updateDevice = (idx, field, val) => {
    setDevices(prev => prev.map((d, i) => i === idx ? { ...d, [field]: val } : d));
  };
  const addDevice = () => setDevices(prev => [...prev, emptyDevice()]);
  const removeDevice = (idx) => setDevices(prev => prev.filter((_, i) => i !== idx));
  const totalPurchasePrice = devices.reduce((sum, d) => sum + (parseFloat(d.purchase_price) || 0), 0);

  // Masters
  const [shops, setShops] = useState([]);
  const [staff, setStaff] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerInputText, setCustomerInputText] = useState('');
  const [saving, setSaving] = useState(false);

  const [showCustModal, setShowCustModal] = useState(false);
  const [newCust, setNewCust] = useState({ name: '', phone: '', email: '', gst_no: '', address: '', voucher_code: '', category: 'REGULAR', opening_balance: 0, balance_type: 'RECEIVABLE', events: [] });

  // Load masters on mount
  useEffect(() => {
    // Shops
    api.get('/shops')
      .then(res => {
        setShops(res.data);
        if (res.data.length > 0 && !hasFullAccess()) {
          const defaultShop = res.data.find(s => s.id === user.shop_id) || res.data[0];
          setForm(f => ({ ...f, shop_id: defaultShop.id }));
        } else if (res.data.length > 0) {
          setForm(f => ({ ...f, shop_id: res.data[0].id }));
        }
      })
      .catch(err => console.error(err));

    // Staff
    api.get('/users')
      .then(res => setStaff(res.data))
      .catch(err => console.error(err));

    // Customers
    api.get('/customers')
      .then(res => setCustomers(res.data))
      .catch(err => console.error(err));

    api.get('/entities')
      .then(res => setBankEntities((res.data || []).filter(e => isAssetEntityType(e.type))))
      .catch(err => console.error(err));
  }, [user, hasFullAccess]);

  // Debounced search for customers
  const debouncedCustomerSearch = useMemo(
    () => debounce((val) => setCustomerSearch(val), 300),
    []
  );

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) || 
    c.phone.includes(customerSearch)
  );

  const handleSelectCustomer = (c) => {
    setForm(prev => ({
      ...prev,
      customer_id: c.id,
      customer_name: c.name,
      customer_phone: c.phone,
      customer_address: c.address || ''
    }));
    setCustomerInputText(`${c.name.toUpperCase()} (${c.phone})`);
    setCustomerSearch('');
  };

  const handleClearCustomer = () => {
    setForm(prev => ({
      ...prev,
      customer_id: '',
      customer_name: '',
      customer_phone: '',
      customer_address: ''
    }));
    setCustomerInputText('');
    setCustomerSearch('');
  };

  const handleAddCustomer = async (e) => {
      e.preventDefault();
      try {
          const { data } = await api.post('/customers', newCust);
          setCustomers([...customers, data]);
          handleSelectCustomer(data);
          setShowCustModal(false);
          setNewCust({ name: '', phone: '', email: '', gst_no: '', address: '', voucher_code: '', category: 'REGULAR', opening_balance: 0, balance_type: 'RECEIVABLE', events: [] });
          toast.success('✅ Customer added');
      } catch (e) { toast.error(e.response?.data?.message || 'Error adding customer'); }
  };

  const addCustEvent = () => setNewCust({ ...newCust, events: [...newCust.events, { type: 'dob', name: '', date: '' }] });
  const removeCustEvent = (i) => setNewCust({ ...newCust, events: newCust.events.filter((_, idx) => idx !== i) });
  const updateCustEvent = (i, field, val) => {
    const evs = [...newCust.events];
    evs[i][field] = val;
    setNewCust({ ...newCust, events: evs });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.keyCode === 13) {
      if (e.target.tagName !== 'TEXTAREA' && e.target.type !== 'submit') {
        e.preventDefault();
      }
    }
  };

  const [exchangeModePrompt, setExchangeModePrompt] = useState(null); // { customerBalance }

  const submitPurchase = async (exchangeCreditMode) => {
    setSaving(true);
    try {
      await api.post('/old-mobiles/bulk', {
        ...form,
        is_exchange: form.is_exchange ? 1 : 0,
        exchange_credit_mode: form.is_exchange ? exchangeCreditMode : undefined,
        pay_later: (!form.is_exchange && form.pay_later) ? 1 : 0,
        payment_mode: (form.is_exchange || form.pay_later) ? undefined : (form.payment_mode || 'CASH'),
        items: devices.map(d => ({
          ...d,
          purchase_price: parseFloat(d.purchase_price),
          selling_price: d.selling_price ? parseFloat(d.selling_price) : 0,
        })),
      });
      toast.success(devices.length > 1 ? `${devices.length} old mobile purchases recorded successfully!` : 'Old mobile purchase recorded successfully!');
      navigate('/old-mobiles');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error recording old mobile purchase');
    } finally {
      setSaving(false);
      setExchangeModePrompt(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return; // Prevent double-submit

    if (!form.shop_id) {
      toast.error('Please select a branch/shop');
      return;
    }
    if (!form.customer_id && (!form.customer_name || !form.customer_phone)) {
      toast.error('Please select an existing customer or enter new customer details');
      return;
    }
    const invalidDevice = devices.findIndex(d => !d.model_name.trim() || d.purchase_price === '' || parseFloat(d.purchase_price) < 0);
    if (invalidDevice !== -1) {
      toast.error(`Device ${invalidDevice + 1}: Model Name and Purchase Price are required`);
      return;
    }

    if (!form.is_exchange) {
      submitPurchase(null);
      return;
    }

    // Exchange Credit: if this customer currently owes the shop money, ask
    // whether the credit should pay that down now, or be reserved untouched
    // for their next purchase — otherwise it silently nets against their
    // existing dues with no choice offered.
    if (form.customer_id) {
      try {
        const { data } = await api.get(`/entities/customer-ledger?customer_id=${form.customer_id}`);
        const bal = parseFloat(data.entity?.net_balance || 0);
        if (bal > 0.01) {
          setExchangeModePrompt({ customerBalance: bal });
          return;
        }
      } catch (e) {}
    }
    submitPurchase('reserve');
  };

  return (
    <div className="container-fluid px-4 py-4">
      <div className="mb-4">
        <button type="button" className="btn btn-sm btn-outline-secondary fw-bold mb-2" onClick={() => navigate('/old-mobiles')}>← Back</button>
        <h2 className="text-dark d-flex align-items-center gap-2">
          <span>📲</span> Record Old Mobile Purchase / Exchange
        </h2>
        <p className="text-muted">Enter details of the old mobile purchased or exchanged from the customer.</p>
      </div>

      <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="row g-4">
        {/* Left Side: General Info & Customer */}
        <div className="col-12 col-lg-6">
          <div className="card border-0 bg-white border border-secondary-subtle-subtle shadow-sm rounded-4 p-4 mb-4">
            <h4 className="text-dark mb-4 border-bottom border-secondary-subtle pb-2">🏢 Shop & Payout Mode</h4>

            <div className="row g-3">
              {hasFullAccess() && (
                <div className="col-12 col-md-6">
                  <label className="form-label text-muted small fw-bold">SELECT SHOP/BRANCH <span className="text-danger">*</span></label>
                  <select 
                    className="form-select bg-white text-dark border-secondary-subtle fw-semibold" 
                    required 
                    value={form.shop_id} 
                    onChange={e => setForm({...form, shop_id: e.target.value})}
                  >
                    <option value="">— SELECT SHOP —</option>
                    {shops.map(s => <option key={s.id} value={s.id}>{s.name.toUpperCase()}</option>)}
                  </select>
                </div>
              )}

              <div className="col-12 col-md-6">
                <label className="form-label text-muted small fw-bold">PURCHASE DATE <span className="text-danger">*</span></label>
                <input 
                  type="date" 
                  className="form-control bg-white text-dark border-secondary-subtle fw-semibold"
                  required
                  value={form.purchase_date}
                  onChange={e => setForm({...form, purchase_date: e.target.value})}
                />
              </div>

              <div className="col-12 mt-4">
                <div className="p-3 bg-white rounded-3 border border-secondary-subtle">
                  <div className="form-check form-switch d-flex align-items-center gap-3">
                    <input
                      className="form-check-input custom-switch-lg"
                      type="checkbox"
                      id="isExchangeSwitch"
                      checked={form.is_exchange}
                      onChange={e => setForm({...form, is_exchange: e.target.checked, pay_later: e.target.checked ? false : form.pay_later})}
                    />
                    <div>
                      <label className="form-check-label text-dark fw-bold d-block" htmlFor="isExchangeSwitch">
                        🔄 Record as Exchange Credit
                      </label>
                      <small className="text-muted">
                        Adds this purchase amount directly to the customer's ledger credit so it can be used to pay for future mobile sales.
                      </small>
                    </div>
                  </div>
                </div>
              </div>

              {!form.is_exchange && (
                <div className="col-12">
                  <div className="p-3 bg-white rounded-3 border border-secondary-subtle">
                    <div className="form-check form-switch d-flex align-items-center gap-3">
                      <input
                        className="form-check-input custom-switch-lg"
                        type="checkbox"
                        id="payLaterSwitch"
                        checked={form.pay_later}
                        onChange={e => setForm({...form, pay_later: e.target.checked})}
                      />
                      <div>
                        <label className="form-check-label text-dark fw-bold d-block" htmlFor="payLaterSwitch">
                          🕒 Pay Later
                        </label>
                        <small className="text-muted">
                          No cash paid now — records this as an amount the shop owes the seller (Payable), settle it later from the seller's Entity Ledger.
                        </small>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {!form.is_exchange && !form.pay_later && totalPurchasePrice > 0 && (
                <div className="col-12">
                  <label className="form-label text-muted small fw-bold">PAID VIA</label>
                  <select className="form-select bg-white text-dark border-secondary-subtle fw-semibold"
                    value={form.payment_mode || 'CASH'}
                    onChange={e => setForm({...form, payment_mode: e.target.value})}>
                    {modeOptions.map((o, i) => (
                      <option key={o.value || `sep-${i}`} value={o.value} disabled={o.disabled}>{o.label}</option>
                    ))}
                  </select>
                  <div className="form-text xx-small">Applies to the whole batch — for individual device splits, edit that device afterward.</div>
                </div>
              )}
            </div>
          </div>

          <div className="card border-0 bg-white border border-secondary-subtle-subtle shadow-sm rounded-4 p-4">
            <h4 className="text-dark mb-4 border-bottom border-secondary-subtle pb-2">👤 Customer (Seller) Information</h4>

            <div className="row g-3">
              <div className="col-12">
                <label className="form-label text-muted small fw-bold">SEARCH EXISTING CUSTOMER</label>
                <div className="input-group">
                  <span className="input-group-text bg-white border-secondary-subtle border-end-0"><i className="bi bi-search"></i></span>
                  <input 
                    type="text" 
                    className="form-control bg-white text-dark border-secondary-subtle border-start-0 text-uppercase" 
                    placeholder="Search by Name or Phone..." 
                    value={customerInputText}
                    onChange={e => { 
                      setCustomerInputText(e.target.value); 
                      debouncedCustomerSearch(e.target.value); 
                      if (form.customer_id) handleClearCustomer();
                    }}
                  />
                  {form.customer_id ? (
                    <button type="button" className="btn btn-outline-danger fw-bold" onClick={handleClearCustomer}>
                      Clear
                    </button>
                  ) : (
                    <button type="button" className="btn btn-primary fw-bold" onClick={() => setShowCustModal(true)} title="Add New Customer">+</button>
                  )}
                </div>
                {customerSearch && !form.customer_id && filteredCustomers.length > 0 && (
                  <div className="list-group shadow mt-1 position-absolute w-100 z-3 bg-white border border-secondary-subtle" style={{ maxWidth: '90%' }}>
                    {filteredCustomers.slice(0, 5).map(c => (
                      <button 
                        key={c.id} 
                        type="button" 
                        className="list-group-item list-group-item-action bg-white text-dark border-secondary-subtle py-2 text-uppercase hover-light" 
                        onClick={() => handleSelectCustomer(c)}
                      >
                        <div className="fw-bold">{c.name}</div>
                        <small className="text-muted">📞 {c.phone} | {c.address || 'No Address'}</small>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="col-12 text-center text-muted my-2 small">— OR REGISTER NEW CUSTOMER —</div>

              <div className="col-12 col-md-6">
                <label className="form-label text-muted small fw-bold">CUSTOMER NAME <span className="text-danger">*</span></label>
                <input 
                  type="text" 
                  className="form-control bg-white text-dark border-secondary-subtle text-uppercase fw-semibold"
                  placeholder="Enter Name"
                  required
                  disabled={!!form.customer_id}
                  value={form.customer_name}
                  onChange={e => setForm({...form, customer_name: e.target.value})}
                />
              </div>

              <div className="col-12 col-md-6">
                <label className="form-label text-muted small fw-bold">PHONE NUMBER <span className="text-danger">*</span></label>
                <input 
                  type="text" 
                  className="form-control bg-white text-dark border-secondary-subtle fw-semibold"
                  placeholder="Enter Phone"
                  required
                  disabled={!!form.customer_id}
                  value={form.customer_phone}
                  onChange={e => setForm({...form, customer_phone: e.target.value})}
                />
              </div>

              <div className="col-12">
                <label className="form-label text-muted small fw-bold">ADDRESS</label>
                <textarea 
                  rows="2"
                  className="form-control bg-white text-dark border-secondary-subtle text-uppercase"
                  placeholder="Customer Address"
                  disabled={!!form.customer_id}
                  value={form.customer_address}
                  onChange={e => setForm({...form, customer_address: e.target.value})}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Devices (one or more) */}
        <div className="col-12 col-lg-6">
          {devices.map((d, idx) => (
            <div key={idx} className="card border-0 bg-white border border-secondary-subtle-subtle shadow-sm rounded-4 p-4 mb-4">
              <div className="d-flex justify-content-between align-items-center mb-4 border-bottom border-secondary-subtle pb-2">
                <h4 className="text-dark mb-0">📱 Device {idx + 1}{devices.length > 1 ? ` of ${devices.length}` : ''}</h4>
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

                <div className="col-12 col-md-6">
                  <label className="form-label text-muted small fw-bold">IMEI / SERIAL NO.</label>
                  <input
                    type="text"
                    className="form-control bg-white text-dark border-secondary-subtle fw-semibold text-uppercase"
                    placeholder="15-digit IMEI"
                    value={d.imei}
                    onChange={e => updateDevice(idx, 'imei', e.target.value)}
                  />
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label text-muted small fw-bold">COLOR</label>
                  <input
                    type="text"
                    className="form-control bg-white text-dark border-secondary-subtle text-uppercase fw-semibold"
                    placeholder="e.g. ALPINE GREEN"
                    value={d.color}
                    onChange={e => updateDevice(idx, 'color', e.target.value)}
                  />
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label text-muted small fw-bold">RAM CAPACITY</label>
                  <input
                    type="text"
                    className="form-control bg-white text-dark border-secondary-subtle text-uppercase"
                    placeholder="e.g. 8 GB"
                    value={d.ram}
                    onChange={e => updateDevice(idx, 'ram', e.target.value)}
                  />
                </div>

                <div className="col-12 col-md-6">
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

                <div className="col-12 col-md-6">
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

                <div className="col-12 col-md-6">
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
            className="btn btn-outline-primary fw-bold w-100 mb-4 py-2 rounded-pill"
            onClick={addDevice}
          >
            ➕ Add Another Device
          </button>

          <div className="card border-0 bg-white border border-secondary-subtle-subtle shadow-sm rounded-4 p-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <span className="text-muted small fw-bold text-uppercase">
                {devices.length} device{devices.length > 1 ? 's' : ''} — Total {form.pay_later ? 'Payable (Pay Later)' : 'Payout'}
              </span>
              <span className="fs-4 fw-bold text-success">₹{totalPurchasePrice.toLocaleString('en-IN')}</span>
            </div>
            <div className="d-flex justify-content-end gap-3">
              <button
                type="button"
                onClick={() => navigate('/old-mobiles')}
                className="btn btn-outline-secondary px-4 py-2 rounded-pill hover-scale"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-success px-5 py-2 rounded-pill fw-bold hover-scale d-flex align-items-center gap-2 shadow"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <span className="spinner-border spinner-border-sm" role="status" />
                    Saving...
                  </>
                ) : (
                  <>
                    <span>💾</span> Save Purchase Record{devices.length > 1 ? 's' : ''}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Mini Modal: Add Customer */}
      <Modal show={showCustModal} onHide={() => setShowCustModal(false)} centered className="text-uppercase border-primary">
          <Modal.Header closeButton className="bg-primary text-white">
              <Modal.Title className="fw-bold small">➕ ADD NEW CUSTOMER</Modal.Title>
          </Modal.Header>
          <form onSubmit={handleAddCustomer}>
              <Modal.Body className="p-4">
                  <div className="row g-3">
                      <div className="col-12 col-md-6 text-uppercase">
                          <label className="form-label small fw-bold">Full Name <span className="text-danger">*</span></label>
                          <input type="text" className="form-control" required value={newCust.name} onChange={e => setNewCust({...newCust, name: e.target.value.toUpperCase()})} />
                      </div>
                      <div className="col-12 col-md-6 text-uppercase">
                          <label className="form-label small fw-bold">Customer Type <span className="text-danger">*</span></label>
                          <select className="form-select" value={newCust.category} onChange={e => setNewCust({...newCust, category: e.target.value})}>
                              <option value="REGULAR">NORMAL CUSTOMER</option>
                              <option value="SHOP">SHOP CUSTOMER</option>
                          </select>
                      </div>
                      <div className="col-12 col-md-6 text-uppercase">
                          <label className="form-label small fw-bold">Phone Number <span className="text-danger">*</span></label>
                          <input type="text" className="form-control" required value={newCust.phone} onChange={e => setNewCust({...newCust, phone: e.target.value})} />
                      </div>
                      <div className="col-12 col-md-6 text-uppercase">
                          <label className="form-label small fw-bold">GST Number</label>
                          <input type="text" className="form-control" placeholder="e.g. 22AAAAA0000A1Z5" value={newCust.gst_no || ''} onChange={e => setNewCust({...newCust, gst_no: e.target.value.toUpperCase()})} />
                      </div>
                      <div className="col-12 col-md-6 text-uppercase">
                          <label className="form-label small fw-bold">Opening Balance</label>
                          <input type="number" className="form-control" value={newCust.opening_balance} onChange={e => setNewCust({...newCust, opening_balance: e.target.value})} />
                      </div>
                      <div className="col-12 col-md-6 text-uppercase">
                          <label className="form-label small fw-bold">Balance Type</label>
                          <select className="form-select" value={newCust.balance_type} onChange={e => setNewCust({...newCust, balance_type: e.target.value})}>
                              <option value="RECEIVABLE">THEY OWE ME (Receivable)</option>
                              <option value="PAYABLE">I OWE THEM (Payable)</option>
                          </select>
                      </div>
                      <div className="col-12 col-md-6 text-uppercase">
                          <label className="form-label small fw-bold">Email</label>
                          <input type="email" className="form-control" value={newCust.email || ''} onChange={e => setNewCust({...newCust, email: e.target.value})} />
                      </div>
                      <div className="col-12 col-md-6 text-uppercase">
                          <label className="form-label small fw-bold">Voucher Code</label>
                          <input type="text" className="form-control" value={newCust.voucher_code || ''} onChange={e => setNewCust({...newCust, voucher_code: e.target.value.toUpperCase()})} />
                      </div>
                      <div className="col-12 text-uppercase">
                          <label className="form-label small fw-bold">Address</label>
                          <input type="text" className="form-control" value={newCust.address || ''} onChange={e => setNewCust({...newCust, address: e.target.value.toUpperCase()})} />
                      </div>
                  </div>

                  <div className="mt-4 border-top pt-3 text-uppercase">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                          <label className="form-label small fw-bold mb-0">🎂 Customer Events</label>
                          <button type="button" className="btn btn-xs btn-outline-primary" onClick={addCustEvent}>+ Add Event</button>
                      </div>
                      {newCust.events.map((ev, i) => (
                          <div key={i} className="row g-2 mb-2 align-items-end animate-fade-in border p-2 rounded bg-light">
                              <div className="col-4">
                                  <label className="x-small fw-bold">Type</label>
                                  <select className="form-select form-select-sm" value={ev.type} onChange={e => updateCustEvent(i, 'type', e.target.value)}>
                                      <option value="dob">DOB</option>
                                      <option value="anniversary">Anniversary</option>
                                      <option value="other">Other</option>
                                  </select>
                              </div>
                              {ev.type === 'other' && (
                                  <div className="col-4">
                                      <label className="x-small fw-bold">Event Name</label>
                                      <input className="form-control form-control-sm" placeholder="e.g. Wedding" value={ev.name} onChange={e => updateCustEvent(i, 'name', e.target.value.toUpperCase())} />
                                  </div>
                              )}
                              <div className={ev.type === 'other' ? 'col-3' : 'col-6'}>
                                  <label className="x-small fw-bold">Date</label>
                                  <input type="date" className="form-control form-control-sm" required value={ev.date} onChange={e => updateCustEvent(i, 'date', e.target.value)} />
                              </div>
                              <div className="col-1 text-center">
                                  <button type="button" className="btn btn-link text-danger p-0 border-0" onClick={() => removeCustEvent(i)}>✕</button>
                              </div>
                          </div>
                      ))}
                      {newCust.events.length === 0 && <p className="text-muted x-small">Click "+ Add Event" to track birthdays, etc.</p>}
                  </div>
              </Modal.Body>
              <Modal.Footer>
                  <Button variant="secondary" className="fw-bold" onClick={() => setShowCustModal(false)}>CANCEL</Button>
                  <Button type="submit" variant="primary" className="fw-bold px-4">CREATE CUSTOMER</Button>
              </Modal.Footer>
          </form>
      </Modal>

      {/* Exchange Credit: Adjust vs Reserve */}
      <Modal show={!!exchangeModePrompt} onHide={() => !saving && setExchangeModePrompt(null)} centered className="text-uppercase border-warning">
          <Modal.Header closeButton className="bg-warning text-dark">
              <Modal.Title className="fw-bold small">🤝 Apply Exchange Credit</Modal.Title>
          </Modal.Header>
          <Modal.Body className="p-4">
              <p className="mb-3">
                  <strong>{form.customer_name || customerInputText}</strong> currently owes
                  {' '}<strong className="text-danger">₹{exchangeModePrompt?.customerBalance.toLocaleString('en-IN')}</strong>.
                  This purchase gives <strong className="text-success">₹{totalPurchasePrice.toLocaleString('en-IN')}</strong> exchange credit — how should it be applied?
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
          </Modal.Body>
          <Modal.Footer>
              <Button variant="secondary" className="fw-bold" disabled={saving} onClick={() => setExchangeModePrompt(null)}>CANCEL</Button>
          </Modal.Footer>
      </Modal>

      <style>{`
          .x-small { font-size: 0.7rem; }
          .btn-xs { padding: 0.1rem 0.4rem; font-size: 0.65rem; }
      `}</style>
    </div>
  );
}
