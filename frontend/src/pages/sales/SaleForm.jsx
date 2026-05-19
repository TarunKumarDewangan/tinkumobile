import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Modal, Button } from 'react-bootstrap';
import debounce from 'lodash/debounce';
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
  const [staff, setStaff]       = useState([]);
  
  const [form, setForm] = useState({ 
    shop_id: '',
    customer_id: '', 
    sold_by_id: '',
    sale_date: new Date().toISOString().slice(0,10), 
    bill_type: 'pakka', 
    payment_method: 'CASH',
    other_mode: '',
    discount: 0,
    total_paid: 0,
    cgst_rate: 9,
    sgst_rate: 9,
    calculate_gst: true,
    cash_discount: 0,
    is_cash_discount_on_bill: true,
    rounding_mode: 'auto',
    round_off: 0,
    cgst_amount: 0,
    sgst_amount: 0,
    is_gst_manual: false,
    notes: '',
  });
  const [items, setItems] = useState([]);
  
  // Internal state to track if round_off is manually overridden
  const [isManualRound, setIsManualRound] = useState(false);
  const [isManualGst, setIsManualGst] = useState(false);

  // Customer Search & Add
  const [customerInputText, setCustomerInputText] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const debouncedCustomerSearch = useMemo(
    () => debounce((val) => setCustomerSearch(val), 350),
    []
  );
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [priceMode, setPriceMode] = useState('RETAIL');
  const [showCustModal, setShowCustModal] = useState(false);
  const [newCust, setNewCust] = useState({ name: '', phone: '', email: '', gst_no: '', address: '', voucher_code: '', category: 'REGULAR', events: [] });
  // IMEI Scan Search
  const [scanProductId, setScanProductId] = useState('');
  const [imeiScanner, setImeiScanner] = useState('');
  const [scanResult, setScanResult] = useState(null);
  const [productSearch, setProductSearch] = useState('');
  const [showProductList, setShowProductList] = useState(false);
  const imeiInputRef = useRef(null);
  const productSearchRef = useRef(null);

  useEffect(() => {
    fetchInitialData();
    if (id) loadSale();
    
    const clickOutside = (e) => {
      if (productSearchRef.current && !productSearchRef.current.contains(e.target)) {
        setShowProductList(false);
      }
    };
    document.addEventListener('mousedown', clickOutside);
    return () => document.removeEventListener('mousedown', clickOutside);
  }, [id]);

  const fetchInitialData = async () => {
    try {
      const custRes = await api.get('/customers');
      setCustomers(custRes.data);
      
      const staffRes = await api.get('/users');
      setStaff(staffRes.data);
      
      if (isOwner()) {
        const shopsRes = await api.get('/shops');
        setShops(shopsRes.data);
        if (!id && shopsRes.data.length > 0) {
            setForm(prev => ({ ...prev, shop_id: shopsRes.data[0].id }));
            loadProducts(shopsRes.data[0].id);
        }
      } else {
        setForm(prev => ({ ...prev, shop_id: user.shop_id }));
        loadProducts(user.shop_id);
      }
    } catch (e) { toast.error('Error loading data'); }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const imei = params.get('imei');
    if (imei && products.length > 0) {
      handleImeiPreFill(imei);
    }
  }, [products]);

  const handleImeiPreFill = async (imei) => {
    try {
      const { data } = await api.get(`/products?imei=${imei}&group_by_config=false`);
      if (data && data.length > 0) {
        const p = data[0];
        setItems([{
          selection_id: p.id,
          product_id: p.product_id || p.id,
          imei: p.attributes?.imei || imei,
          ram: p.attributes?.ram || '',
          storage: p.attributes?.storage || '',
          color: p.attributes?.color || '',
          quantity: 1,
          unit_price: p.selling_price,
          base_price: p.purchase_price || 0,
          min_selling_price: p.min_selling_price || 0,
          max_selling_price: p.max_selling_price || 0
        }]);
      }
    } catch (e) {}
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
        other_mode: data.other_mode || '',
        discount: data.discount,
        total_paid: data.total_paid,
        cgst_rate: data.cgst_rate || 9,
        sgst_rate: data.sgst_rate || 9,
        calculate_gst: data.calculate_gst ?? true,
        cash_discount: data.cash_discount || 0,
        is_cash_discount_on_bill: data.is_cash_discount_on_bill ?? true,
        rounding_mode: data.rounding_mode,
        round_off: data.round_off || 0,
        cgst_amount: data.cgst_amount || 0,
        sgst_amount: data.sgst_amount || 0,
        is_gst_manual: data.is_gst_manual ?? false,
        notes: data.notes || '',
        sold_by_id: data.sold_by_id || ''
      });
      if (data.rounding_mode === 'manual') setIsManualRound(true);
      if (data.is_gst_manual) setIsManualGst(true);
      setItems(data.items?.map(i => ({
        selection_id: i.product_id,
        product_id: i.product_id,
        imei: i.imei || '',
        ram: i.ram || '',
        storage: i.storage || '',
        color: i.color || '',
        quantity: i.quantity,
        unit_price: i.unit_price,
        base_price: i.product?.purchase_price || 0,
        min_selling_price: i.product?.min_selling_price || 0,
        max_selling_price: i.product?.max_selling_price || 0
      })));
      setCustomerSearch(data.customer?.name || '');
      setCustomerInputText(data.customer?.name || '');
      setSelectedCustomer(data.customer || null);
      if (data.customer?.category === 'SHOP') setPriceMode('WHOLESALE');
      loadProducts(data.shop_id);
    } catch (e) { toast.error('Error loading sale'); }
    finally { setLoading(false); }
  };

  const loadProducts = async (shopId) => {
    if (!shopId) return;
    try {
      // Fetch expanded items for the SCAN dropdown to show configs/IMEIs
      const { data } = await api.get('/products', { params: { shop_id: shopId, group_by_config: 'false' } });
      setProducts(data);
    } catch (e) { toast.error('Error loading products'); }
  };

  const fetchScannedProduct = async (val, shopId, prodId) => {
    try {
      const params = { imei: val, group_by_config: 'false', shop_id: shopId };
      if (prodId) params.product_id = prodId;
      
      const { data } = await api.get('/products', { params });
      if (data && data.length > 0) {
          setScanResult(data[0]);
      } else { setScanResult(null); }
    } catch (e) { setScanResult(null); }
  };

  const debouncedImeiSearch = useMemo(
    () => debounce((val, shopId, prodId) => fetchScannedProduct(val, shopId, prodId), 400),
    []
  );

  const handleImeiScan = async (val) => {
    setImeiScanner(val);
    if (val.length >= 4) { // Faster search threshold
        debouncedImeiSearch(val, form.shop_id, scanProductId);
    } else { 
        debouncedImeiSearch.cancel();
        setScanResult(null); 
    }
  };

  const addScannedItem = (existing = null) => {
    const p = existing || scanResult;
    if (!p) return;
    const newItem = {
        selection_id: p.id,
        product_id: p.product_id,
        imei: p.attributes?.imei || '',
        ram: p.attributes?.ram || '',
        storage: p.attributes?.storage || '',
        color: p.attributes?.color || '',
        quantity: 1,
        unit_price: (priceMode === 'WHOLESALE' && p.wholeseller_price > 0) ? p.wholeseller_price : (p.selling_price || 0),
        base_price: p.purchase_price || 0,
        min_selling_price: p.min_selling_price || 0,
        max_selling_price: p.max_selling_price || 0
    };
    
    // Always append to list
    if (!items.find(it => it.imei && it.imei === newItem.imei)) {
       setItems([...items, newItem]);
    } else {
        toast.info(newItem.imei ? 'IMEI already in list' : 'Item already in list');
    }
    setImeiScanner('');
    setScanResult(null);
    toast.success('✅ Item added');
  };

  const handleScanAction = async () => {
    if (scanResult) {
        addScannedItem();
    } else if (imeiScanner.length >= 4) {
        // Immediate search if Enter pressed before auto-search finished
        try {
            const params = { imei: imeiScanner, group_by_config: 'false', shop_id: form.shop_id };
            if (scanProductId) params.product_id = scanProductId;
            const { data } = await api.get('/products', { params });
            if (data && data.length > 0) {
                addScannedItem(data[0]);
            } else {
                toast.error('No item found with this IMEI');
            }
        } catch (e) {}
    }
  };

  const addItem = () => setItems([...items, { selection_id: '', product_id: '', imei: '', ram: '', storage: '', color: '', quantity: 1, unit_price: '', base_price: 0, min_selling_price: 0, max_selling_price: 0 }]);
  const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i));
  
  const updateItem = (i, field, val) => {
    const arr = [...items];
    arr[i][field] = val;
    
    // If it's the product selection field (can be ID or Name from datalist)
    if (field === 'product_id' || field === 'selection_id') {
      // Find product by ID or by generated Name string
      const p = products.find(p => 
        p.id == val || 
        (p.name + " (" + (p.attributes?.ram || '') + "/" + (p.attributes?.storage || '') + "/" + (p.attributes?.color || '') + ") / IMEI: " + (p.attributes?.imei || '')).toUpperCase() === val.toUpperCase()
      );

      if (p) {
          arr[i].selection_id = p.id;
          arr[i].product_id = p.product_id || p.id;
          arr[i].unit_price = (priceMode === 'WHOLESALE' && p.wholeseller_price > 0) ? p.wholeseller_price : (p.selling_price || 0);
          arr[i].base_price = p.purchase_price || 0;
          arr[i].min_selling_price = p.min_selling_price || 0,
          arr[i].max_selling_price = p.max_selling_price || 0;
          if (p.attributes) {
              arr[i].ram = p.attributes.ram || '';
              arr[i].storage = p.attributes.storage || '';
              arr[i].color = p.attributes.color || '';
              arr[i].imei = p.attributes.imei || '';
          }
      }
    }
    setItems(arr);
  };

  // Calculations
  const totalInclusive = items.reduce((s, i) => s + (i.quantity * i.unit_price || 0), 0);
  let subtotal = totalInclusive;
  let autoCgstAmount = 0;
  let autoSgstAmount = 0;

  if (form.calculate_gst) {
      const cgstR = parseFloat(form.cgst_rate) || 0;
      const sgstR = parseFloat(form.sgst_rate) || 0;
      const totalGstRate = cgstR + sgstR;
      
      const calcSubtotal = totalInclusive / (1 + (totalGstRate / 100));
      const totalGstAmount = totalInclusive - calcSubtotal;
      
      if (totalGstRate > 0) {
         // Round taxes to 2 decimals
         autoCgstAmount = Math.round(totalGstAmount * (cgstR / totalGstRate) * 100) / 100;
         autoSgstAmount = Math.round(totalGstAmount * (sgstR / totalGstRate) * 100) / 100;
      }
  }

  const cgstAmount = isManualGst ? (parseFloat(form.cgst_amount) || 0) : autoCgstAmount;
  const sgstAmount = isManualGst ? (parseFloat(form.sgst_amount) || 0) : autoSgstAmount;
  subtotal = Math.round((totalInclusive - cgstAmount - sgstAmount) * 100) / 100;

  const rawTotal = subtotal + cgstAmount + sgstAmount - (parseFloat(form.discount) || 0) - (form.is_cash_discount_on_bill ? (parseFloat(form.cash_discount) || 0) : 0);
  
  // Rounding Logic
  useEffect(() => {
    if (!isManualRound) {
        let roundedValue = Math.round(rawTotal);
        if (form.rounding_mode === 'up') roundedValue = Math.ceil(rawTotal);
        else if (form.rounding_mode === 'down') roundedValue = Math.floor(rawTotal);
        
        const diff = roundedValue - rawTotal;
        setForm(f => ({ ...f, round_off: parseFloat(diff.toFixed(2)) }));
    }
  }, [rawTotal, form.rounding_mode, isManualRound]);

  const grandTotal = rawTotal + (parseFloat(form.round_off) || 0);

  const totalCost = items.reduce((s, i) => s + (i.quantity * i.base_price || 0), 0);
  const totalProfit = grandTotal - totalCost;
  const profitColor = totalProfit > 0 ? 'text-success' : 'text-danger';

  const handleRoundClick = (type) => {
    setForm(prev => ({ ...prev, rounding_mode: type }));
    setIsManualRound(false);
  };

  // Customer Handling
  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) || 
    c.phone.includes(customerSearch)
  );

  const handleSelectCustomer = (c) => {
    setForm({ ...form, customer_id: c.id });
    setCustomerSearch(c.name);
    setCustomerInputText(c.name);
    setSelectedCustomer(c);
    setPriceMode(c.category === 'SHOP' ? 'WHOLESALE' : 'RETAIL');
  };

  const handlePriceModeToggle = (mode) => {
      setPriceMode(mode);
      setItems(prevItems => prevItems.map(it => {
          if (!it.selection_id) return it;
          const p = products.find(px => px.id == it.selection_id);
          if (!p) return it;
          const newPrice = (mode === 'WHOLESALE' && p.wholeseller_price > 0) ? p.wholeseller_price : (p.selling_price || 0);
          return { ...it, unit_price: newPrice };
      }));
      toast.info(`🏷️ Switched to ${mode} pricing mode`);
  };

  const handleAddCustomer = async (e) => {
      e.preventDefault();
      try {
          const { data } = await api.post('/customers', newCust);
          setCustomers([...customers, data]);
          handleSelectCustomer(data);
          setShowCustModal(false);
          setNewCust({ name: '', phone: '', email: '', gst_no: '', address: '', voucher_code: '', events: [] });
          toast.success('✅ Customer added');
      } catch (e) { toast.error(e.response?.data?.message || 'Error adding customer'); }
  };

  const addCustEvent = () => setNewCust({ ...newCust, events: [...newCust.events, { type: 'DOB', name: '', date: '' }] });
  const removeCustEvent = (i) => setNewCust({ ...newCust, events: newCust.events.filter((_, idx) => idx !== i) });
  const updateCustEvent = (i, field, val) => {
    const evs = [...newCust.events];
    evs[i][field] = val;
    setNewCust({ ...newCust, events: evs });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.customer_id) return toast.warning('Please select a customer');
    
    setLoading(true);
    try {
      let finalForm = {
        ...form,
        cgst_amount: cgstAmount,
        sgst_amount: sgstAmount,
        round_off: parseFloat(form.round_off) || 0,
        is_gst_manual: isManualGst,
        items
      };
      if (form.payment_method === 'OTHER' && form.other_mode) {
          finalForm.payment_method = form.other_mode;
      }
      
      if (id) {
        await api.put(`/sale-invoices/${id}`, finalForm);
        toast.success('✅ Sale updated successfully');
      } else {
        await api.post('/sale-invoices', finalForm);
        toast.success('✅ Sale recorded successfully');
      }
      navigate('/sales');
    } catch (e) { 
        toast.error(e.response?.data?.message || 'Error saving sale'); 
    } finally {
        setLoading(false);
    }
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

                        <div className="col-12">
                            <label className="form-label small fw-bold text-success">SOLD BY / DEALER PERSON <span className="text-danger">*</span></label>
                            <select className="form-select border-success fw-bold" required value={form.sold_by_id} onChange={e => setForm({...form, sold_by_id: e.target.value})}>
                                <option value="">— SELECT STAFF —</option>
                                {staff.filter(s => {
                                    if (form.shop_id && s.shop_id != form.shop_id) return false;
                                    const roles = s.roles?.map(r => typeof r === 'object' ? r.name : r) || [];
                                    return !roles.some(r => r.toLowerCase() === 'admin');
                                }).map(s => (
                                    <option key={s.id} value={s.id}>{s.name.toUpperCase()} ({s.roles?.[0]?.name?.toUpperCase() || 'STAFF'})</option>
                                ))}
                            </select>
                        </div>
                        <div className="col-12 text-uppercase">
                            <label className="form-label small fw-bold">CUSTOMER DETAILS <span className="text-danger">*</span></label>
                            <div className="input-group">
                                <span className="input-group-text bg-white border-end-0"><i className="bi bi-search"></i></span>
                                <input 
                                    type="text" 
                                    className="form-control border-start-0 text-uppercase" 
                                    placeholder="TYPE NAME OR PHONE TO SEARCH..." 
                                    value={customerInputText}
                                    onChange={e => { 
                                        setCustomerInputText(e.target.value); 
                                        debouncedCustomerSearch(e.target.value); 
                                        setForm({...form, customer_id: ''}); 
                                    }}
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

                        {/* Price Mode Toggle Block */}
                        <div className="col-12 mt-3 pt-3 border-top">
                            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 bg-light p-3 rounded-3 border">
                                <div>
                                    <label className="form-label small fw-bold text-dark mb-0 d-block">🏷️ APPLIED PRICING MODE</label>
                                    <span className="x-small text-muted">Toggling automatically updates the item prices below</span>
                                </div>
                                <div className="btn-group shadow-sm" role="group">
                                    <button 
                                        type="button" 
                                        className={`btn btn-sm fw-bold px-3 ${priceMode === 'RETAIL' ? 'btn-primary' : 'btn-outline-secondary bg-white'}`}
                                        onClick={() => handlePriceModeToggle('RETAIL')}
                                    >
                                        RETAIL RATE
                                    </button>
                                    <button 
                                        type="button" 
                                        className={`btn btn-sm fw-bold px-3 ${priceMode === 'WHOLESALE' ? 'btn-warning text-dark' : 'btn-outline-secondary bg-white'}`}
                                        onClick={() => handlePriceModeToggle('WHOLESALE')}
                                    >
                                        WHOLESALE RATE
                                    </button>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
             </div>

             <div className="card shadow-sm border-0 bg-white rounded-3 mb-3">
                <div className="card-header bg-white border-0 py-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
                    <h5 className="mb-0 fw-bold text-uppercase">🛒 Items for Sale</h5>
                    <div className="d-flex flex-column align-items-end flex-grow-1">
                        <div className="d-flex gap-2 align-items-center">
                            <div className="d-flex flex-column align-items-end">
                                {scanResult && (
                                    <div className="text-info x-small fw-bold border border-info rounded px-2 py-1 bg-info bg-opacity-10 mb-1 animate-fade-in shadow-sm">
                                        <i className="bi bi-check-circle-fill me-1"></i>
                                        {scanResult.name} ({scanResult.attributes?.ram || '-'}/{scanResult.attributes?.storage || '-'}/{scanResult.attributes?.color || '-'}) | IMEI: {scanResult.attributes?.imei}
                                    </div>
                                )}
                                <div className="input-group input-group-sm" style={{ width: '500px' }}>
                                    <div className="position-relative flex-grow-1" style={{ width: '40%' }} ref={productSearchRef}>
                                        <input 
                                            type="text"
                                            className="form-control border-info fw-bold bg-info bg-opacity-10 text-uppercase h-100" 
                                            placeholder="🔍 SEARCH ITEM..." 
                                            value={productSearch}
                                            onChange={e => { setProductSearch(e.target.value); setShowProductList(true); }}
                                            onFocus={() => setShowProductList(true)}
                                        />
                                        {showProductList && (
                                            <div className="list-group shadow-sm mt-1 position-absolute w-100 z-3 border animate-fade-in" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                                {products
                                                    .filter(p => !productSearch || p.name.toUpperCase().includes(productSearch.toUpperCase()) || (p.attributes?.imei && p.attributes.imei.includes(productSearch.toUpperCase())))
                                                    .slice(0, 20)
                                                    .map(p => {
                                                        const configStr = (p.attributes?.ram || p.attributes?.storage || p.attributes?.color) 
                                                            ? `(${p.attributes.ram || '-'}/${p.attributes.storage || '-'}/${p.attributes.color || '-'})`
                                                            : '';
                                                        const imeiSuffix = p.attributes?.imei ? ` / IMEI: ${p.attributes.imei}` : '';
                                                        return (
                                                            <button key={p.id} type="button" className="list-group-item list-group-item-action py-2 text-uppercase small" 
                                                                onClick={() => {
                                                                    addScannedItem(p);
                                                                    setProductSearch('');
                                                                    setShowProductList(false);
                                                                }}>
                                                                <div className="fw-bold">{p.name.toUpperCase()} {configStr}</div>
                                                                <div className="x-small text-muted">{imeiSuffix} | 💰 ₹{p.selling_price}</div>
                                                            </button>
                                                        );
                                                    })}
                                                {products.length === 0 && <div className="list-group-item disabled x-small py-3">NO PRODUCTS FOUND</div>}
                                            </div>
                                        )}
                                    </div>
                                    <span 
                                        className="input-group-text bg-info border-info text-white border-start-0 cursor-pointer" 
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => imeiInputRef.current?.focus()}
                                        title="Click to Scan"
                                    >
                                        <i className="bi bi-upc-scan"></i>
                                    </span>
                                    <input 
                                        ref={imeiInputRef}
                                        type="text" 
                                        className="form-control border-info fw-bold" 
                                        placeholder="SCAN IMEI..." 
                                        value={imeiScanner}
                                        autoFocus
                                        onChange={e => handleImeiScan(e.target.value.toUpperCase())}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleScanAction();
                                            }
                                        }}
                                    />
                                    {(scanResult || imeiScanner.length >= 4) && <button type="button" className="btn btn-info text-white fw-bold px-3" onClick={handleScanAction}>+ ADD</button>}
                                </div>
                            </div>
                            <button type="button" className="btn btn-sm btn-primary rounded-pill px-3 fw-bold" onClick={addItem}>+ MANUAL</button>
                        </div>
                    </div>
                </div>
                <div className="table-responsive">
                    <table className="table table-hover mb-0 align-middle">
                        <thead className="bg-light text-uppercase x-small fw-bold">
                            <tr>
                                <th className="ps-4">Product & Configuration</th>
                                <th style={{ width: '80px' }} className="text-center">QTY</th>
                                <th style={{ width: '150px' }} className="text-end">RATE (INCL)</th>
                                <th style={{ width: '120px' }} className="text-end">RATE (EXCL)</th>
                                <th style={{ width: '80px' }} className="text-center">GST %</th>
                                <th style={{ width: '150px' }} className="text-end">TOTAL (EXCL)</th>
                                <th style={{ width: '150px' }} className="text-end">NET TOTAL</th>
                                <th style={{ width: '50px' }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, i) => {
                                const pProfit = (item.unit_price - item.base_price) * item.quantity;
                                const gstRate = form.calculate_gst ? (parseFloat(form.cgst_rate || 0) + parseFloat(form.sgst_rate || 0)) : 0;
                                const rateExcl = item.unit_price / (1 + (gstRate / 100));
                                const totalExcl = rateExcl * item.quantity;
                                const netTotal = item.unit_price * item.quantity;
                                return (
                                    <tr key={i}>
                                        <td className="ps-4 py-3">
                                            <input 
                                                list={`productOptions-${i}`}
                                                className="form-control form-control-sm text-uppercase fw-bold mb-1 shadow-sm border-primary" 
                                                placeholder="🔍 TYPE PRODUCT NAME OR IMEI..."
                                                required 
                                                value={products.find(px => px.id == item.selection_id)?.name ? (products.find(px => px.id == item.selection_id).name + " (" + (products.find(px => px.id == item.selection_id).attributes?.ram || '') + "/" + (products.find(px => px.id == item.selection_id).attributes?.storage || '') + "/" + (products.find(px => px.id == item.selection_id).attributes?.color || '') + ") / IMEI: " + (products.find(px => px.id == item.selection_id).attributes?.imei || '')) : item.selection_id || ''} 
                                                onChange={e => updateItem(i, 'selection_id', e.target.value)}
                                            />
                                            <datalist id={`productOptions-${i}`}>
                                                {products.map(p => (
                                                    <option key={p.id} value={`${p.name.toUpperCase()} (${(p.attributes?.ram || '')}/${(p.attributes?.storage || '')}/${(p.attributes?.color || '')}) / IMEI: ${p.attributes?.imei || ''}`} />
                                                ))}
                                            </datalist>
                                            
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
                                            <input type="number" className="form-control form-control-sm fw-bold border-2 text-center" min="1" required value={item.quantity} onChange={e => updateItem(i, 'quantity', parseInt(e.target.value))} />
                                        </td>
                                        <td>
                                            <div className="input-group input-group-sm mb-1">
                                                <span className="input-group-text">₹</span>
                                                <input type="number" step="0.01" className="form-control text-end fw-bold" required value={item.unit_price} onChange={e => updateItem(i, 'unit_price', parseFloat(e.target.value))} />
                                            </div>
                                            {priceMode === 'WHOLESALE' && (
                                                <div className="text-center text-warning text-dark x-small fw-bold mb-1" style={{ fontSize: '10px' }}>
                                                    <i className="bi bi-tag-fill me-1"></i>WHOLESALE
                                                </div>
                                            )}
                                            <div className="x-small fw-bold text-muted text-center border rounded bg-light px-1" style={{ fontSize: '10px' }}>
                                                RANGE: <span className="text-danger">₹{item.min_selling_price}</span> - <span className="text-info">₹{item.max_selling_price}</span>
                                            </div>
                                        </td>
                                        <td className="text-end text-muted fw-bold align-middle">₹{rateExcl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td className="text-center fw-bold text-muted align-middle">{gstRate}%</td>
                                        <td className="text-end fw-bold text-dark align-middle">₹{totalExcl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td className="text-end fw-bold text-primary align-middle fs-6">₹{netTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td className="pe-3 text-center" style={{ width: '50px' }}>
                                            <button type="button" className="btn btn-danger btn-sm rounded-3 shadow-sm px-2" onClick={() => removeItem(i)} title="Remove Item">
                                                ✕
                                            </button>
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

                    <div className="row g-2 mb-3 bg-light p-2 rounded">
                         <div className="col-12 d-flex justify-content-between align-items-center">
                            <span className="small fw-bold text-muted text-uppercase">Calculate GST?</span>
                            <div className="form-check form-switch p-0 m-0">
                                <input className="form-check-input ms-0" type="checkbox" 
                                    checked={form.calculate_gst} onChange={e => setForm({...form, calculate_gst: e.target.checked})} />
                            </div>
                         </div>
                    </div>

                    <div className="row g-2 mb-3">
                         <div className="col-6">
                            <label className="form-label x-small fw-bold text-muted">CGST %</label>
                            <input type="number" step="0.01" className="form-control form-control-sm fw-bold" value={form.cgst_rate} onChange={e => setForm({...form, cgst_rate: e.target.value})} disabled={!form.calculate_gst} />
                        </div>
                        <div className="col-6">
                            <label className="form-label x-small fw-bold text-muted">SGST %</label>
                            <input type="number" step="0.01" className="form-control form-control-sm fw-bold" value={form.sgst_rate} onChange={e => setForm({...form, sgst_rate: e.target.value})} disabled={!form.calculate_gst} />
                        </div>
                    </div>

                    <div className="row g-2 mb-3">
                        <div className="col-6">
                            <label className="form-label x-small fw-bold text-muted">PAYMENT</label>
                            <select className="form-select form-select-sm" value={form.payment_method} onChange={e => setForm({...form, payment_method: e.target.value})}>
                                <option value="cash">CASH</option>
                                <option value="card">CARD</option>
                                <option value="mobile">UPI / MOBILE</option>
                                <option value="bank">BANK / NEFT</option>
                                <option value="other">OTHER</option>
                            </select>
                        </div>
                        {form.payment_method === 'other' && (
                            <div className="col-12 mt-2">
                                <label className="form-label x-small fw-bold text-danger animate-pulse">SPECIFY PAYMENT MODE *</label>
                                <input 
                                    type="text" 
                                    className="form-control form-control-sm border-danger fw-bold text-uppercase" 
                                    placeholder="E.G. CHEQUE, EXCHANGE, ETC..." 
                                    required
                                    value={form.other_payment_mode} 
                                    onChange={e => setForm({...form, other_payment_mode: e.target.value.toUpperCase()})} 
                                />
                            </div>
                        )}
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
                        <div className="d-flex justify-content-between mb-1 align-items-center">
                            <span className="small text-muted fw-bold">CGST ({form.cgst_rate}%):</span>
                            {isManualGst ? (
                              <div className="d-flex align-items-center gap-1">
                                <input type="number" step="0.01" className="form-control form-control-sm text-end fw-bold text-dark border-primary" style={{ width: '100px', height: '28px' }}
                                  value={form.cgst_amount} onChange={e=>setForm({...form, cgst_amount: parseFloat(e.target.value)||0})} />
                                <button type="button" className="btn btn-xs btn-link p-0 m-0 text-danger" onClick={()=>{setIsManualGst(false); setForm(f=>({...f, is_gst_manual:false}))}}>↺</button>
                              </div>
                            ) : (
                              <span className="fw-bold cursor-pointer text-decoration-underline" onClick={()=>{setIsManualGst(true); setForm(f=>({...f, cgst_amount: cgstAmount.toFixed(2), is_gst_manual:true}))}} title="Click to edit manually">₹{cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} ✏️</span>
                            )}
                        </div>
                        <div className="d-flex justify-content-between mb-1 align-items-center">
                            <span className="small text-muted fw-bold">SGST ({form.sgst_rate}%):</span>
                            {isManualGst ? (
                              <div className="d-flex align-items-center gap-1">
                                <input type="number" step="0.01" className="form-control form-control-sm text-end fw-bold text-dark border-primary" style={{ width: '100px', height: '28px' }}
                                  value={form.sgst_amount} onChange={e=>setForm({...form, sgst_amount: parseFloat(e.target.value)||0})} />
                                <button type="button" className="btn btn-xs btn-link p-0 m-0 text-danger" onClick={()=>{setIsManualGst(false); setForm(f=>({...f, is_gst_manual:false}))}}>↺</button>
                              </div>
                            ) : (
                              <span className="fw-bold cursor-pointer text-decoration-underline" onClick={()=>{setIsManualGst(true); setForm(f=>({...f, sgst_amount: sgstAmount.toFixed(2), is_gst_manual:true}))}} title="Click to edit manually">₹{sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} ✏️</span>
                            )}
                        </div>
                        <div className="d-flex justify-content-between mb-3 align-items-center mt-2 border-bottom pb-2">
                            <div className="w-100">
                                <div className="d-flex justify-content-between align-items-center mb-1">
                                    <span className="small text-muted fw-bold">CASH DISCOUNT:</span>
                                </div>
                                <input type="number" className="form-control form-control-sm text-end fw-black text-info border-info"
                                    value={form.cash_discount === 0 ? '' : form.cash_discount} 
                                    onFocus={e => e.target.select()}
                                    onChange={e => setForm({...form, cash_discount: e.target.value})} 
                                />
                                <div className="x-small text-muted mt-1 fw-bold" style={{fontSize:'0.6rem'}}>
                                    ✅ DEDUCTED FROM BILL
                                </div>
                            </div>
                        </div>

                        <div className="d-flex justify-content-between mb-1 align-items-center mt-2">
                            <span className="small text-muted fw-bold">DISCOUNT (ADDITIONAL):</span>
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
                                <div className="d-flex align-items-center gap-1">
                                    <button type="button" className="btn btn-xs btn-light border fw-bold" onClick={() => { setForm(f => ({...f, round_off: (parseFloat(f.round_off) || 0) - 1, rounding_mode: 'manual'})); setIsManualRound(true); }}>-1</button>
                                    <input 
                                        type="number" 
                                        step="0.01" 
                                        className="form-control form-control-sm text-end fw-black text-primary border-primary" 
                                        style={{ width: '80px' }} 
                                        value={form.round_off === 0 ? '' : form.round_off} 
                                        onFocus={e => e.target.select()}
                                        onChange={e => {
                                            setForm({...form, round_off: parseFloat(e.target.value) || 0, rounding_mode: 'manual'});
                                            setIsManualRound(true);
                                        }} 
                                    />
                                    <button type="button" className="btn btn-xs btn-light border fw-bold" onClick={() => { setForm(f => ({...f, round_off: (parseFloat(f.round_off) || 0) + 1, rounding_mode: 'manual'})); setIsManualRound(true); }}>+1</button>
                                </div>
                                {(form.round_off !== 0 || form.rounding_mode !== 'auto') && (
                                    <button type="button" className="btn btn-link btn-sm p-0 m-0 text-decoration-none" 
                                        onClick={() => { setIsManualRound(false); setForm(f => ({...f, rounding_mode: 'auto'})); }} 
                                        title="Reset to Auto">↺ RESET</button>
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
                        {parseFloat(form.total_paid) > 0 && (
                            <div className="mt-2 animate-fade-in">
                                <label className="form-label x-small fw-bold text-muted mb-1">PAYMENT MODE</label>
                                <select className="form-select form-select-sm fw-bold text-uppercase border-success" value={form.payment_method} onChange={e => setForm({...form, payment_method: e.target.value})}>
                                    <option value="CASH">CASH</option>
                                    <option value="PHONEPE">PHONEPE</option>
                                    <option value="GPAY">GPAY</option>
                                    <option value="BANK / NEFT">BANK / NEFT</option>
                                    <option value="OTHER">OTHER</option>
                                </select>
                                {form.payment_method === 'OTHER' && (
                                    <input 
                                        className="form-control form-control-sm mt-1 text-uppercase fw-bold border-primary" 
                                        placeholder="SPECIFY MODE (E.G. CHEQUE)" 
                                        value={form.other_mode}
                                        onChange={e => setForm({...form, other_mode: e.target.value.toUpperCase()})}
                                    />
                                )}
                            </div>
                        )}
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
                  <div className="row g-3">
                      <div className="col-md-6 text-uppercase">
                          <label className="form-label small fw-bold">Full Name <span className="text-danger">*</span></label>
                          <input type="text" className="form-control" required value={newCust.name} onChange={e => setNewCust({...newCust, name: e.target.value.toUpperCase()})} />
                      </div>
                      <div className="col-md-6 text-uppercase">
                          <label className="form-label small fw-bold">Phone Number <span className="text-danger">*</span></label>
                          <input type="text" className="form-control" required value={newCust.phone} onChange={e => setNewCust({...newCust, phone: e.target.value})} />
                      </div>
                      <div className="col-md-6 text-uppercase">
                          <label className="form-label small fw-bold">Email</label>
                          <input type="email" className="form-control" value={newCust.email} onChange={e => setNewCust({...newCust, email: e.target.value})} />
                      </div>
                      <div className="col-md-6 text-uppercase">
                          <label className="form-label small fw-bold">Voucher Code</label>
                          <input type="text" className="form-control" value={newCust.voucher_code} onChange={e => setNewCust({...newCust, voucher_code: e.target.value.toUpperCase()})} />
                      </div>
                      <div className="col-md-6 text-uppercase">
                          <label className="form-label small fw-bold">Customer Type <span className="text-danger">*</span></label>
                          <select className="form-select" value={newCust.category} onChange={e => setNewCust({...newCust, category: e.target.value})}>
                              <option value="REGULAR">NORMAL CUSTOMER</option>
                              <option value="SHOP">SHOP CUSTOMER</option>
                          </select>
                      </div>
                      <div className="col-12 text-uppercase">
                          <label className="form-label small fw-bold">GST Number (Optional)</label>
                          <input type="text" className="form-control" placeholder="e.g. 22AAAAA0000A1Z5" value={newCust.gst_no} onChange={e => setNewCust({...newCust, gst_no: e.target.value.toUpperCase()})} />
                      </div>
                      <div className="col-12 text-uppercase">
                          <label className="form-label small fw-bold">Address</label>
                          <input type="text" className="form-control" value={newCust.address} onChange={e => setNewCust({...newCust, address: e.target.value.toUpperCase()})} />
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
                                      <option value="DOB">DOB</option>
                                      <option value="Anniversary">Anniversary</option>
                                      <option value="Other">Other</option>
                                  </select>
                              </div>
                              {ev.type === 'Other' && (
                                  <div className="col-4">
                                      <label className="x-small fw-bold">Event Name</label>
                                      <input className="form-control form-control-sm" placeholder="e.g. Wedding" value={ev.name} onChange={e => updateCustEvent(i, 'name', e.target.value.toUpperCase())} />
                                  </div>
                              )}
                              <div className={ev.type === 'Other' ? 'col-3' : 'col-6'}>
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
