import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import debounce from 'lodash/debounce';
import api from '../api/axios';
import { useAuth } from '../contexts/AuthContext';

export default function OldMobilePurchaseForm() {
  const { user, isOwner, hasFullAccess } = useAuth();
  const navigate = useNavigate();

  // Form State
  const [form, setForm] = useState({
    shop_id: '',
    customer_id: '',
    customer_name: '',
    customer_phone: '',
    customer_address: '',
    model_name: '',
    imei: '',
    ram: '',
    storage: '',
    color: '',
    purchase_price: '',
    selling_price: '',
    is_exchange: true,
    condition_note: '',
    purchase_date: new Date().toISOString().split('T')[0],
  });

  // Masters
  const [shops, setShops] = useState([]);
  const [staff, setStaff] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerInputText, setCustomerInputText] = useState('');
  const [saving, setSaving] = useState(false);

  // Load masters on mount
  useEffect(() => {
    // Shops
    api.get('/shops')
      .then(res => {
        setShops(res.data);
        if (res.data.length > 0 && !hasFullAccess) {
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.shop_id) {
      toast.error('Please select a branch/shop');
      return;
    }
    if (!form.customer_id && (!form.customer_name || !form.customer_phone)) {
      toast.error('Please select an existing customer or enter new customer details');
      return;
    }

    setSaving(true);
    try {
      await api.post('/old-mobiles', {
        ...form,
        purchase_price: parseFloat(form.purchase_price),
        selling_price: form.selling_price ? parseFloat(form.selling_price) : 0,
        is_exchange: form.is_exchange ? 1 : 0
      });
      toast.success('Old mobile purchase recorded successfully!');
      navigate('/old-mobiles');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error recording old mobile purchase');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container-fluid px-4 py-4">
      <div className="mb-4">
        <h2 className="text-dark d-flex align-items-center gap-2">
          <span>📲</span> Record Old Mobile Purchase / Exchange
        </h2>
        <p className="text-muted">Enter details of the old mobile purchased or exchanged from the customer.</p>
      </div>

      <form onSubmit={handleSubmit} className="row g-4">
        {/* Left Side: General Info & Customer */}
        <div className="col-lg-6">
          <div className="card border-0 bg-white border border-secondary-subtle-subtle shadow-sm rounded-4 p-4 mb-4">
            <h4 className="text-dark mb-4 border-bottom border-secondary-subtle pb-2">🏢 Shop & Payout Mode</h4>

            <div className="row g-3">
              {isOwner() && (
                <div className="col-md-6">
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

              <div className="col-md-6">
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
                      onChange={e => setForm({...form, is_exchange: e.target.checked})}
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
            </div>
          </div>

          <div className="card border-0 bg-white border border-secondary-subtle-subtle shadow-sm rounded-4 p-4">
            <h4 className="text-dark mb-4 border-bottom border-secondary-subtle pb-2">👤 Customer (Seller) Information</h4>

            <div className="row g-3">
              <div className="col-12">
                <label className="form-label text-muted small fw-bold">SEARCH EXISTING CUSTOMER</label>
                <div className="input-group">
                  <input 
                    type="text" 
                    className="form-control bg-white text-dark border-secondary-subtle text-uppercase" 
                    placeholder="Search by Name or Phone..." 
                    value={customerInputText}
                    onChange={e => { 
                      setCustomerInputText(e.target.value); 
                      debouncedCustomerSearch(e.target.value); 
                      if (form.customer_id) handleClearCustomer();
                    }}
                  />
                  {form.customer_id && (
                    <button type="button" className="btn btn-outline-danger" onClick={handleClearCustomer}>
                      Clear
                    </button>
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

              <div className="col-md-6">
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

              <div className="col-md-6">
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

        {/* Right Side: Specifications & Value */}
        <div className="col-lg-6">
          <div className="card border-0 bg-white border border-secondary-subtle-subtle shadow-sm rounded-4 p-4 mb-4">
            <h4 className="text-dark mb-4 border-bottom border-secondary-subtle pb-2">📱 Mobile Specifications</h4>

            <div className="row g-3">
              <div className="col-12">
                <label className="form-label text-muted small fw-bold">MODEL NAME <span className="text-danger">*</span></label>
                <input 
                  type="text" 
                  className="form-control bg-white text-dark border-secondary-subtle text-uppercase fw-semibold"
                  placeholder="e.g. IPHONE 13 PRO MAX"
                  required
                  value={form.model_name}
                  onChange={e => setForm({...form, model_name: e.target.value})}
                />
              </div>

              <div className="col-md-6">
                <label className="form-label text-muted small fw-bold">IMEI / SERIAL NO.</label>
                <input 
                  type="text" 
                  className="form-control bg-white text-dark border-secondary-subtle fw-semibold text-uppercase"
                  placeholder="15-digit IMEI"
                  value={form.imei}
                  onChange={e => setForm({...form, imei: e.target.value})}
                />
              </div>

              <div className="col-md-6">
                <label className="form-label text-muted small fw-bold">COLOR</label>
                <input 
                  type="text" 
                  className="form-control bg-white text-dark border-secondary-subtle text-uppercase fw-semibold"
                  placeholder="e.g. ALPINE GREEN"
                  value={form.color}
                  onChange={e => setForm({...form, color: e.target.value})}
                />
              </div>

              <div className="col-md-6">
                <label className="form-label text-muted small fw-bold">RAM CAPACITY</label>
                <input 
                  type="text" 
                  className="form-control bg-white text-dark border-secondary-subtle text-uppercase"
                  placeholder="e.g. 8 GB"
                  value={form.ram}
                  onChange={e => setForm({...form, ram: e.target.value})}
                />
              </div>

              <div className="col-md-6">
                <label className="form-label text-muted small fw-bold">STORAGE SIZE</label>
                <input 
                  type="text" 
                  className="form-control bg-white text-dark border-secondary-subtle text-uppercase"
                  placeholder="e.g. 128 GB"
                  value={form.storage}
                  onChange={e => setForm({...form, storage: e.target.value})}
                />
              </div>

              <div className="col-12">
                <label className="form-label text-muted small fw-bold">CONDITION / DEFECT NOTES</label>
                <textarea 
                  rows="2"
                  className="form-control bg-white text-dark border-secondary-subtle"
                  placeholder="Describe condition, scratches, defects, or box/charger presence..."
                  value={form.condition_note}
                  onChange={e => setForm({...form, condition_note: e.target.value})}
                />
              </div>
            </div>
          </div>

          <div className="card border-0 bg-white border border-secondary-subtle-subtle shadow-sm rounded-4 p-4">
            <h4 className="text-dark mb-4 border-bottom border-secondary-subtle pb-2">💰 Device Valuation</h4>

            <div className="row g-3">
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
                    value={form.purchase_price}
                    onChange={e => setForm({...form, purchase_price: e.target.value})}
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
                    value={form.selling_price}
                    onChange={e => setForm({...form, selling_price: e.target.value})}
                  />
                </div>
              </div>

              <div className="col-12 mt-4 pt-3 border-top border-secondary-subtle d-flex justify-content-end gap-3">
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
                      <span>💾</span> Save Purchase Record
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
