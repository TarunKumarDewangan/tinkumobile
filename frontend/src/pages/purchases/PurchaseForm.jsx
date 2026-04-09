import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Modal, Button } from 'react-bootstrap';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../api/axios';
import BarcodeScannerModal from '../../components/BarcodeScannerModal';
import BulkScanModal from '../../components/BulkScanModal';

export default function PurchaseForm() {
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts]   = useState([]);
  const [categories, setCategories] = useState([]);
  const [shops, setShops]           = useState([]);
  const [items, setItems]         = useState([]);
  const [form, setForm] = useState({
    shop_id: 1, // TinkuMobiles Main Branch as default
    supplier_id: '',
    purchase_date: new Date().toISOString().slice(0,10),
    received_at: new Date().toISOString().slice(0,10),
    status: 'ordered',
    bill_type: 'kaccha',
    discount: 0,
    total_paid: 0,
    cgst_rate: 9,
    sgst_rate: 9,
    calculate_gst: true,
    cash_discount: 0,
    is_cash_discount_on_bill: true,
    notes: '',
    expected_delivery_date: '',
    rounding_mode: 'auto',
  });
  const navigate = useNavigate();
  const { id }     = useParams();
  const { isOwner } = useAuth();
  const [loading, setLoading] = useState(false);

  // Quick Add Supplier
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: '', phone: '', address: '' });

  useEffect(() => {
    loadSuppliers();
    api.get('/products').then(r  => {
      // Filter for Mobile New (Category ID: 1)
      setProducts(r.data.filter(p => p.category_id == 1));
    });
    api.get('/categories').then(r => setCategories(r.data));
    if (isOwner()) {
      api.get('/shops').then(r => setShops(r.data));
    }

    if (id) {
      setLoading(true);
      api.get(`/purchase-invoices/${id}`).then(r => {
        const p = r.data;
        setForm({
          shop_id: p.shop_id,
          supplier_id: p.supplier_id,
          purchase_date: p.purchase_date,
          received_at: p.received_at ? new Date(p.received_at).toISOString().slice(0,10) : '',
          status: p.status,
          bill_type: p.bill_type || 'kaccha',
          discount: p.discount,
          total_paid: p.total_paid || 0,
          cgst_rate: p.cgst_rate || 9,
          sgst_rate: p.sgst_rate || 9,
          calculate_gst: p.calculate_gst ?? true,
          cash_discount: p.cash_discount || 0,
          is_cash_discount_on_bill: p.is_cash_discount_on_bill ?? true,
          notes: p.notes || '',
          expected_delivery_date: p.expected_delivery_date || '',
          rounding_mode: p.rounding_mode || 'auto',
        });
        setItems(p.items.map(i => ({
          product_id: i.product_id,
          is_new: false,
          new_product_name: '',
          category_id: '',
          imei: i.imei || '',
          ram: i.ram || '',
          storage: i.storage || '',
          color: i.color || '',
          quantity: i.quantity,
          unit_price: i.unit_price,
          selling_price: i.selling_price || '',
          min_selling_price: i.min_selling_price || '',
          max_selling_price: i.max_selling_price || ''
        })));
      }).finally(() => setLoading(false));
    }
  }, [isOwner, id]);

  const loadSuppliers = async () => {
    const r = await api.get('/suppliers');
    setSuppliers(r.data);
  };

  const handleQuickSupplierAdd = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/suppliers', newSupplier);
      toast.success('✅ Supplier added!');
      setSuppliers(prev => [...prev, data]);
      setForm(prev => ({ ...prev, supplier_id: data.id }));
      setShowSupplierModal(false);
      setNewSupplier({ name: '', phone: '', address: '' });
    } catch (e) {
      toast.error('Failed to add supplier');
    }
  };

  const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i));
  
  const updateItem = (i, field, val) => {
    const a = [...items];
    a[i][field] = val;
    
    // Auto-split IMEIs if they are comma-separated
    if (field === 'imei' && val.includes(',')) {
      const imeis = val.split(',').map(s => s.trim()).filter(Boolean);
      if (imeis.length > 1) {
        const baseItem = { ...a[i] };
        // Update first item
        a[i].imei = imeis[0];
        a[i].quantity = 1;
        
        // Add new items for the rest
        const newRows = imeis.slice(1).map(imei => ({
          ...baseItem,
          imei: imei,
          quantity: 1
        }));
        
        a.splice(i + 1, 0, ...newRows);
        setItems(a);
        return;
      }
    }

    // Auto-fill attributes if an existing product is selected
    if (field === 'product_id') {
      const p = products.find(x => x.id == val);
      if (p) {
        a[i].unit_price = p.purchase_price;
        a[i].selling_price = p.selling_price;
        a[i].min_selling_price = p.min_selling_price || '';
        a[i].max_selling_price = p.max_selling_price || '';
        // Search attributes if available (assuming Product model has them)
        if (p.attributes) {
          a[i].ram = p.attributes.ram || '';
          a[i].storage = p.attributes.storage || '';
          a[i].color = p.attributes.color || '';
        }
      }
    }
    setItems(a);
  };
  
  const [scanner, setScanner] = useState({ show: false, itemIndex: null });
  const [showBulkScan, setShowBulkScan] = useState(false);

  const handleAddBulkItems = (newItems) => {
    setItems(prev => {
      let current = [...prev];
      // If the first item is empty/default, remove it before merging
      if (current.length === 1 && !current[0].product_id && !current[0].imei && !current[0].new_product_name) {
        current = [];
      }
      return [...current, ...newItems];
    });
  };

  const getFieldConfig = (item) => {
    // Focused on New Mobiles (Mobile New)
    return {
      imei: { label: 'IMEI / Serial', placeholder: '15-digit IMEI', show: true },
      ram: { label: 'RAM', placeholder: 'e.g. 8GB', show: true },
      storage: { label: 'Storage', placeholder: 'e.g. 128GB', show: true },
      color: { label: 'Color', placeholder: 'e.g. Blue', show: true }
    };
  };

  const total      = items.reduce((s, i) => s + (parseFloat(i.quantity || 0) * parseFloat(i.unit_price || 0)), 0);
  const cgstAmount = form.calculate_gst ? (total * (parseFloat(form.cgst_rate) || 0)) / 100 : 0;
  const sgstAmount = form.calculate_gst ? (total * (parseFloat(form.sgst_rate) || 0)) / 100 : 0;
  const rawGrandTotal = total + cgstAmount + sgstAmount - (parseFloat(form.discount) || 0) - (form.is_cash_discount_on_bill ? (parseFloat(form.cash_discount) || 0) : 0);
  let grandTotal = Math.round(rawGrandTotal);
  if (form.rounding_mode === 'up') grandTotal = Math.ceil(rawGrandTotal);
  if (form.rounding_mode === 'down') grandTotal = Math.floor(rawGrandTotal);

  const roundOff = (grandTotal - rawGrandTotal).toFixed(3);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (isOwner() && !form.shop_id) {
      toast.error('Please select a shop');
      return;
    }
    const invalid = items.some(item => !item.is_new && !item.product_id);
    const invalidNew = items.some(item => item.is_new && (!item.new_product_name || !item.category_id));
    
    if (invalid || invalidNew) {
      toast.error('Please complete all product selections');
      return;
    }

    try {
      if (id) {
        await api.put(`/purchase-invoices/${id}`, { ...form, items });
        toast.success('✅ Purchase updated successfully!');
      } else {
        await api.post('/purchase-invoices', { ...form, items });
        toast.success(form.status === 'received' ? '✅ Purchase saved and stock updated!' : '📦 Purchase Order saved!');
      }
      navigate('/purchases');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Error saving purchase');
    }
  };

  return (
    <div className="container-fluid py-2">
      <div className="page-header mb-3 d-flex justify-content-between align-items-center">
        <div className="text-uppercase">
           <h2 className="mb-0 fw-bold">{id ? '✍️ EDIT PURCHASE' : '🛒 NEW PURCHASE'}</h2>
           <p className="text-muted small mb-0">MANAGE PURCHASE RECORD AND SUPPLIER DETAILS</p>
        </div>
        <button onClick={() => navigate('/purchases')} className="btn btn-outline-secondary shadow-sm text-uppercase fw-bold btn-sm">← Back</button>
      </div>

      {loading ? (
        <div className="text-center py-5"><div className="spinner-border text-primary"/></div>
      ) : (
        <form onSubmit={handleSubmit}>
        {/* ─ Header Info ─ */}
        <div className="form-card mb-4 shadow-sm border-0 bg-white rounded-3 p-4">
          <div className="d-flex align-items-center gap-2 mb-3 border-bottom pb-2">
             <span className="fs-5">📋</span>
             <h5 className="mb-0 fw-bold text-uppercase">General Information</h5>
          </div>
          <div className="row g-3 text-uppercase">
            {isOwner() && (
              <div className="col-12 col-md-3">
                <label className="form-label small fw-bold text-primary">Shop / Branch <span className="text-danger">*</span></label>
                <select className="form-select form-select-sm border-primary bg-primary-subtle" required value={form.shop_id} onChange={e => setForm({...form, shop_id: e.target.value})}>
                  <option value="">— SELECT SHOP —</option>
                  {shops.map(s => <option key={s.id} value={s.id}>{s.name.toUpperCase()}</option>)}
                </select>
              </div>
            )}
            <div className="col-12 col-md-3">
              <label className="form-label small fw-bold">Bill Type <span className="text-danger">*</span></label>
              <select className="form-select form-select-sm border-2 fw-bold border-secondary" required value={form.bill_type} onChange={e => setForm({...form, bill_type: e.target.value})}>
                <option value="kaccha">KACCHA BILL</option>
                <option value="pakka">PAKKA BILL (GST)</option>
              </select>
            </div>
            <div className="col-12 col-md-3">
              <div className="d-flex justify-content-between align-items-center">
                <label className="form-label small fw-bold">Supplier <span className="text-danger">*</span></label>
                <button type="button" className="btn btn-link p-0 text-decoration-none small fw-black fs-5" onClick={() => setShowSupplierModal(true)}>+</button>
              </div>
              <select className="form-select form-select-sm" required value={form.supplier_id} onChange={e => setForm({...form, supplier_id: e.target.value})}>
                <option value="">— SELECT SUPPLIER —</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name.toUpperCase()}</option>)}
              </select>
            </div>
            <div className="col-12 col-md-3">
              <label className="form-label small fw-bold">Purchase Date</label>
              <input type="date" className="form-control form-control-sm" value={form.purchase_date} onChange={e => setForm({...form, purchase_date: e.target.value})} />
            </div>
            <div className="col-12 col-md-4">
              <label className="form-label small fw-bold">Order Status</label>
              <select className="form-select form-select-sm" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                <option value="ordered">📦 ORDERED (PENDING)</option>
                <option value="received">✅ RECEIVED (IN HAND)</option>
              </select>
            </div>
            {form.status === 'ordered' && (
              <div className="col-12 col-md-4">
                <label className="form-label small fw-bold text-primary">Expected Delivery</label>
                <input type="date" className="form-control form-control-sm border-primary" value={form.expected_delivery_date} onChange={e => setForm({...form, expected_delivery_date: e.target.value})} />
              </div>
            )}
            {form.status === 'received' && (
              <div className="col-12 col-md-4">
                <label className="form-label small fw-bold text-success">Received At</label>
                <input type="date" className="form-control form-control-sm border-success" value={form.received_at} 
                  onChange={e => setForm({...form, received_at: e.target.value})} />
              </div>
            )}
          </div>
        </div>

        <div className="mb-4">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="mb-0 fw-bold text-uppercase">📦 Purchase Items</h5>
            <button type="button" className="btn btn-primary btn-sm d-flex align-items-center gap-2 shadow-sm text-uppercase fw-bold" onClick={() => setShowBulkScan(true)}>
              <span className="fs-5">+</span> Bulk Add Products
            </button>
          </div>

          {items.length === 0 ? (
            <div className="text-center py-5 bg-white rounded-3 shadow-xs border flex-column d-flex align-items-center">
              <div className="fs-1 opacity-25 mb-2">🛒</div>
              <h6 className="text-muted text-uppercase fw-bold">No items added yet</h6>
              <p className="small text-muted mb-3 text-uppercase">Start by adding a product below or use bulk scan</p>
              <button type="button" className="btn btn-outline-primary btn-sm fw-bold text-uppercase" onClick={() => setItems([{product_id: '', is_new: false, new_product_name: '', category_id: 1, imei: '', ram: '', storage: '', color: '', quantity: 1, unit_price: 0, selling_price: 0, min_selling_price: 0, max_selling_price: 0}])}>
                + Add Item Manually
              </button>
            </div>
          ) : (
            <div className="row g-3">
              {items.map((item, i) => {
                const marginVal = parseFloat(item.selling_price || 0) - parseFloat(item.unit_price || 0);
                const marginPer = item.unit_price > 0 ? (marginVal / item.unit_price) * 100 : 0;

                return (
                  <div key={i} className="col-12">
                    <div className="form-card shadow-sm border-0 bg-white rounded-3 p-3 position-relative overflow-hidden border-start border-4 border-primary">
                      {items.length > 0 && (
                        <button type="button" className="btn-close position-absolute top-0 end-0 m-2" onClick={() => removeItem(i)}></button>
                      )}
                      
                      <div className="row g-3">
                        <div className="col-12 col-md-4">
                           <div className="d-flex justify-content-between mb-1">
                            <label className="form-label small fw-bold mb-0 text-uppercase">Product</label>
                            <div className="form-check form-switch p-0 m-0">
                                <label className="form-check-label me-4 small text-muted text-uppercase" htmlFor={`is_new_${i}`} style={{fontSize:'0.65rem'}}>Is New?</label>
                                <input className="form-check-input" type="checkbox" id={`is_new_${i}`} 
                                    checked={item.is_new} onChange={e => updateItem(i, 'is_new', e.target.checked)} />
                            </div>
                           </div>
                           {item.is_new ? (
                             <input type="text" className="form-control form-control-sm text-uppercase" placeholder="E.G. VIVO V70" required value={item.new_product_name} onChange={e => updateItem(i, 'new_product_name', e.target.value)} />
                           ) : (
                             <select className="form-select form-select-sm text-uppercase" required value={item.product_id} onChange={e => updateItem(i, 'product_id', e.target.value)}>
                               <option value="">— CHOOSE PRODUCT —</option>
                               {products.map(p => <option key={p.id} value={p.id}>{p.name.toUpperCase()}</option>)}
                             </select>
                           )}
                        </div>

                        <div className="col-12 col-md-8">
                             {(() => {
                                 return (
                                 <div className="row g-2 text-uppercase">
                                     <div className="col-12 col-md-4">
                                         <label className="small text-muted mb-0 fw-bold">IMEI / SERIALS</label>
                                         <div className="input-group input-group-sm">
                                             <input type="text" className="form-control" placeholder="SCAN OR TYPE..."
                                                 value={item.imei} onChange={e => updateItem(i, 'imei', e.target.value)} />
                                             <button className="btn btn-outline-primary" type="button" onClick={() => setScanner({ show: true, itemIndex: i })}>📷</button>
                                         </div>
                                     </div>
                                     <div className="col-4 col-md-2">
                                         <label className="small text-muted mb-0 fw-bold">RAM</label>
                                         <input type="text" className="form-control form-control-sm" placeholder="8GB"
                                             value={item.ram} onChange={e => updateItem(i, 'ram', e.target.value)} />
                                     </div>
                                     <div className="col-4 col-md-3">
                                         <label className="small text-muted mb-0 fw-bold">STORAGE</label>
                                         <input type="text" className="form-control form-control-sm" placeholder="128GB"
                                             value={item.storage} onChange={e => updateItem(i, 'storage', e.target.value)} />
                                     </div>
                                     <div className="col-4 col-md-3">
                                         <label className="small text-muted mb-0 fw-bold">COLOR</label>
                                         <input type="text" className="form-control form-control-sm" placeholder="BLACK"
                                             value={item.color} onChange={e => updateItem(i, 'color', e.target.value)} />
                                     </div>
                                 </div>
                                 );
                             })()}
                        </div>

                        <div className="col-6 col-md-1">
                            <label className="small text-muted mb-0 fw-bold text-uppercase">Qty</label>
                            <input type="number" className="form-control form-control-sm text-center fw-bold" min="1" value={item.quantity} readOnly={!!item.imei} onChange={e => updateItem(i, 'quantity', parseInt(e.target.value))} />
                        </div>
                        <div className="col-6 col-md-2">
                            <label className="small text-muted mb-0 fw-bold text-uppercase">Buy Price (₹)</label>
                            <input type="number" className="form-control form-control-sm fw-bold" step="0.01" value={item.unit_price} onChange={e => updateItem(i, 'unit_price', parseFloat(e.target.value))} />
                        </div>
                        <div className="col-6 col-md-2">
                            <label className="small text-muted mb-0 fw-bold text-uppercase text-success">Sell Price (₹)</label>
                            <input type="number" className="form-control form-control-sm border-success fw-bold text-success" step="0.01" value={item.selling_price} onChange={e => updateItem(i, 'selling_price', parseFloat(e.target.value))} />
                        </div>
                        <div className="col-6 col-md-2">
                            <label className="small text-muted mb-0 fw-bold text-uppercase text-danger">Min Price (₹)</label>
                            <input type="number" className="form-control form-control-sm border-danger fw-bold text-danger" step="0.01" value={item.min_selling_price} onChange={e => updateItem(i, 'min_selling_price', parseFloat(e.target.value))} />
                        </div>
                        <div className="col-6 col-md-2">
                            <label className="small text-muted mb-0 fw-bold text-uppercase text-info">Max Price (₹)</label>
                            <input type="number" className="form-control form-control-sm border-info fw-bold text-info" step="0.01" value={item.max_selling_price} onChange={e => updateItem(i, 'max_selling_price', parseFloat(e.target.value))} />
                        </div>
                        <div className="col-6 col-md-3">
                            <div className="d-flex align-items-end h-100 pb-1">
                                <div className="bg-light p-2 rounded w-100">
                                    <div className="d-flex justify-content-between align-items-center">
                                        <span className="small text-muted fw-bold text-uppercase">Profit Margin</span>
                                        <span className={`fw-bold ${marginVal > 0 ? 'text-success' : 'text-danger'}`}>
                                            ₹{marginVal.toLocaleString('en-IN')} ({marginPer.toFixed(1)}%)
                                        </span>
                                    </div>
                                    <div className="progress mt-1" style={{height: '4px'}}>
                                        <div className={`progress-bar ${marginVal > 0 ? 'bg-success' : 'bg-danger'}`} style={{width: `${Math.min(100, Math.max(0, marginPer))}%`}}></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="col-12 col-md-4 ms-auto text-end">
                            <div className="pt-2">
                                <span className="small text-muted me-2 text-uppercase">Item Total:</span>
                                <span className="fw-bold fs-5 text-primary">₹{(parseFloat(item.quantity||0) * parseFloat(item.unit_price||0)).toLocaleString('en-IN')}</span>
                            </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="col-12 text-center mt-2">
                 <button type="button" className="btn btn-outline-primary btn-sm fw-bold text-uppercase shadow-sm px-4" onClick={() => setItems([...items, {product_id: '', is_new: false, new_product_name: '', category_id: 1, imei: '', ram: '', storage: '', color: '', quantity: 1, unit_price: 0, selling_price: 0, min_selling_price: 0, max_selling_price: 0}])}>
                    + Add More Items
                 </button>
              </div>
            </div>
          )}
        </div>

        {/* ─ Summary Section ─ */}
        <div className="row g-4 mb-5">
           <div className="col-12 col-lg-7">
              <div className="form-card shadow-sm border-0 bg-white rounded-3 p-4 h-100">
                <div className="mb-3">
                    <label className="form-label small fw-bold text-uppercase">Internal Notes / Reminders</label>
                    <textarea 
                        className="form-control text-uppercase" 
                        rows={3} 
                        placeholder="E.G. BILL NO, PAYMENT DUE DATE, ETC..."
                        value={form.notes} 
                        onChange={e => setForm({...form, notes: e.target.value.toUpperCase()})}
                    ></textarea>
                </div>
                <div className="row g-3 text-uppercase">
                    <div className="col-12 col-md-6">
                        <label className="form-label small fw-bold text-success text-uppercase">Initial Payment Paid (₹)</label>
                        <div className="input-group">
                            <span className="input-group-text bg-success text-white fw-bold">₹</span>
                            <input 
                                type="number" 
                                className="form-control fw-bold border-success text-success" 
                                placeholder="0.00"
                                value={form.total_paid === 0 ? '' : form.total_paid}
                                onFocus={e => e.target.select()}
                                onChange={e => setForm({...form, total_paid: parseFloat(e.target.value) || 0})}
                            />
                        </div>
                        <div className="form-text small text-muted mt-1">IF YOU PAID ANY AMOUNT TO SUPPLIER TODAY, RECORD IT HERE.</div>
                    </div>
                    <div className="col-12 col-md-6">
                        <div className="bg-light p-3 rounded-3 h-100 d-flex flex-column justify-content-center">
                            <div className="d-flex justify-content-between mb-1">
                                <span className="small text-muted fw-bold">PENDING BALANCE:</span>
                                <span className="fw-bold text-danger">₹{(grandTotal - (parseFloat(form.total_paid) || 0)).toLocaleString('en-IN')}</span>
                            </div>
                            <div className="progress" style={{height: '6px'}}>
                                <div className="progress-bar bg-danger" style={{width: `${Math.min(100, ((grandTotal - (parseFloat(form.total_paid) || 0)) / grandTotal) * 100)}%`}}></div>
                            </div>
                        </div>
                    </div>
                </div>
              </div>
           </div>
           <div className="col-12 col-lg-5">
              <div className="form-card shadow-sm border-0 bg-white rounded-3 p-4 h-100">
                <div className="d-flex justify-content-between align-items-center mb-2">
                    <span className="text-muted text-uppercase fw-bold">Subtotal:</span>
                    <span className="fw-bold">₹{total.toLocaleString('en-IN')}</span>
                </div>
                <div className="d-flex justify-content-between align-items-center mb-2 bg-light p-2 rounded">
                    <div className="form-check form-switch p-0 m-0 d-flex align-items-center gap-2">
                        <input className="form-check-input ms-0" type="checkbox" id="calcGst" 
                            checked={form.calculate_gst} onChange={e => setForm({...form, calculate_gst: e.target.checked})} />
                        <label className="form-check-label small fw-bold text-uppercase" htmlFor="calcGst">Calculate GST</label>
                    </div>
                    {!form.calculate_gst && <span className="badge bg-secondary text-uppercase">Disabled</span>}
                </div>
                <div className="d-flex justify-content-between align-items-center mb-2">
                    <div className="d-flex align-items-center gap-2">
                        <span className="text-muted text-uppercase fw-bold">CGST:</span>
                        <input type="number" className="form-control form-control-sm px-1 text-center" style={{width:'50px'}} value={form.cgst_rate} onChange={e => setForm({...form, cgst_rate: e.target.value})} disabled={!form.calculate_gst} />
                        <span className="text-muted">%</span>
                    </div>
                    <span className={`fw-semibold ${!form.calculate_gst ? 'text-muted text-decoration-line-through' : ''}`}>₹{cgstAmount.toLocaleString('en-IN')}</span>
                </div>
                <div className="d-flex justify-content-between align-items-center mb-2 border-bottom pb-2">
                    <div className="d-flex align-items-center gap-2">
                        <span className="text-muted text-uppercase fw-bold">SGST:</span>
                        <input type="number" className="form-control form-control-sm px-1 text-center" style={{width:'50px'}} value={form.sgst_rate} onChange={e => setForm({...form, sgst_rate: e.target.value})} disabled={!form.calculate_gst} />
                        <span className="text-muted">%</span>
                    </div>
                    <span className={`fw-semibold ${!form.calculate_gst ? 'text-muted text-decoration-line-through' : ''}`}>₹{sgstAmount.toLocaleString('en-IN')}</span>
                </div>
                <div className="d-flex justify-content-between align-items-center mb-2 border-bottom pb-2">
                    <div className="w-100">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                            <span className="text-muted text-uppercase fw-bold">Cash Discount:</span>
                            <div className="form-check form-switch p-0 m-0 d-flex align-items-center gap-2">
                                <label className="form-check-label small text-muted" htmlFor="onBill">On Bill?</label>
                                <input className="form-check-input ms-0" type="checkbox" id="onBill" 
                                    checked={form.is_cash_discount_on_bill} onChange={e => setForm({...form, is_cash_discount_on_bill: e.target.checked})} />
                            </div>
                        </div>
                        <div className="input-group input-group-sm">
                            <span className="input-group-text bg-info text-white border-info">₹</span>
                            <input type="number" className="form-control border-info text-end fw-bold text-info"
                                value={form.cash_discount === 0 ? '' : form.cash_discount}
                                onFocus={e => e.target.select()}
                                onChange={e => setForm({...form, cash_discount: parseFloat(e.target.value) || 0})} 
                            />
                        </div>
                        <div className="small text-muted mt-1" style={{fontSize:'0.65rem'}}>
                            {form.is_cash_discount_on_bill ? '✅ DEDUCTED FROM GRAND TOTAL' : 'ℹ️ RECORDED SEPARATELY IN ACCOUNTS'}
                        </div>
                    </div>
                </div>
                <div className="d-flex justify-content-between align-items-center mb-3">
                    <div className="d-flex align-items-center gap-2">
                        <span className="text-muted text-uppercase fw-bold">Round Off:</span>
                        <div className="btn-group btn-group-xs">
                            <button type="button" className={`btn btn-xs py-0 px-2 ${form.rounding_mode === 'down' ? 'btn-danger' : 'btn-outline-secondary'}`} onClick={() => setForm({...form, rounding_mode: 'down'})}>-</button>
                            <button type="button" className={`btn btn-xs py-0 px-2 ${form.rounding_mode === 'auto' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setForm({...form, rounding_mode: 'auto'})}>A</button>
                            <button type="button" className={`btn btn-xs py-0 px-2 ${form.rounding_mode === 'up' ? 'btn-success' : 'btn-outline-secondary'}`} onClick={() => setForm({...form, rounding_mode: 'up'})}>+</button>
                        </div>
                    </div>
                    <span className={`fw-bold ${parseFloat(roundOff) >= 0 ? 'text-success' : 'text-danger'}`}>{parseFloat(roundOff) >= 0 ? '+' : ''}{roundOff}</span>
                </div>
                <div className="d-flex justify-content-between align-items-center border-top pt-3 bg-light p-3 rounded-3 shadow-xs">
                    <h4 className="fw-bold mb-0 text-uppercase">Grand Total:</h4>
                    <h3 className="fw-bold text-primary mb-0">₹{grandTotal.toLocaleString('en-IN')}</h3>
                </div>
              </div>
           </div>
        </div>

        <div className="d-flex gap-2 mb-5">
          <button type="submit" className={`btn btn-lg fw-bold px-5 text-uppercase shadow ${form.status === 'received' ? 'btn-success' : 'btn-primary'}`}>
             {id ? `UPDATE ${form.bill_type.toUpperCase()} PURCHASE` : (form.status === 'received' ? `✅ Save & Add ${form.bill_type.toUpperCase()} Stock` : `📦 Save ${form.bill_type.toUpperCase()} Order`)}
          </button>
          <button type="button" className="btn btn-lg btn-outline-secondary text-uppercase fw-bold px-4" onClick={() => navigate('/purchases')}>Cancel</button>
        </div>
      </form>
      )}

      {/* Quick Add Supplier Modal */}
      <Modal show={showSupplierModal} onHide={() => setShowSupplierModal(false)} centered className="text-uppercase">
          <Modal.Header closeButton className="bg-primary text-white">
              <Modal.Title className="fw-bold small">🆕 QUICK ADD NEW SUPPLIER</Modal.Title>
          </Modal.Header>
          <form onSubmit={handleQuickSupplierAdd}>
              <Modal.Body className="p-4">
                  <div className="mb-3">
                      <label className="form-label small fw-bold">Supplier Name <span className="text-danger">*</span></label>
                      <input type="text" className="form-control text-uppercase" required 
                          value={newSupplier.name} onChange={e => setNewSupplier({...newSupplier, name: e.target.value.toUpperCase()})} />
                  </div>
                  <div className="mb-3">
                      <label className="form-label small fw-bold">Phone / Contact <span className="text-danger">*</span></label>
                      <input type="text" className="form-control" required 
                          value={newSupplier.phone} onChange={e => setNewSupplier({...newSupplier, phone: e.target.value})} />
                  </div>
                  <div className="mb-0">
                      <label className="form-label small fw-bold">Address / City <span className="text-danger">*</span></label>
                      <textarea className="form-control text-uppercase" rows={2} required 
                          value={newSupplier.address} onChange={e => setNewSupplier({...newSupplier, address: e.target.value.toUpperCase()})} />
                  </div>
              </Modal.Body>
              <Modal.Footer>
                  <Button variant="secondary" className="fw-bold" onClick={() => setShowSupplierModal(false)}>CANCEL</Button>
                  <Button type="submit" variant="primary" className="fw-bold px-4">SAVE SUPPLIER</Button>
              </Modal.Footer>
          </form>
      </Modal>

      <BarcodeScannerModal 
        show={scanner.show} 
        onHide={() => setScanner({ show: false, itemIndex: null })}
        onScanSuccess={(text) => {
          updateItem(scanner.itemIndex, 'imei', text);
          toast.success(`Scanned: ${text}`);
        }}
      />

      <BulkScanModal 
        show={showBulkScan} 
        onHide={() => setShowBulkScan(false)}
        products={products}
        categories={categories}
        onAddItems={handleAddBulkItems}
      />
    </div>
  );
}
