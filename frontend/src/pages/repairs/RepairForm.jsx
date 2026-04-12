import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../api/axios';

export default function RepairForm() {
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({ 
    customer_name:'', 
    customer_phone:'', 
    customer_email:'', 
    customer_address:'', 
    customer_id: '',
    submitted_date: new Date().toISOString().slice(0,10),
    device_model:'', 
    quoted_amount: 0,
    advance_amount: 0,
    service_center_cost: 0,
    issue_description: [''], 
    estimated_delivery_date:'',
    is_forwarded: false,
    forwarded_to: '',
    forwarded_phone: '',
    external_expected_delivery: '',
    advance_payment_mode: 'CASH',
    balance_amount_received: 0,
    balance_payment_mode: 'CASH'
  });
  const [externalShops, setExternalShops] = useState([]);
  const [showShopList, setShowShopList] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustList, setShowCustList] = useState(false);
  const { id } = useParams();
  const navigate = useNavigate();

  useEffect(() => { 
    api.get('/customers').then(r => setCustomers(r.data)); 
    api.get('/repairs/external-shops').then(r => setExternalShops(r.data));
    
    if (id) {
      api.get(`/repairs/${id}`).then(r => {
        setForm({
          ...r.data,
          submitted_date: r.data.submitted_date?.slice(0,10) || '',
          estimated_delivery_date: r.data.estimated_delivery_date?.slice(0,10) || '',
          external_expected_delivery: r.data.external_expected_delivery?.slice(0,10) || '',
          issue_description: (() => {
            let val = r.data.issue_description;
            if (typeof val === 'string' && (val.startsWith('[') || val.startsWith('{'))) {
              try { val = JSON.parse(val); } catch (e) { val = [val]; }
            }
            if (!Array.isArray(val)) val = val ? [val] : [''];
            return val.map(i => i || '');
          })(),
          quoted_amount: parseFloat(r.data.quoted_amount || 0),
          advance_amount: parseFloat(r.data.advance_amount || 0),
          service_center_cost: parseFloat(r.data.service_center_cost || 0),
          balance_amount_received: parseFloat(r.data.balance_amount_received || 0),
          advance_payment_mode: r.data.advance_payment_mode || 'CASH',
          balance_payment_mode: r.data.balance_payment_mode || 'CASH',
        });
        setCustomerSearch(r.data.customer_name || '');
      });
    }
  }, [id]);

  const fetchInternetTime = async () => {
    try {
      const res = await fetch('https://worldtimeapi.org/api/timezone/Asia/Kolkata');
      const data = await res.json();
      return data.datetime ? new Date(data.datetime) : new Date();
    } catch (e) {
      return new Date(); // Fallback to system time if internet check fails
    }
  };

  const handleSettle = async () => {
    const balance = parseFloat(form.quoted_amount || 0) - parseFloat(form.advance_amount || 0);
    if (balance <= 0) return toast.info('No balance to settle');
    
    if (!window.confirm(`Settle balance of ₹${balance.toLocaleString()}? This will capture current network time.`)) return;
    
    setIsSettling(true);
    const istTime = await fetchInternetTime();
    
    const updatedForm = {
      ...form,
      status: 'delivered',
      balance_amount_received: balance,
      balance_payment_mode: form.balance_payment_mode || 'CASH',
      balance_received_at: istTime.toISOString().slice(0,19).replace('T', ' '),
      actual_delivery_date: new Date().toISOString().slice(0,10)
    };
    
    setForm(updatedForm);
    setIsSettling(false);
    toast.success('Balance settled! Please click Update to save changes.');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (id) {
        await api.put(`/repairs/${id}`, form);
        toast.success('Repair updated successfully');
      } else {
        await api.post('/repairs', form);
        toast.success('Repair request created');
      }
      navigate('/repairs');
    } catch (e) { toast.error(e.response?.data?.message || 'Error'); }
  };

  const f = (field) => ({ 
    value: form[field] || '', 
    onChange: e => setForm({ ...form, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }) 
  });

  const addIssue = () => setForm({ ...form, issue_description: [...form.issue_description, ''] });
  const removeIssue = (index) => setForm({ ...form, issue_description: form.issue_description.filter((_, i) => i !== index) });
  const updateIssue = (index, val) => {
    const newIssues = [...form.issue_description];
    newIssues[index] = val;
    setForm({ ...form, issue_description: newIssues });
  };

  const selectShop = (shop) => {
    setForm({ ...form, forwarded_to: shop.forwarded_to, forwarded_phone: shop.forwarded_phone || '' });
    setShowShopList(false);
  };

  const balance = parseFloat(form.quoted_amount || 0) - parseFloat(form.advance_amount || 0) - parseFloat(form.balance_amount_received || 0);

  return (
    <div className="container-fluid py-2">
      <div className="page-header mb-2 py-1">
        <h4 className="mb-0">{id ? '✏️ Edit Repair' : '➕ New Repair'}</h4>
        <button onClick={() => navigate('/repairs')} className="btn btn-outline-secondary btn-sm px-3">← Back</button>
      </div>
      
      <div className="table-card p-3 mx-auto" style={{ maxWidth: 850 }}>
        <form onSubmit={handleSubmit}>
          <div className="row g-2">
            {/* Customer & Specs Info */}
            <div className="col-md-8 border-end pe-3">
              <div className="row g-2">
                <div className="col-md-6 text-uppercase position-relative">
                  <label className="x-small fw-bold text-muted mb-0">Customer Name *</label>
                  <input 
                    className="form-control form-control-sm border-2 fw-bold text-uppercase" 
                    required 
                    placeholder="Search or Type Name..."
                    value={customerSearch}
                    onChange={e => {
                        setCustomerSearch(e.target.value);
                        setForm({ ...form, customer_name: e.target.value.toUpperCase() });
                        setShowCustList(true);
                    }}
                    onFocus={() => setShowCustList(true)}
                    onBlur={() => setTimeout(() => setShowCustList(false), 200)}
                  />
                  {showCustList && customerSearch && (
                      <div className="position-absolute w-100 bg-white shadow border rounded mt-1 overflow-auto z-3" style={{ maxHeight: 200, left: 0 }}>
                          {customers.filter(c => c.name.toUpperCase().includes(customerSearch.toUpperCase()) || c.phone.includes(customerSearch)).slice(0, 10).map((c, i) => (
                              <div key={i} className="p-2 x-small cursor-pointer border-bottom hover-bg-light text-uppercase d-flex justify-content-between" onMouseDown={() => {
                                  setForm({ ...form, customer_id: c.id, customer_name: c.name, customer_phone: c.phone, customer_email: c.email || '', customer_address: c.address || '' });
                                  setCustomerSearch(c.name);
                                  setShowCustList(false);
                              }}>
                                  <span className="fw-bold">{c.name}</span>
                                  <span className="text-muted">{c.phone}</span>
                              </div>
                          ))}
                      </div>
                  )}
                </div>
                <div className="col-md-6">
                  <label className="x-small fw-bold text-muted mb-0">Phone *</label>
                  <input className="form-control form-control-sm border-2 fw-bold" required {...f('customer_phone')} />
                </div>
                <div className="col-md-6">
                  <label className="x-small fw-bold text-muted mb-0">Email</label>
                  <input className="form-control form-control-sm" type="email" {...f('customer_email')} />
                </div>
                <div className="col-md-6">
                  <label className="x-small fw-bold text-muted mb-0">Submitted Date</label>
                  <input type="date" className="form-control form-control-sm" {...f('submitted_date')} />
                </div>
                <div className="col-md-12">
                  <label className="x-small fw-bold text-muted mb-0">Customer Address</label>
                  <input className="form-control form-control-sm" placeholder="Address Details" {...f('customer_address')} />
                </div>
                <div className="col-md-8">
                  <label className="x-small fw-bold text-muted mb-0">Device Model *</label>
                  <input className="form-control form-control-sm border-2 text-primary fw-bold" required placeholder="Device Model" {...f('device_model')} />
                </div>
                <div className="col-md-4">
                  <label className="x-small fw-bold text-muted mb-0">Est. Delivery</label>
                  <input type="date" className="form-control form-control-sm border-info" {...f('estimated_delivery_date')} />
                </div>
              </div>

              {/* Issues */}
              <div className="mt-3">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <label className="x-small fw-bold text-uppercase text-muted mb-0">Issue Description(s) *</label>
                  <button type="button" className="btn btn-xs btn-outline-primary py-0" onClick={addIssue}>+ ADD</button>
                </div>
                <div className="max-h-150 overflow-auto pe-1">
                  {form.issue_description.map((issue, idx) => (
                    <div key={idx} className="input-group input-group-sm mb-1 shadow-none">
                      <span className="input-group-text bg-light x-small fw-bold">{idx + 1}</span>
                      <input 
                        className="form-control x-small text-uppercase" 
                        placeholder="Description..." required value={issue} 
                        onChange={e => updateIssue(idx, e.target.value.toUpperCase())} 
                      />
                      {form.issue_description.length > 1 && (
                        <button type="button" className="btn btn-outline-danger btn-xs" onClick={() => removeIssue(idx)}>✕</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Forwarding Section (Collapsible Logic) */}
              <div className="mt-3 pt-2 border-top">
                <div className="form-check form-switch mb-1">
                  <input className="form-check-input" type="checkbox" id="isForwarded" {...f('is_forwarded')} checked={form.is_forwarded} />
                  <label className="form-check-label x-small fw-bold text-primary" htmlFor="isForwarded">Forward to External Shop?</label>
                </div>
                {form.is_forwarded && (
                  <div className="row g-2 p-2 bg-light rounded border border-warning shadow-sm">
                    <div className="col-6 position-relative">
                      <input className="form-control form-control-sm x-small" placeholder="Shop Name" {...f('forwarded_to')} onFocus={() => setShowShopList(true)} onBlur={() => setTimeout(() => setShowShopList(false), 200)} />
                      {showShopList && externalShops.length > 0 && (
                        <div className="position-absolute w-100 bg-white shadow-sm border rounded mt-1 overflow-auto" style={{ maxHeight: 100, zIndex: 1000, left: 0 }}>
                           {externalShops.filter(s => s.forwarded_to.toUpperCase().includes((form.forwarded_to || '').toUpperCase())).map((shop, i) => (
                             <div key={i} className="p-1 x-small cursor-pointer border-bottom hover-bg-light" onMouseDown={() => selectShop(shop)}>
                               <div className="fw-bold">{shop.forwarded_to}</div>
                             </div>
                           ))}
                        </div>
                      )}
                    </div>
                    <div className="col-6">
                      <input className="form-control form-control-sm x-small" placeholder="Phone" {...f('forwarded_phone')} />
                    </div>
                    <div className="col-6">
                      <input type="date" className="form-control form-control-sm x-small" {...f('external_expected_delivery')} />
                    </div>
                    <div className="col-6">
                      <div className="input-group input-group-sm">
                        <span className="input-group-text bg-white x-small">₹</span>
                        <input type="number" step="0.01" className="form-control x-small fw-bold text-danger" placeholder="Cost" {...f('service_center_cost')} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Financial Tracking & Settlement */}
            <div className="col-md-4 ps-3 bg-light-subtle rounded py-2">
              <h6 className="x-small fw-bold text-uppercase text-muted mb-2 pb-1 border-bottom">💰 Financials</h6>
              
              <div className="mb-2">
                <label className="x-small fw-bold opacity-75 d-block mb-1">Quoted Amount</label>
                <div className="input-group input-group-sm">
                  <span className="input-group-text bg-white">₹</span>
                  <input type="number" step="0.01" className="form-control fw-bold text-dark fs-5" {...f('quoted_amount')} />
                </div>
              </div>

              <div className="mb-2">
                <label className="x-small fw-bold text-success d-block mb-1">Advance Taken</label>
                <div className="input-group input-group-sm mb-1">
                  <span className="input-group-text bg-white text-success">₹</span>
                  <input type="number" step="0.01" className="form-control fw-bold text-success fs-5" {...f('advance_amount')} />
                </div>
                <select className="form-select form-select-sm x-small" {...f('advance_payment_mode')}>
                  <option value="CASH">CASH</option>
                  <option value="PHONEPE">PHONEPE</option>
                  <option value="GPAY">GPAY</option>
                  <option value="PAYTM">PAYTM</option>
                  <option value="CARD">CARD</option>
                </select>
              </div>

              {form.status === 'delivered' && !form.balance_received_at && (
                <div className="mb-2 animate-fade-in border-top pt-2">
                  <label className="x-small fw-bold text-info d-block mb-1">Final Settlement Amount</label>
                  <div className="input-group input-group-sm mb-1">
                    <span className="input-group-text bg-white text-info">₹</span>
                    <input type="number" step="0.01" className="form-control fw-bold text-info fs-5" {...f('balance_amount_received')} />
                  </div>
                  <select className="form-select form-select-sm x-small" {...f('balance_payment_mode')}>
                    <option value="CASH">CASH</option>
                    <option value="PHONEPE">PHONEPE</option>
                    <option value="GPAY">GPAY</option>
                    <option value="PAYTM">PAYTM</option>
                    <option value="CARD">CARD</option>
                  </select>
                </div>
              )}

              <div className="bg-white p-2 rounded border border-info mb-3 shadow-sm">
                <div className="d-flex justify-content-between align-items-center">
                  <span className="x-small fw-bold text-uppercase text-primary">Pending Balance</span>
                  <span className="fs-4 fw-bold text-primary">₹{balance.toLocaleString()}</span>
                </div>
                
                {form.balance_amount_received > 0 ? (
                  <div className="mt-1 pt-1 border-top border-light text-center">
                    <div className="badge bg-success w-100 py-1">SETTLED</div>
                    <div className="x-small opacity-75 mt-1 fw-bold text-success">
                      Pending amount ₹{parseFloat(form.balance_amount_received).toLocaleString()} paid at {new Date(form.balance_received_at).toLocaleString('en-IN')}
                    </div>
                  </div>
                ) : (
                  balance > 0 && id && (
                    <button type="button" className="btn btn-primary btn-sm w-100 mt-2 fw-bold py-1" onClick={handleSettle} disabled={isSettling}>
                      {isSettling ? 'Fetching IST...' : 'COLLECT BALANCE'}
                    </button>
                  )
                )}
              </div>

              {/* Status Selector UI - Multi-option buttons for compactness */}
              <div className="mt-auto pt-3">
                <label className="x-small fw-bold text-muted mb-1 d-block text-uppercase">Repair Status</label>
                <select className={`form-select form-select-sm fw-bold ${form.status === 'delivered' ? 'border-success text-success' : 'border-primary text-primary'}`} {...f('status')}>
                  <option value="pending">PENDING</option>
                  <option value="in_progress">IN PROGRESS</option>
                  <option value="completed">COMPLETED</option>
                  <option value="delivered">DELIVERED</option>
                </select>
              </div>

              <div className="mt-4 pt-3 border-top">
                <button type="submit" className="btn btn-success w-100 fw-bold shadow-sm mb-2">{id ? '🚀 UPDATE REPAIR' : '✅ CREATE REPAIR'}</button>
                <button type="button" className="btn btn-link btn-sm text-secondary w-100 p-0" onClick={() => navigate('/repairs')}>Discard Changes</button>
              </div>
            </div>
          </div>
        </form>
      </div>
      
      <style>{`
        .x-small { font-size: 0.75rem; }
        .btn-xs { padding: 1px 5px; font-size: 0.7rem; }
        .max-h-150 { max-height: 150px; }
        .bg-light-subtle { background-color: #f8f9fa; }
        .hover-bg-light:hover { background-color: #f0f0f0; }
        input.form-control-sm { height: 32px; }
      `}</style>
    </div>
  );
}
