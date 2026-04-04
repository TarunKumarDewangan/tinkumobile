import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Modal, Button } from 'react-bootstrap';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';

export default function SaleForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isOwner } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [shops, setShops]       = useState([]);
  
  // Form State
  const [form, setForm] = useState({ 
    shop_id: '',
    customer_id: '', 
    sale_date: new Date().toISOString().slice(0,10), 
    bill_type: 'kaccha', 
    payment_method: 'cash', 
    discount: 0,
    total_paid: 0,
    cgst_rate: 9,
    sgst_rate: 9,
    rounding_mode: 'auto',
    round_off: 0,
    notes: '' 
  });
  const [items, setItems] = useState([{ product_id: '', imei: '', ram: '', storage: '', color: '', quantity: 1, unit_price: '', base_price: 0 }]);
  
  // Internal state to track if round_off is manually overridden
  const [isManualRound, setIsManualRound] = useState(false);

  // Customer Search & Add
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustModal, setShowCustModal] = useState(false);
  const [newCust, setNewCust] = useState({ name: '', phone: '', address: '' });

  useEffect(() => {
    fetchInitialData();
    if (id) loadSale();
  }, [id]);

  const fetchInitialData = async () => {
    try {
      const custRes = await api.get('/customers');
      setCustomers(custRes.data);
      
      if (isOwner()) {
        const shopsRes = await api.get('/shops');
        setShops(shopsRes.data);
      } else {
        setForm(prev => ({ ...prev, shop_id: user.shop_id }));
        loadProducts(user.shop_id);
      }
    } catch (e) { toast.error('Error loading data'); }
  };

  const loadSale = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/sale-invoices/${id}`);
      setForm({
        shop_id: data.shop_id,
        customer_id: data.customer_id,
        sale_date: data.sale_date,
        bill_type: data.bill_type,
        payment_method: data.payment_method,
        discount: data.discount,
        total_paid: data.total_paid,
        cgst_rate: data.cgst_rate,
        sgst_rate: data.sgst_rate,
        rounding_mode: data.rounding_mode,
        round_off: data.round_off,
        notes: data.notes || ''
      });
      setIsManualRound(true); 
      setItems(data.items.map(i => ({
        product_id: i.product_id,
        imei: i.imei || '',
        ram: i.ram || '',
        storage: i.storage || '',
        color: i.color || '',
        quantity: i.quantity,
        unit_price: i.unit_price,
        base_price: i.product?.base_price || 0
      })));
      setCustomerSearch(data.customer?.name || '');
      loadProducts(data.shop_id);
    } catch (e) { toast.error('Error loading sale'); }
    finally { setLoading(false); }
  };

  const loadProducts = async (shopId) => {
    if (!shopId) return;
    try {
      const { data } = await api.get(`/products?shop_id=${shopId}`);
      setProducts(data);
    } catch (e) { toast.error('Error loading products'); }
  };

  const addItem = () => setItems([...items, { product_id: '', imei: '', ram: '', storage: '', color: '', quantity: 1, unit_price: '', base_price: 0 }]);
  const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i));
  
  const updateItem = (i, field, val) => {
    const arr = [...items];
    arr[i][field] = val;
    if (field === 'product_id') {
      const p = products.find(p => p.id == val);
      if (p) {
          arr[i].unit_price = p.selling_price;
          arr[i].base_price = p.base_price || 0;
          if (p.attributes) {
              arr[i].ram = p.attributes.ram || '';
              arr[i].storage = p.attributes.storage || '';
              arr[i].color = p.attributes.color || '';
          }
      }
    }
    setItems(arr);
  };

  // Calculations
  const subtotal = items.reduce((s, i) => s + (i.quantity * i.unit_price || 0), 0);
  const cgstAmount = (subtotal * (parseFloat(form.cgst_rate) || 0)) / 100;
  const sgstAmount = (subtotal * (parseFloat(form.sgst_rate) || 0)) / 100;
  const rawTotal = subtotal + cgstAmount + sgstAmount - (parseFloat(form.discount) || 0);
  
  // Rounding Logic
  useEffect(() => {
    if (!isManualRound) {
        let roundedValue = rawTotal;
        if (form.rounding_mode === 'up') roundedValue = Math.ceil(rawTotal);
        else if (form.rounding_mode === 'down') roundedValue = Math.floor(rawTotal);
        else if (form.rounding_mode === 'auto') roundedValue = Math.round(rawTotal);
        
        const diff = roundedValue - rawTotal;
        setForm(f => ({ ...f, round_off: parseFloat(diff.toFixed(2)) }));
    }
  }, [rawTotal, form.rounding_mode, isManualRound]);

  const grandTotal = rawTotal + (parseFloat(form.round_off) || 0);

  const totalCost = items.reduce((s, i) => s + (i.quantity * i.base_price || 0), 0);
  const totalProfit = grandTotal - totalCost;
  const profitColor = totalProfit > 0 ? 'text-success' : 'text-danger';

  const handleRoundClick = (type) => {
      let roundedValue = rawTotal;
      if (type === 'up') roundedValue = Math.ceil(rawTotal);
      else if (type === 'down') roundedValue = Math.floor(rawTotal);
      
      const diff = roundedValue - rawTotal;
      setForm({ ...form, round_off: parseFloat(diff.toFixed(2)), rounding_mode: 'manual' });
      setIsManualRound(true);
  };

  // Customer Handling
  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) || 
    c.phone.includes(customerSearch)
  );

  const handleSelectCustomer = (c) => {
    setForm({ ...form, customer_id: c.id });
    setCustomerSearch(c.name);
  };

  const handleAddCustomer = async (e) => {
      e.preventDefault();
      try {
          const { data } = await api.post('/customers', newCust);
          setCustomers([...customers, data]);
          handleSelectCustomer(data);
          setShowCustModal(false);
          toast.success('✅ Customer added');
      } catch (e) { toast.error('Error adding customer'); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.customer_id) return toast.warning('Please select a customer');
    
    try {
      const payload = { ...form, items, round_off: form.round_off };
      if (id) {
        await api.put(`/sale-invoices/${id}`, payload);
        toast.success('✅ Sale updated');
      } else {
        await api.post('/sale-invoices', payload);
        toast.success('✅ Sale recorded successfully');
      }
      navigate('/sales');
    } catch (e) { toast.error(e.response?.data?.message || 'Error saving sale'); }
  };

  return (
    <div className="container-fluid py-2">
      <div className="page-header mb-3 d-flex justify-content-between align-items-center">
        <div className="text-uppercase">
           <h2 className="mb-0 fw-bold">{id ? '✍️ EDIT SALE' : '➕ NEW SALE ENTRY'}</h2>
           <p className="text-muted small mb-0">RECORD PRODUCT SALES, CONFIGURATIONS AND GST</p>
        </div>
        <button onClick={() => navigate('/sales')} className="btn btn-outline-secondary btn-sm text-uppercase fw-bold">← Back to List</button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="row g-3">
          {/* LEFT COLUMN: Sale Details */}
          <div className="col-12 col-xl-8">
             <div className="card shadow-sm border-0 bg-white rounded-3 mb-3">
                <div className="card-body p-4">
                    <div className="row g-3">
                        {isOwner() && (
                            <div className="col-12">
                                <label className="form-label small fw-bold text-primary">SELECT SHOP <span className="text-danger">*</span></label>
                                <select className="form-select border-primary fw-bold" required value={form.shop_id} onChange={e => { setForm({...form, shop_id: e.target.value}); loadProducts(e.target.value); }}>
                                    <option value="">— SELECT BRANCH —</option>
                                    {shops.map(s => <option key={s.id} value={s.id}>{s.name.toUpperCase()}</option>)}
                                </select>
                            </div>
                        )}
                        <div className="col-12 text-uppercase">
                            <label className="form-label small fw-bold">CUSTOMER DETAILS <span className="text-danger">*</span></label>
                            <div className="input-group">
                                <span className="input-group-text bg-white border-end-0"><i className="bi bi-search"></i></span>
                                <input 
                                    type="text" 
                                    className="form-control border-start-0 text-uppercase" 
                                    placeholder="TYPE NAME OR PHONE TO SEARCH..." 
                                    value={customerSearch}
                                    onChange={e => { setCustomerSearch(e.target.value); setForm({...form, customer_id: ''}); }}
                                />
                                <button type="button" className="btn btn-primary fw-bold" onClick={() => setShowCustModal(true)} title="Add New Customer">+</button>
                            </div>
                            {customerSearch && !form.customer_id && filteredCustomers.length > 0 && (
                                <div className="list-group shadow-sm mt-1 position-absolute w-100 z-3 border" style={{ maxWidth: '95%' }}>
                                    {filteredCustomers.slice(0, 5).map(c => (
                                        <button key={c.id} type="button" className="list-group-item list-group-item-action py-2 text-uppercase" onClick={() => handleSelectCustomer(c)}>
                                            <div className="fw-bold">{c.name}</div>
                                            <div className="x-small text-muted">📞 {c.phone} | {c.address || 'NO ADDRESS'}</div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
             </div>

             <div className="card shadow-sm border-0 bg-white rounded-3 mb-3">
                <div className="card-header bg-white border-0 py-3 d-flex justify-content-between align-items-center">
                    <h5 className="mb-0 fw-bold text-uppercase">🛒 Items for Sale</h5>
                    <button type="button" className="btn btn-sm btn-primary rounded-pill px-3 fw-bold" onClick={addItem}>+ ADD ITEM</button>
                </div>
                <div className="table-responsive">
                    <table className="table table-hover mb-0 align-middle">
                        <thead className="bg-light text-uppercase x-small fw-bold">
                            <tr>
                                <th className="ps-4">Product & Configuration</th>
                                <th style={{ width: '100px' }}>Quantity</th>
                                <th style={{ width: '150px' }} className="text-end">Unit Price</th>
                                <th style={{ width: '150px' }} className="text-end">Total</th>
                                <th style={{ width: '50px' }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, i) => {
                                const pProfit = (item.unit_price - item.base_price) * item.quantity;
                                return (
                                    <tr key={i}>
                                        <td className="ps-4 py-3">
                                            <select className="form-select form-select-sm text-uppercase fw-bold mb-2 shadow-sm border-primary" required value={item.product_id} onChange={e => updateItem(i, 'product_id', e.target.value)}>
                                                <option value="">— SELECT PRODUCT —</option>
                                                {products.map(p => (
                                                    <option key={p.id} value={p.id}>{p.name.toUpperCase()} (STOCK: {p.current_stock ?? '0'})</option>
                                                ))}
                                            </select>
                                            
                                            <div className="row g-1 text-uppercase">
                                                <div className="col-12 mb-1">
                                                    <label className="x-small fw-bold text-primary mb-0">IMEI/SERIAL NUMBER</label>
                                                    <input type="text" className="form-control form-control-sm fw-bold border-primary shadow-sm" placeholder="ENTER 15-DIGIT IMEI..." value={item.imei} onChange={e => updateItem(i,'imei', e.target.value.toUpperCase())} />
                                                </div>
                                                <div className="col-4">
                                                    <input type="text" className="form-control form-control-xs" placeholder="RAM" value={item.ram} onChange={e => updateItem(i,'ram', e.target.value.toUpperCase())} />
                                                </div>
                                                <div className="col-4">
                                                    <input type="text" className="form-control form-control-xs" placeholder="STORAGE" value={item.storage} onChange={e => updateItem(i,'storage', e.target.value.toUpperCase())} />
                                                </div>
                                                <div className="col-4">
                                                    <input type="text" className="form-control form-control-xs" placeholder="COLOR" value={item.color} onChange={e => updateItem(i,'color', e.target.value.toUpperCase())} />
                                                </div>
                                            </div>

                                            <div className={`x-small mt-2 fw-bold ${pProfit >= 0 ? 'text-success' : 'text-danger'}`}>
                                                EST. MARGIN: ₹{pProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </div>
                                        </td>
                                        <td>
                                            <input type="number" className="form-control form-control-sm fw-bold border-2" min="1" required value={item.quantity} onChange={e => updateItem(i, 'quantity', parseInt(e.target.value))} />
                                        </td>
                                        <td>
                                            <div className="input-group input-group-sm">
                                                <span className="input-group-text">₹</span>
                                                <input type="number" step="0.01" className="form-control text-end fw-bold" required value={item.unit_price} onChange={e => updateItem(i, 'unit_price', parseFloat(e.target.value))} />
                                            </div>
                                        </td>
                                        <td className="text-end fw-bold text-primary">₹{((item.quantity * item.unit_price) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                        <td className="pe-3">
                                            {items.length > 1 && <button type="button" className="btn btn-link text-danger p-0 border-0" onClick={() => removeItem(i)}>✕</button>}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
             </div>
          </div>

          {/* RIGHT COLUMN: Summary & Payment */}
          <div className="col-12 col-xl-4">
             <div className="card shadow-sm border-0 bg-white rounded-3 mb-3">
                <div className="card-body p-4 text-uppercase">
                    <h5 className="fw-bold border-bottom pb-2 mb-3">💰 BILL SUMMARY</h5>
                    
                    <div className="row g-2 mb-3">
                        <div className="col-6">
                            <label className="form-label small fw-bold">SALE DATE</label>
                            <input type="date" className="form-control" value={form.sale_date} onChange={e => setForm({...form, sale_date: e.target.value})} />
                        </div>
                        <div className="col-6">
                            <label className="form-label small fw-bold">BILL TYPE</label>
                            <select className="form-select fw-bold border-primary" value={form.bill_type} onChange={e => setForm({...form, bill_type: e.target.value})}>
                                <option value="kaccha">KACCHA</option>
                                <option value="pakka">PAKKA</option>
                            </select>
                        </div>
                    </div>

                    <div className="row g-2 mb-3">
                         <div className="col-6">
                            <label className="form-label x-small fw-bold text-muted">CGST %</label>
                            <input type="number" step="0.01" className="form-control form-control-sm fw-bold" value={form.cgst_rate} onChange={e => setForm({...form, cgst_rate: e.target.value})} />
                        </div>
                        <div className="col-6">
                            <label className="form-label x-small fw-bold text-muted">SGST %</label>
                            <input type="number" step="0.01" className="form-control form-control-sm fw-bold" value={form.sgst_rate} onChange={e => setForm({...form, sgst_rate: e.target.value})} />
                        </div>
                    </div>

                    <div className="row g-2 mb-3">
                        <div className="col-6">
                            <label className="form-label x-small fw-bold text-muted">PAYMENT</label>
                            <select className="form-select form-select-sm" value={form.payment_method} onChange={e => setForm({...form, payment_method: e.target.value})}>
                                <option value="cash">CASH</option>
                                <option value="card">CARD</option>
                                <option value="mobile">UPI / MOBILE</option>
                            </select>
                        </div>
                        <div className="col-6">
                             <label className="form-label x-small fw-bold text-muted">ROUNDING</label>
                             <select className="form-select form-select-sm" value={form.rounding_mode} onChange={e => {
                                 setForm({...form, rounding_mode: e.target.value});
                                 setIsManualRound(false);
                             }}>
                                <option value="auto">AUTO (PAISE)</option>
                                <option value="up">UP (CEIL)</option>
                                <option value="down">DOWN (FLOOR)</option>
                                <option value="manual">MANUAL ADJUST</option>
                            </select>
                        </div>
                    </div>

                    <div className="bg-light p-3 rounded-3 mb-3 border border-secondary-subtle">
                        <div className="d-flex justify-content-between mb-1">
                            <span className="small text-muted fw-bold">SUBTOTAL:</span>
                            <span className="fw-bold">₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="d-flex justify-content-between mb-1">
                            <span className="small text-muted fw-bold">CGST ({form.cgst_rate}%):</span>
                            <span className="fw-bold">₹{cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="d-flex justify-content-between mb-1">
                            <span className="small text-muted fw-bold">SGST ({form.sgst_rate}%):</span>
                            <span className="fw-bold">₹{sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="d-flex justify-content-between mb-1 align-items-center mt-2">
                            <span className="small text-muted fw-bold">DISCOUNT (₹):</span>
                            <input type="number" className="form-control form-control-sm text-end fw-bold text-danger border-danger" style={{ width: '120px' }} 
                                value={form.discount === 0 ? '' : form.discount} 
                                onFocus={e => e.target.select()}
                                onChange={e => setForm({...form, discount: e.target.value})} 
                            />
                        </div>
                        
                        {/* Round Off Line (Paise Adjustment) */}
                        <div className="mt-3 p-2 bg-white rounded border border-primary-subtle">
                             <div className="d-flex justify-content-between align-items-center mb-2">
                                <span className="small text-primary fw-black">ROUND OFF ADJUSTMENT:</span>
                                <div className="d-flex gap-1">
                                    <button type="button" className="btn btn-xs btn-outline-success fw-bold" onClick={() => handleRoundClick('up')}>ROUND UP ↑</button>
                                    <button type="button" className="btn btn-xs btn-outline-danger fw-bold" onClick={() => handleRoundClick('down')}>ROUND DOWN ↓</button>
                                </div>
                             </div>
                             <div className="d-flex align-items-center gap-2">
                                <span className="x-small text-muted fw-bold">ADJUST PAISE (₹):</span>
                                <input 
                                    type="number" 
                                    step="0.01" 
                                    className="form-control form-control-sm text-end fw-black text-primary border-primary" 
                                    style={{ width: '120px' }} 
                                    value={form.round_off === 0 ? '' : form.round_off} 
                                    onFocus={e => e.target.select()}
                                    onChange={e => {
                                        setForm({...form, round_off: parseFloat(e.target.value) || 0, rounding_mode: 'manual'});
                                        setIsManualRound(true);
                                    }} 
                                />
                                {form.round_off !== 0 && (
                                    <button type="button" className="btn btn-link btn-sm p-0 m-0 text-decoration-none" onClick={() => setIsManualRound(false)} title="Reset to Auto">↺ RESET</button>
                                )}
                             </div>
                        </div>

                        <hr />
                        <div className="d-flex justify-content-between mb-1">
                            <span className="h4 mb-0 fw-black">GRAND TOTAL:</span>
                            <span className="h4 mb-0 fw-black text-primary">₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="d-flex justify-content-between mt-1 pt-1 border-top border-secondary-subtle">
                             <span className="x-small text-muted fw-bold">EST. PROFIT:</span>
                             <span className={`x-small fw-bold ${profitColor}`}>₹{totalProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>

                    <div className="mb-3">
                        <label className="form-label small fw-bold text-success">AMOUNT PAID (INITIAL)</label>
                        <input type="number" step="0.01" className="form-control fs-3 fw-bold text-success border-success bg-success bg-opacity-10" placeholder="₹ 0.00" 
                            value={form.total_paid === 0 ? '' : form.total_paid} 
                            onFocus={e => e.target.select()}
                            onChange={e => setForm({...form, total_paid: e.target.value})} 
                        />
                        {grandTotal - form.total_paid > 0 && (
                            <div className="small text-danger mt-1 fw-bold">PENDING BALANCE: ₹{(grandTotal - form.total_paid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                        )}
                    </div>

                    <div className="mb-4">
                        <label className="form-label small fw-bold text-muted">NOTES / REMARKS</label>
                        <textarea className="form-control text-uppercase x-small" rows={2} placeholder="E.G. ANY SPECIAL INSTRUCTIONS..." value={form.notes} onChange={e => setForm({...form, notes: e.target.value.toUpperCase()})} />
                    </div>

                    <button type="submit" className="btn btn-primary w-100 py-3 fw-black text-uppercase shadow shadow-primary rounded- pill" disabled={loading}>
                        {loading ? 'Processing...' : id ? 'UPDATE SALE INVOICE' : 'CONFIRM & SAVE SALE'}
                    </button>
                </div>
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
                  <div className="mb-3">
                      <label className="form-label small fw-bold">Full Name <span className="text-danger">*</span></label>
                      <input type="text" className="form-control" required value={newCust.name} onChange={e => setNewCust({...newCust, name: e.target.value.toUpperCase()})} />
                  </div>
                  <div className="mb-3">
                      <label className="form-label small fw-bold">Phone Number <span className="text-danger">*</span></label>
                      <input type="text" className="form-control" required value={newCust.phone} onChange={e => setNewCust({...newCust, phone: e.target.value})} />
                  </div>
                  <div className="mb-0">
                      <label className="form-label small fw-bold">Address</label>
                      <input type="text" className="form-control" value={newCust.address} onChange={e => setNewCust({...newCust, address: e.target.value.toUpperCase()})} />
                  </div>
              </Modal.Body>
              <Modal.Footer>
                  <Button variant="secondary" className="fw-bold" onClick={() => setShowCustModal(false)}>CANCEL</Button>
                  <Button type="submit" variant="primary" className="fw-bold px-4">CREATE CUSTOMER</Button>
              </Modal.Footer>
          </form>
      </Modal>

      <style>{`
          .x-small { font-size: 0.7rem; }
          .form-control-xs { padding: 0.25rem 0.5rem; font-size: 0.65rem; height: auto; }
          .fw-black { font-weight: 900; }
          .z-3 { z-index: 1030; }
          .shadow-primary { box-shadow: 0 4px 15px rgba(13, 110, 253, 0.25) !important; }
          .btn-xs { padding: 0.1rem 0.4rem; font-size: 0.65rem; }
      `}</style>
    </div>
  );
}
