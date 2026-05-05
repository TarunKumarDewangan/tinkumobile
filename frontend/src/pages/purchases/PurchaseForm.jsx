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
  const [newSupplier, setNewSupplier] = useState({ name: '', phone: '', address: '', gst_no: '' });

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
          wholeseller_price: i.wholeseller_price || '',
          min_selling_price: i.min_selling_price || '',
          max_selling_price: i.max_selling_price || '',
          incentive_amount: i.incentive_amount || ''
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
      setNewSupplier({ name: '', phone: '', address: '', gst_no: '' });
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
        a[i].wholeseller_price = p.wholeseller_price || '';
        a[i].min_selling_price = p.min_selling_price || '';
        a[i].max_selling_price = p.max_selling_price || '';
        a[i].incentive_amount = p.incentive_amount || '';
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

  const S=`.pf-wrap{background:#f1f5f9;min-height:100vh;padding:16px 20px}.pf-hero{background:linear-gradient(135deg,#1a1a2e,#16213e,#0f3460);border-radius:14px;padding:16px 22px;display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}.pf-hero h2{color:#fff;font-size:1rem;font-weight:800;letter-spacing:.8px;margin:0}.pf-hero p{color:rgba(255,255,255,.45);font-size:.65rem;margin:1px 0 0}.pf-back{background:rgba(255,255,255,.12);border:1.5px solid rgba(255,255,255,.2);color:#fff;font-size:.7rem;font-weight:700;padding:6px 14px;border-radius:8px;cursor:pointer;transition:all .15s}.pf-back:hover{background:rgba(255,255,255,.22)}.pf-card{background:#fff;border-radius:12px;padding:14px 16px;margin-bottom:12px;box-shadow:0 2px 10px rgba(0,0,0,.06)}.pf-sec{font-size:.62rem;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#94a3b8;margin-bottom:10px;display:flex;align-items:center;gap:6px}.pf-lbl{font-size:.62rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:3px}.pf-inp{font-size:.78rem;border:1.5px solid #e2e8f0;border-radius:7px;padding:5px 9px;width:100%;background:#f8fafc;transition:border-color .15s;color:#334155}.pf-inp:focus{outline:none;border-color:#6366f1;background:#fff}.pf-item{background:#f8fafc;border-radius:10px;border:1.5px solid #e2e8f0;padding:12px 14px;margin-bottom:8px;position:relative}.pf-item:hover{border-color:#a5b4fc}.pf-imei{font-size:.72rem;border:1.5px solid #e2e8f0;border-radius:7px;padding:4px 8px;flex:1;background:#fff}.pf-price-lbl{font-size:.58rem;font-weight:700;letter-spacing:.5px;text-transform:uppercase;margin-bottom:2px;display:block}.pf-bulk{background:linear-gradient(135deg,#6366f1,#8b5cf6);border:none;color:#fff;font-weight:700;font-size:.72rem;padding:7px 16px;border-radius:9px;cursor:pointer;transition:opacity .15s}.pf-bulk:hover{opacity:.87}.pf-sum{background:linear-gradient(135deg,#1e293b,#0f172a);border-radius:12px;padding:16px}.pf-sum-row{display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.07);font-size:.78rem}.pf-sum-row:last-child{border-bottom:none}.pf-grand{font-size:1.3rem;font-weight:800;color:#818cf8}.pf-submit{background:linear-gradient(135deg,#6366f1,#8b5cf6);border:none;color:#fff;font-weight:700;font-size:.85rem;padding:10px 28px;border-radius:10px;cursor:pointer;transition:opacity .15s;letter-spacing:.5px}.pf-submit:hover{opacity:.88}.pf-submit.green{background:linear-gradient(135deg,#059669,#10b981)}`;

  return (
    <div className="pf-wrap">
      <style>{S}</style>
      
      <div className="pf-hero">
        <div>
          <h2>{id ? '✍️ Edit Purchase' : '🛒 New Purchase'}</h2>
          <p>Manage purchase record and supplier details</p>
        </div>
        <button type="button" className="pf-back" onClick={() => navigate('/purchases')}>← Back</button>
      </div>

      {loading ? (
        <div className="text-center py-5"><div className="spinner-border text-primary"/></div>
      ) : (
        <form onSubmit={handleSubmit}>
          {/* General Info */}
          <div className="pf-card">
            <div className="pf-sec">📋 General Information</div>
            <div className="row g-2">
              {isOwner() && (
                <div className="col-6 col-md-2">
                  <span className="pf-lbl">Shop / Branch *</span>
                  <select className="pf-inp" required value={form.shop_id} onChange={e=>setForm({...form,shop_id:e.target.value})}>
                    <option value="">— Select —</option>
                    {shops.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
              <div className="col-6 col-md-2">
                <span className="pf-lbl">Bill Type *</span>
                <select className="pf-inp" required value={form.bill_type} onChange={e=>setForm({...form,bill_type:e.target.value})}>
                  <option value="kaccha">Kaccha Bill</option>
                  <option value="pakka">Pakka Bill (GST)</option>
                </select>
              </div>
              <div className="col-6 col-md-3">
                <span className="pf-lbl" style={{display:'flex',justifyContent:'space-between'}}>
                  Supplier * <button type="button" onClick={()=>setShowSupplierModal(true)} style={{background:'none',border:'none',color:'#6366f1',fontWeight:700,fontSize:'.85rem',cursor:'pointer',padding:0}}>+ Add</button>
                </span>
                <select className="pf-inp" required value={form.supplier_id} onChange={e=>setForm({...form,supplier_id:e.target.value})}>
                  <option value="">— Select Supplier —</option>
                  {suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="col-6 col-md-2">
                <span className="pf-lbl">Purchase Date</span>
                <input type="date" className="pf-inp" value={form.purchase_date} onChange={e=>setForm({...form,purchase_date:e.target.value})}/>
              </div>
              <div className="col-6 col-md-2">
                <span className="pf-lbl">Status</span>
                <select className="pf-inp" value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>
                  <option value="ordered">📦 Ordered</option>
                  <option value="received">✅ Received</option>
                </select>
              </div>
              {form.status==='ordered' && (
                <div className="col-6 col-md-2">
                  <span className="pf-lbl" style={{color:'#6366f1'}}>Expected Delivery</span>
                  <input type="date" className="pf-inp" style={{borderColor:'#a5b4fc'}} value={form.expected_delivery_date} onChange={e=>setForm({...form,expected_delivery_date:e.target.value})}/>
                </div>
              )}
              {form.status==='received' && (
                <div className="col-6 col-md-2">
                  <span className="pf-lbl" style={{color:'#059669'}}>Received At</span>
                  <input type="date" className="pf-inp" style={{borderColor:'#6ee7b7'}} value={form.received_at} onChange={e=>setForm({...form,received_at:e.target.value})}/>
                </div>
              )}
            </div>
          </div>

          <div className="row g-3">
            <div className="col-12 col-lg-8">
              <div className="pf-card">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <div className="pf-sec mb-0">📦 Purchase Items ({items.length})</div>
                  <button type="button" className="pf-bulk" onClick={()=>setShowBulkScan(true)}>+ Bulk Add</button>
                </div>

                {items.length===0 ? (
                  <div style={{textAlign:'center',padding:'30px 0',color:'#94a3b8'}}>
                    <div style={{fontSize:'2.5rem',opacity:.3,marginBottom:8}}>🛒</div>
                    <div style={{fontWeight:700,fontSize:'.82rem',marginBottom:4}}>No items added yet</div>
                    <button type="button" style={{background:'#f1f5f9',border:'1.5px solid #e2e8f0',borderRadius:8,padding:'6px 16px',fontSize:'.75rem',fontWeight:700,cursor:'pointer',color:'#6366f1'}}
                      onClick={()=>setItems([{product_id:'',is_new:false,new_product_name:'',category_id:1,imei:'',ram:'',storage:'',color:'',quantity:1,unit_price:0,selling_price:0,wholeseller_price:0,min_selling_price:0,max_selling_price:0,incentive_amount:0}])}>
                      + Add Item
                    </button>
                  </div>
                ) : (
                  <>
                    {items.map((item,i)=>{
                      const marginVal=parseFloat(item.selling_price||0)-parseFloat(item.unit_price||0);
                      const marginPer=item.unit_price>0?(marginVal/item.unit_price)*100:0;
                      return (
                        <div key={i} className="pf-item">
                          <button type="button" onClick={()=>removeItem(i)} style={{position:'absolute',top:8,right:10,background:'none',border:'none',color:'#94a3b8',cursor:'pointer',fontSize:'.9rem',fontWeight:700,lineHeight:1}}>✕</button>
                          <div className="row g-2 mb-2">
                            <div className="col-12 col-md-3">
                              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:3}}>
                                <span className="pf-lbl" style={{marginBottom:0}}>Product</span>
                                <label style={{fontSize:'.6rem',color:'#94a3b8',cursor:'pointer',display:'flex',alignItems:'center',gap:4}}>
                                  New? <input type="checkbox" checked={item.is_new} onChange={e=>updateItem(i,'is_new',e.target.checked)} style={{accentColor:'#6366f1'}}/>
                                </label>
                              </div>
                              {item.is_new
                                ? <input type="text" className="pf-inp" placeholder="e.g. Vivo V70" required value={item.new_product_name} onChange={e=>updateItem(i,'new_product_name',e.target.value)}/>
                                : <select className="pf-inp" required value={item.product_id} onChange={e=>updateItem(i,'product_id',e.target.value)}>
                                    <option value="">— Choose Product —</option>
                                    {products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                                  </select>
                              }
                            </div>
                            <div className="col-12 col-md-4">
                              <span className="pf-lbl">IMEI / Serial</span>
                              <div style={{display:'flex',gap:4}}>
                                <input type="text" className="pf-imei" placeholder="Scan or type..." value={item.imei} onChange={e=>updateItem(i,'imei',e.target.value)}/>
                                <button type="button" onClick={()=>setScanner({show:true,itemIndex:i})} style={{background:'#6366f1',border:'none',color:'#fff',borderRadius:7,padding:'0 9px',cursor:'pointer',fontSize:'.8rem'}}>📷</button>
                              </div>
                            </div>
                            <div className="col-4 col-md-2">
                              <span className="pf-lbl">RAM</span>
                              <input type="text" className="pf-inp" placeholder="8GB" value={item.ram} onChange={e=>updateItem(i,'ram',e.target.value)}/>
                            </div>
                            <div className="col-4 col-md-2">
                              <span className="pf-lbl">Storage</span>
                              <input type="text" className="pf-inp" placeholder="128GB" value={item.storage} onChange={e=>updateItem(i,'storage',e.target.value)}/>
                            </div>
                            <div className="col-4 col-md-1">
                              <span className="pf-lbl">Color</span>
                              <input type="text" className="pf-inp" placeholder="Red" value={item.color} onChange={e=>updateItem(i,'color',e.target.value)}/>
                            </div>
                          </div>
                           <div className="row g-2 align-items-end">
                            <div className="col-4 col-md-1">
                              <span className="pf-price-lbl" style={{color:'#64748b'}}>Qty</span>
                              <input type="number" className="pf-inp" style={{textAlign:'center',fontWeight:700}} min="1" value={item.quantity} readOnly={!!item.imei} onChange={e=>updateItem(i,'quantity',parseInt(e.target.value))}/>
                            </div>
                            <div className="col-4 col-md-2">
                              <span className="pf-price-lbl">Rate (ex-GST) ₹</span>
                              <input type="number" className="pf-inp" style={{fontWeight:700}} step=".01" value={item.unit_price} onChange={e=>updateItem(i,'unit_price',parseFloat(e.target.value))}/>
                            </div>
                            <div className="col-4 col-md-2">
                              <span className="pf-price-lbl" style={{color:'#059669'}}>MOP ₹</span>
                              <input type="number" className="pf-inp" style={{borderColor:'#6ee7b7',color:'#059669',fontWeight:700}} step=".01" value={item.selling_price} onChange={e=>updateItem(i,'selling_price',parseFloat(e.target.value))}/>
                            </div>
                            <div className="col-4 col-md-2">
                              <span className="pf-price-lbl" style={{color:'#6366f1'}}>WHOLE ₹</span>
                              <input type="number" className="pf-inp" style={{borderColor:'#a5b4fc',color:'#6366f1'}} step=".01" value={item.wholeseller_price} onChange={e=>updateItem(i,'wholeseller_price',parseFloat(e.target.value))}/>
                            </div>
                            <div className="col-4 col-md-2">
                              <span className="pf-price-lbl" style={{color:'#dc2626'}}>MIN ₹</span>
                              <input type="number" className="pf-inp" style={{borderColor:'#fca5a5',color:'#dc2626'}} step=".01" value={item.min_selling_price} onChange={e=>updateItem(i,'min_selling_price',parseFloat(e.target.value))}/>
                            </div>
                            <div className="col-4 col-md-2">
                              <span className="pf-price-lbl" style={{color:'#6366f1'}}>COM ₹</span>
                              <input type="number" className="pf-inp" style={{borderColor:'#a5b4fc',color:'#6366f1'}} step=".01" value={item.incentive_amount} onChange={e=>updateItem(i,'incentive_amount',parseFloat(e.target.value))}/>
                            </div>
                            <div className="col-12 col-md-1">
                              <div style={{background:'#f1f5f9',borderRadius:8,padding:'5px 5px',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:42}}>
                                <span style={{fontSize:'.45rem',fontWeight:700,color:'#94a3b8',textTransform:'uppercase'}}>Margin</span>
                                <span style={{fontWeight:700,color:marginVal>=0?'#059669':'#dc2626',fontSize:'.6rem'}}>₹{marginVal.toLocaleString('en-IN')}</span>
                              </div>
                              <div style={{background:'#e2e8f0',height:3,borderRadius:4,marginTop:3}}>
                                <div style={{background:marginVal>=0?'#059669':'#dc2626',width:`${Math.min(100,Math.max(0,marginPer))}%`,height:'100%',borderRadius:4}}/>
                              </div>
                            </div>
                          </div>
                          <div style={{textAlign:'right',marginTop:4,fontSize:'.75rem',color:'#64748b'}}>
                            Item Total: <span style={{fontWeight:700,color:'#6366f1',fontSize:'.88rem'}}>₹{(parseFloat(item.quantity||0)*parseFloat(item.unit_price||0)).toLocaleString('en-IN')}</span>
                          </div>
                        </div>
                      );
                    })}
                    <div style={{textAlign:'center',marginTop:4}}>
                      <button type="button" className="pf-bulk" style={{background:'#f1f5f9',color:'#6366f1',border:'1.5px dashed #a5b4fc'}}
                        onClick={()=>setItems([...items,{product_id:'',is_new:false,new_product_name:'',category_id:1,imei:'',ram:'',storage:'',color:'',quantity:1,unit_price:0,selling_price:0,wholeseller_price:0,min_selling_price:0,max_selling_price:0,incentive_amount:0}])}>
                        + Add More Items
                      </button>
                    </div>
                  </>
                )}
              </div>

              <div className="pf-card">
                <div className="row g-2">
                  <div className="col-12 col-md-6">
                    <span className="pf-lbl">Internal Notes / Reminders</span>
                    <textarea className="pf-inp" rows={2} placeholder="e.g. Bill No, Payment Due Date..." value={form.notes} onChange={e=>setForm({...form,notes:e.target.value.toUpperCase()})}/>
                  </div>
                  <div className="col-12 col-md-3">
                    <span className="pf-lbl" style={{color:'#059669'}}>Initial Payment Paid (₹)</span>
                    <div style={{display:'flex',gap:0}}>
                      <span style={{background:'#059669',color:'#fff',fontWeight:700,padding:'5px 10px',borderRadius:'7px 0 0 7px',fontSize:'.82rem'}}>₹</span>
                      <input type="number" className="pf-inp" style={{borderRadius:'0 7px 7px 0',borderLeft:'none',color:'#059669',fontWeight:700,borderColor:'#6ee7b7'}}
                        placeholder="0.00" value={form.total_paid===0?'':form.total_paid} onFocus={e=>e.target.select()} onChange={e=>setForm({...form,total_paid:parseFloat(e.target.value)||0})}/>
                    </div>
                  </div>
                  <div className="col-12 col-md-3">
                    <span className="pf-lbl" style={{color:'#dc2626'}}>Pending Balance</span>
                    <div style={{background:'#fef2f2',border:'1.5px solid #fca5a5',borderRadius:8,padding:'8px 12px'}}>
                      <div style={{fontWeight:800,fontSize:'1rem',color:'#dc2626'}}>₹{(grandTotal-(parseFloat(form.total_paid)||0)).toLocaleString('en-IN')}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-12 col-lg-4">
              <div className="pf-sum" style={{position:'sticky',top:16}}>
                <div style={{color:'rgba(255,255,255,.5)',fontSize:'.62rem',fontWeight:700,letterSpacing:1,textTransform:'uppercase',marginBottom:12}}>Order Summary</div>
                <div className="pf-sum-row"><span style={{color:'rgba(255,255,255,.6)'}}>Subtotal</span><span style={{color:'#fff',fontWeight:600}}>₹{total.toLocaleString('en-IN')}</span></div>
                <div className="pf-sum-row">
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <input type="checkbox" id="calcGst" checked={form.calculate_gst} onChange={e=>setForm({...form,calculate_gst:e.target.checked})} style={{accentColor:'#818cf8'}}/>
                    <label htmlFor="calcGst" style={{color:'rgba(255,255,255,.6)',fontSize:'.75rem',cursor:'pointer',margin:0}}>GST</label>
                  </div>
                </div>
                {form.calculate_gst && <>
                  <div className="pf-sum-row">
                    <div style={{display:'flex',alignItems:'center',gap:6,color:'rgba(255,255,255,.55)'}}>
                      CGST <input type="number" value={form.cgst_rate} onChange={e=>setForm({...form,cgst_rate:e.target.value})} style={{width:40,background:'rgba(255,255,255,.1)',border:'1px solid rgba(255,255,255,.2)',borderRadius:5,color:'#fff',textAlign:'center',fontSize:'.72rem',padding:'2px 4px'}}/> %
                    </div>
                    <span style={{color:'#a5b4fc',fontWeight:600}}>₹{cgstAmount.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="pf-sum-row">
                    <div style={{display:'flex',alignItems:'center',gap:6,color:'rgba(255,255,255,.55)'}}>
                      SGST <input type="number" value={form.sgst_rate} onChange={e=>setForm({...form,sgst_rate:e.target.value})} style={{width:40,background:'rgba(255,255,255,.1)',border:'1px solid rgba(255,255,255,.2)',borderRadius:5,color:'#fff',textAlign:'center',fontSize:'.72rem',padding:'2px 4px'}}/> %
                    </div>
                    <span style={{color:'#a5b4fc',fontWeight:600}}>₹{sgstAmount.toLocaleString('en-IN')}</span>
                  </div>
                </>}
                <div className="pf-sum-row">
                  <div>
                    <div style={{color:'rgba(255,255,255,.6)',fontSize:'.75rem',marginBottom:4}}>Cash Discount
                      <label style={{marginLeft:8,fontSize:'.6rem',color:'rgba(255,255,255,.4)',cursor:'pointer'}}>
                        <input type="checkbox" checked={form.is_cash_discount_on_bill} onChange={e=>setForm({...form,is_cash_discount_on_bill:e.target.checked})} style={{marginRight:4,accentColor:'#818cf8'}}/>On Bill
                      </label>
                    </div>
                    <input type="number" value={form.cash_discount===0?'':form.cash_discount} onFocus={e=>e.target.select()} onChange={e=>setForm({...form,cash_discount:parseFloat(e.target.value)||0})}
                      style={{width:'100%',background:'rgba(255,255,255,.08)',border:'1px solid rgba(255,255,255,.15)',borderRadius:7,color:'#38bdf8',fontWeight:700,padding:'4px 8px',fontSize:'.82rem'}} placeholder="0"/>
                  </div>
                </div>
                <div className="pf-sum-row">
                  <div style={{display:'flex',alignItems:'center',gap:6,color:'rgba(255,255,255,.55)'}}>
                    Round Off
                    <div style={{display:'flex',gap:2}}>
                      {['down','auto','up'].map(m=>(
                        <button key={m} type="button" onClick={()=>setForm({...form,rounding_mode:m})}
                          style={{background:form.rounding_mode===m?'#6366f1':'rgba(255,255,255,.1)',border:'none',color:'#fff',borderRadius:4,padding:'1px 7px',fontSize:'.65rem',cursor:'pointer',fontWeight:700}}>
                          {m==='down'?'-':m==='up'?'+':'A'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <span style={{color:parseFloat(roundOff)>=0?'#4ade80':'#f87171',fontWeight:600}}>{parseFloat(roundOff)>=0?'+':''}{roundOff}</span>
                </div>
                <div style={{borderTop:'1px solid rgba(255,255,255,.15)',marginTop:8,paddingTop:12,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{color:'rgba(255,255,255,.7)',fontWeight:700,textTransform:'uppercase',fontSize:'.75rem'}}>Grand Total</span>
                  <span className="pf-grand">₹{grandTotal.toLocaleString('en-IN')}</span>
                </div>
                <div style={{marginTop:14,display:'flex',flexDirection:'column',gap:8}}>
                  <button type="submit" className={`pf-submit${form.status==='received'?' green':''}`} style={{width:'100%'}}>
                    {id?`Update ${form.bill_type} Purchase`:(form.status==='received'?`✅ Save & Add Stock`:`📦 Save Order`)}
                  </button>
                  <button type="button" onClick={()=>navigate('/purchases')} style={{width:'100%',background:'rgba(255,255,255,.08)',border:'1.5px solid rgba(255,255,255,.15)',color:'rgba(255,255,255,.7)',fontWeight:700,fontSize:'.8rem',padding:'8px',borderRadius:10,cursor:'pointer'}}>Cancel</button>
                </div>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* Modals */}
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
            <div className="mb-3">
              <label className="form-label small fw-bold">GST Number (Optional)</label>
              <input type="text" className="form-control text-uppercase" placeholder="e.g. 22AAAAA0000A1Z5"
                value={newSupplier.gst_no} onChange={e => setNewSupplier({...newSupplier, gst_no: e.target.value.toUpperCase()})} />
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
