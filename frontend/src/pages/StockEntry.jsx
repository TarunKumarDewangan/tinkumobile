import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import api from '../api/axios';
import { formatDate } from '../utils/formatters';
import { useAuth } from '../contexts/AuthContext';

const REASONS = [
  { value: 'opening_stock',     label: '🏁 Opening Stock — stock present before this system was started' },
  { value: 'previous_purchase', label: '📦 Previous Purchase — purchase that was not entered earlier' },
  { value: 'correction_add',    label: '➕ Stock Correction (Add) — counted more than system shows' },
  { value: 'correction_remove', label: '➖ Stock Correction (Remove) — counted less than system shows' },
  { value: 'damage_write_off',  label: '💔 Damage / Write-off — damaged or expired items' },
  { value: 'return_to_supplier',label: '🔄 Return to Supplier — items sent back to supplier' },
];

const ADD_REASONS    = ['opening_stock','previous_purchase','correction_add'];
const REMOVE_REASONS = ['correction_remove','damage_write_off','return_to_supplier'];

export default function StockEntry() {
  const [products, setProducts] = useState([]);
  const [baseProducts, setBaseProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [currentStock, setCurrentStock] = useState({});  // productId → stock
  const [form, setForm] = useState({
    product_id: '', quantity: 1, reason: 'opening_stock',
    purchase_price: '', notes: '', adjustment_date: new Date().toISOString().slice(0,10),
    shop_id: '',
  });
  const [shops, setShops] = useState([]);
  const { user, isOwner } = useAuth();
  const [history, setHistory] = useState([]);
  const [tab, setTab] = useState('stocks'); // 'stocks' | 'entry' | 'history'
  const [loading, setLoading] = useState(false);
  const [histLoading, setHistLoading] = useState(false);
  const [categories, setCategories] = useState([]);

  // Bulk Opening Stock State
  const [openingStockItems, setOpeningStockItems] = useState([
    { product_id: '', is_new: false, new_product_name: '', category_id: 1, imei: '', ram: '', storage: '', color: '', quantity: 1, unit_price: '', selling_price: '' }
  ]);
  
  // Filter States
  const [filters, setFilters] = useState({
    search: '',
    supplier_id: '',
    from: '',
    to: '',
    ram: '',
    storage: '',
    color: '',
    model: '',
    imei: '',
    group_by_config: true
  });
  const [imeiList, setImeiList] = useState([]);
  const [editingAdj, setEditingAdj] = useState(null);
  const [editForm, setEditForm] = useState({ quantity: 1, purchase_price: '', notes: '', adjustment_date: '' });

  const initialShopSet = useRef(false);

  // Load products and current stock levels
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
        const [prodRes, baseProdRes, stockRes] = await Promise.all([
            api.get('/products', { params: filters }),
            api.get('/products'),
            api.get('/stock-levels')
        ]);
        setProducts(prodRes.data);
        setBaseProducts(baseProdRes.data);
        const map = {};
        stockRes.data.forEach(inv => { map[inv.product_id] = inv.stock; });
        setCurrentStock(map);

        if (isOwner()) {
            api.get('/shops').then(r => {
                setShops(r.data);
                if (r.data.length > 0 && !form.shop_id && !initialShopSet.current) {
                    initialShopSet.current = true;
                    setForm(f => ({ ...f, shop_id: r.data[0].id }));
                }
            });
        }
    } catch(e) {
        toast.error("Failed to load inventory data");
    } finally {
        setLoading(false);
    }
  }, [filters, form.shop_id, isOwner]);

  useEffect(() => { loadData(); }, [loadData]);

  const loadSuppliers = async () => {
    try {
      const r = await api.get('/suppliers');
      setSuppliers(r.data);
    } catch(e) {}
  };

  const loadUniqueImeis = async () => {
    try {
      const { data } = await api.get('/purchase-invoices/unique-imeis');
      setImeiList(data);
    } catch(e) {}
  };

  useEffect(() => {
    loadSuppliers();
    loadUniqueImeis();
    api.get('/categories').then(r => setCategories(r.data));
  }, []);

  const handleFilterChange = (name, value) => {
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      supplier_id: '',
      from: '',
      to: '',
      ram: '',
      storage: '',
      color: '',
      model: '',
      imei: '',
      group_by_config: true
    });
  };

  const loadHistory = useCallback(() => {
    setHistLoading(true);
    api.get('/stock-adjustments').then(r => setHistory(r.data)).finally(() => setHistLoading(false));
  }, []);

  useEffect(() => { if (tab === 'history') loadHistory(); }, [tab]);


  // Auto-set type based on chosen reason
  const isAdd = ADD_REASONS.includes(form.reason);

  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    if (openingStockItems.length === 0) return;
    
    // Validation
    const invalid = openingStockItems.some(item => !item.is_new && !item.product_id);
    const invalidNew = openingStockItems.some(item => item.is_new && !item.new_product_name);
    if (invalid || invalidNew) {
        toast.error('Please complete all product selections');
        return;
    }

    setLoading(true);
    try {
        const payload = {
            items: openingStockItems,
            adjustment_date: form.adjustment_date,
            shop_id: form.shop_id,
            notes: form.notes
        };
        await api.post('/stock-adjustments/bulk', payload);
        toast.success(`✅ Successfully added items to stock!`);
        setOpeningStockItems([{ product_id: '', is_new: false, new_product_name: '', category_id: 1, imei: '', ram: '', storage: '', color: '', quantity: 1, unit_price: '', selling_price: '' }]);
        loadData();
    } catch (e) {
        toast.error(e.response?.data?.message || 'Error saving stock');
    } finally {
        setLoading(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
        await api.put(`/stock-adjustments/${editingAdj.id}`, editForm);
        toast.success('Adjustment updated successfully!');
        setEditingAdj(null);
        loadHistory();
        loadData();
    } catch (e) {
        toast.error(e.response?.data?.message || 'Error updating adjustment');
    } finally {
        setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this adjustment? Inventory will be reverted.')) return;
    setLoading(true);
    try {
        await api.delete(`/stock-adjustments/${id}`);
        toast.success('Adjustment deleted and stock reverted!');
        loadHistory();
        loadData();
    } catch (e) {
        toast.error(e.response?.data?.message || 'Error deleting adjustment');
    } finally {
        setLoading(false);
    }
  };

  const updateOpeningItem = (i, field, val) => {
    const newItems = [...openingStockItems];
    newItems[i][field] = val;
    
    if (field === 'product_id' && val) {
        const p = baseProducts.find(x => x.id == val);
        if (p) {
            newItems[i].unit_price = p.purchase_price;
            newItems[i].selling_price = p.selling_price;
            if (p.attributes) {
                newItems[i].ram = p.attributes.ram || '';
                newItems[i].storage = p.attributes.storage || '';
                newItems[i].color = p.attributes.color || '';
            }
        }
    }
    setOpeningStockItems(newItems);
  };

  const addOpeningItem = () => {
    setOpeningStockItems([...openingStockItems, { product_id: '', is_new: false, new_product_name: '', category_id: 1, imei: '', ram: '', storage: '', color: '', quantity: 1, unit_price: '', selling_price: '' }]);
  };

  const removeOpeningItem = (i) => {
    setOpeningStockItems(openingStockItems.filter((_, idx) => idx !== i));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.product_id) { toast.error('Please select a product'); return; }
    setLoading(true);
    try {
      const payload = { ...form, type: isAdd ? 'add' : 'remove', quantity: parseInt(form.quantity) };
      await api.post('/stock-adjustments', payload);

      await loadData();

      toast.success(isAdd ? `✅ Stock added successfully!` : `✅ Stock removed!`);
      setForm(f => ({ ...f, product_id: '', quantity: 1, purchase_price: '', notes: '' }));
    } catch(e) {
      toast.error(e.response?.data?.message || 'Error saving stock entry');
    } finally { setLoading(false); }
  };

   const selectedProduct = baseProducts.find(p => p.id == form.product_id);
  const selectedStock   = form.product_id ? (currentStock[form.product_id] ?? 0) : null;

  return (
    <div>
      <div className="page-header">
        <div className="d-flex justify-content-between align-items-center w-100">
            <div>
                <h2 className="text-uppercase mb-0">📦 STOCKS</h2>
                <div className="text-muted" style={{ fontSize:'0.82rem' }}>Comprehensive Inventory Management</div>
            </div>
            <div className="d-none d-md-block">
                <span className="badge bg-light text-muted border px-3 py-2">⌨️ SHORTCUT: ALT + S</span>
            </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <ul className="nav nav-tabs mb-4">
        <li className="nav-item">
            <button className={`nav-link fw-bold px-4 ${tab==='stocks'?'active':''}`} onClick={() => setTab('stocks')}>📦 ALL STOCKS</button>
        </li>
        <li className="nav-item">
            <button className={`nav-link fw-bold px-4 ${tab==='entry'?'active':''}`} onClick={() => setTab('entry')}>📥 ENTRY BEFORE SYSTEM STARTED</button>
        </li>
        <li className="nav-item">
            <button className={`nav-link fw-bold px-4 ${tab==='history'?'active':''}`} onClick={() => setTab('history')}>🕓 HISTORY</button>
        </li>
      </ul>

      {/* ── All Stocks Tab ── */}
      {tab === 'stocks' && (
        <div className="fade-in">
          <div className="card border-0 shadow-sm p-3 mb-4 bg-white rounded-3">
            <div className="row g-2 align-items-end text-uppercase">
              <div className="col-12 col-md-3">
                <label className="small text-muted mb-1 px-1 fw-bold">🔍 SEARCH PRODUCT / SKU</label>
                <input 
                  type="text" 
                  className="form-control form-control-sm border-light bg-light text-uppercase"
                  placeholder="TYPE TO SEARCH..." 
                  value={filters.search}
                  onChange={e => handleFilterChange('search', e.target.value.toUpperCase())}
                />
              </div>
              <div className="col-6 col-md-2">
                <label className="small text-muted mb-1 px-1 fw-bold">👩‍💼 SUPPLIER</label>
                <select 
                  className="form-control form-control-sm border-light bg-light text-uppercase"
                  value={filters.supplier_id}
                  onChange={e => handleFilterChange('supplier_id', e.target.value)}
                >
                  <option value="">ALL SUPPLIERS</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name.toUpperCase()}</option>)}
                </select>
              </div>
              <div className="col-6 col-md-1">
                <label className="small text-muted mb-1 px-1 fw-bold">📅 FROM</label>
                <input 
                  type="date" 
                  className="form-control form-control-sm border-light bg-light"
                  value={filters.from}
                  onChange={e => handleFilterChange('from', e.target.value)}
                />
              </div>
              <div className="col-6 col-md-1">
                <label className="small text-muted mb-1 px-1 fw-bold">📅 TO</label>
                <input 
                  type="date" 
                  className="form-control form-control-sm border-light bg-light"
                  value={filters.to}
                  onChange={e => handleFilterChange('to', e.target.value)}
                />
              </div>
              <div className="col-auto">
                 <button className="btn btn-sm btn-light border-0 text-uppercase fw-bold" onClick={clearFilters}>Clear</button>
              </div>
              <div className="col-auto">
                 <div className="form-check form-switch mb-1">
                    <input 
                      className="form-check-input" 
                      type="checkbox" 
                      id="groupByConfig" 
                      checked={filters.group_by_config}
                      onChange={e => handleFilterChange('group_by_config', e.target.checked)}
                    />
                    <label className="form-check-label small fw-bold text-primary" htmlFor="groupByConfig">GROUP BY CONFIG</label>
                 </div>
              </div>
            </div>

            <div className="row g-2 align-items-end mt-2 pt-2 border-top border-light text-uppercase">
               <div className="col-6 col-md-3">
                  <label className="small text-muted mb-1 px-1 fw-bold">📱 MODEL/BRAND</label>
                  <input 
                    type="text" 
                    className="form-control form-control-sm border-light bg-light text-uppercase"
                    placeholder="E.G. VIVO V70" 
                    value={filters.model}
                    onChange={e => handleFilterChange('model', e.target.value.toUpperCase())}
                  />
               </div>
               <div className="col-6 col-md-2">
                  <label className="small text-muted mb-1 px-1 fw-bold">🎨 COLOR</label>
                  <input 
                    type="text" 
                    className="form-control form-control-sm border-light bg-light text-uppercase"
                    placeholder="E.G. BLACK" 
                    value={filters.color}
                    onChange={e => handleFilterChange('color', e.target.value.toUpperCase())}
                  />
               </div>
               <div className="col-6 col-md-2">
                  <label className="small text-muted mb-1 px-1 fw-bold">🚀 RAM</label>
                  <input 
                    type="text" 
                    className="form-control form-control-sm border-light bg-light text-uppercase"
                    placeholder="E.G. 8GB" 
                    value={filters.ram}
                    onChange={e => handleFilterChange('ram', e.target.value.toUpperCase())}
                  />
               </div>
               <div className="col-6 col-md-2">
                  <label className="small text-muted mb-1 px-1 fw-bold">💾 STORAGE</label>
                  <input 
                    type="text" 
                    className="form-control form-control-sm border-light bg-light text-uppercase"
                    placeholder="E.G. 128GB" 
                    value={filters.storage}
                    onChange={e => handleFilterChange('storage', e.target.value.toUpperCase())}
                  />
               </div>
               <div className="col-6 col-md-2">
                  <label className="small text-muted mb-1 px-1 fw-bold">🆔 IMEI NUMBER</label>
                  <input 
                    list="stockImeiOptions"
                    type="text" 
                    className="form-control form-control-sm border-light bg-light text-uppercase"
                    placeholder="E.G. 3546..." 
                    value={filters.imei}
                    onChange={e => handleFilterChange('imei', e.target.value.toUpperCase())}
                  />
                  <datalist id="stockImeiOptions">
                    {imeiList.map((i, idx) => <option key={idx} value={i} />)}
                  </datalist>
               </div>
            </div>
          </div>

            <div className="d-flex justify-content-between align-items-center mb-3">
               <div className="form-check form-switch bg-white border rounded-pill px-5 py-2 shadow-sm d-flex align-items-center">
                  <input 
                    className="form-check-input me-2" 
                    type="checkbox" 
                    id="groupByConfig" 
                    style={{ cursor: 'pointer', width: '2.5em', height: '1.25em' }}
                    checked={filters.group_by_config}
                    onChange={e => handleFilterChange('group_by_config', e.target.checked)}
                  />
                  <label className="form-check-label small fw-bold text-primary mb-0" htmlFor="groupByConfig" style={{ cursor: 'pointer', textTransform: 'uppercase' }}>
                    GROUP BY SAME CONFIGURATION
                  </label>
               </div>
               <button className="btn btn-outline-primary btn-sm fw-bold px-3 py-2 rounded shadow-sm d-flex align-items-center gap-2" style={{ border: '1.5px solid' }}>
                  📊 VIEW FULL REPORT
               </button>
            </div>

            <div className="table-card border-0 shadow-sm overflow-hidden" style={{ borderRadius: '12px' }}>
               <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0" style={{ borderCollapse: 'separate', borderSpacing: '0' }}>
                     <thead className="bg-light border-bottom">
                        <tr className="text-uppercase small fw-bold text-muted" style={{ letterSpacing: '0.5px' }}>
                           <th className="ps-4 py-3 border-0">PRODUCT NAME</th>
                           <th className="py-3 border-0">CONFIGURATION</th>
                           <th className="py-3 border-0">IMEI / SN</th>
                           <th className="py-3 border-0">LOCATION</th>
                           <th className="py-3 border-0 text-center">AVAILABLE STOCK</th>
                           <th className="py-3 border-0 text-end pe-5">PRICE</th>
                           <th className="py-3 border-0 text-end pe-4">ACTIONS</th>
                        </tr>
                     </thead>
                     <tbody className="bg-white">
                        {loading ? (
                           <tr><td colSpan={8} className="text-center py-5"><div className="spinner-border text-primary"/></td></tr>
                        ) : products.map(p => (
                           <tr key={p.id} className="border-bottom-0">
                              <td className="ps-4 py-3">
                                 <div style={{ color: '#6f42c1', fontWeight: '800', fontSize: '1.05rem', letterSpacing: '0.2px' }}>
                                    {p.name.toUpperCase()}
                                 </div>
                              </td>
                              <td className="py-3">
                                 <div className="d-flex align-items-center gap-2 flex-wrap">
                                    <span className="badge border px-2 py-1 x-small fw-800" style={{ backgroundColor: '#f8f9fa', color: '#495057', borderRadius: '4px' }}>
                                       {p.attributes?.color?.toUpperCase() || '-'}
                                    </span>
                                    <span className="fw-700 text-muted small" style={{ letterSpacing: '0.5px' }}>
                                       {p.attributes?.ram || '-' } / {p.attributes?.storage || '-'}
                                    </span>
                                 </div>
                              </td>
                              <td className="py-3">
                                 <div className="d-flex flex-wrap gap-1">
                                    {filters.group_by_config ? (
                                       p.attributes?.imeis?.length > 0 ? (
                                          p.attributes.imeis.map((imei, idx) => (
                                             <span key={idx} className="badge bg-light text-primary border px-2 py-1 x-small fw-bold">
                                                {imei}
                                             </span>
                                          ))
                                       ) : (
                                          <span className="text-muted small">—</span>
                                       )
                                    ) : (
                                       p.attributes?.imei ? (
                                          <span className="badge bg-primary-soft text-primary border border-primary border-opacity-10 px-2 py-1 x-small fw-bold" style={{ backgroundColor: '#e7f1ff' }}>
                                             {p.attributes.imei}
                                          </span>
                                       ) : (
                                          <span className="text-muted small">—</span>
                                       )
                                    )}
                                 </div>
                              </td>
                              <td className="py-3">
                                 <div 
                                    className="d-flex align-items-center text-muted small clickable-location" 
                                    style={{ cursor: 'pointer' }}
                                    onClick={async () => {
                                       const loc = window.prompt("Enter Location for " + p.name, p.location || '');
                                       if (loc !== null) {
                                          try {
                                             await api.put(`/products/${p.product_id || p.id}`, { location: loc });
                                             loadData();
                                             toast.success("Location updated!");
                                          } catch(e) { toast.error("Failed to update location"); }
                                       }
                                    }}
                                 >
                                    <span className="me-1">📍</span>
                                    <span className={p.location ? 'text-dark fw-bold' : 'text-primary'}>
                                       {p.location ? p.location.toUpperCase() : 'SET LOCATION'}
                                    </span>
                                 </div>
                              </td>
                              <td className="py-3 text-center">
                                 <span className="badge rounded-pill bg-success-soft text-success border-success border-opacity-25 px-3 py-1 fw-bold" style={{ backgroundColor: '#e6f4ea' }}>
                                    {p.current_stock} {parseFloat(p.current_stock) > 1 ? 'PCS' : 'PCS'}
                                 </span>
                              </td>
                              <td className="py-3 text-end pe-5 fw-800" style={{ fontSize: '1rem' }}>
                                 ₹{parseFloat(p.selling_price || 0).toLocaleString('en-IN')}
                              </td>
                              <td className="py-3 text-end pe-4">
                                 <div className="d-flex justify-content-end gap-1">
                                    {!filters.group_by_config && p.attributes?.imei && (
                                       <button 
                                          className="btn btn-success btn-sm fw-bold px-2 py-1 x-small shadow-sm"
                                          onClick={() => window.location.href = `/sales/new?imei=${p.attributes.imei}`}
                                       >
                                          SELL
                                       </button>
                                    )}
                                    <button 
                                       className="btn btn-outline-info btn-sm rounded border-2 d-inline-flex align-items-center justify-content-center"
                                       style={{ width: '32px', height: '32px', borderColor: '#d1ecf1' }}
                                       onClick={() => {
                                          setForm({...form, product_id: p.product_id || p.id});
                                          setTab('entry');
                                       }}
                                       title="Quick Adjust"
                                    >
                                       <span style={{ fontSize: '1.1rem' }}>⚙️</span>
                                    </button>
                                 </div>
                              </td>
                           </tr>
                        ))}
                        {products.length === 0 && !loading && (
                           <tr><td colSpan={6} className="text-center py-5 text-muted fw-bold">No matching stocks found</td></tr>
                        ) || null}
                     </tbody>
                  </table>
               </div>
            </div>
        </div>
      )}

      {/* ── Entry Tab ── */}
      {tab === 'entry' && (
        <form onSubmit={handleBulkSubmit}>
          <div className="card shadow-sm border-0 bg-white rounded-3 p-4 mb-4">
             <div className="d-flex justify-content-between align-items-center mb-4 border-bottom pb-3">
                 <div className="text-uppercase">
                     <h4 className="mb-0 fw-bold">All mobiles entry Before This system Started</h4>
                     <p className="text-muted small mb-0">Record opening stock that you have in hand before starting with this system</p>
                 </div>
                 {isOwner() && (
                    <div style={{ minWidth: '300px' }}>
                        <label className="form-label small fw-bold text-primary text-uppercase">Target Shop / Branch</label>
                        <select className="form-select form-select-sm border-primary" required value={form.shop_id} onChange={e => setForm({...form, shop_id: e.target.value})}>
                            {shops.map(s => (
                                <option key={s.id} value={s.id}>{s.name.toUpperCase()} {s.is_main ? '⭐' : ''}</option>
                            ))}
                        </select>
                    </div>
                 )}
             </div>

             <div className="row g-3 mb-4 text-uppercase">
                 <div className="col-md-4">
                    <label className="form-label small fw-bold">Stock Entry Date</label>
                    <input type="date" className="form-control form-control-sm" required value={form.adjustment_date} onChange={e => setForm({...form, adjustment_date: e.target.value})} />
                 </div>
                 <div className="col-md-8">
                    <label className="form-label small fw-bold">General Notes (Applied to all items)</label>
                    <input type="text" className="form-control form-control-sm" placeholder="E.G. OPENING STOCK AS PER PHYSICAL VERIFICATION..." value={form.notes} onChange={e => setForm({...form, notes: e.target.value.toUpperCase()})} />
                 </div>
             </div>

             <div className="table-responsive">
                <table className="table table-bordered align-middle text-uppercase">
                    <thead className="bg-light fw-bold small text-muted">
                        <tr>
                            <th style={{ minWidth: '280px' }}>Product</th>
                            <th style={{ width: '100px' }}>RAM</th>
                            <th style={{ width: '100px' }}>Storage</th>
                            <th style={{ width: '120px' }}>Color</th>
                            <th style={{ width: '80px' }} className="text-center">Qty</th>
                            <th style={{ minWidth: '250px' }}>IMEI / SN</th>
                            <th style={{ width: '120px' }}>Buy Price</th>
                            <th style={{ width: '120px' }}>Sell Price</th>
                            <th style={{ width: '50px' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {openingStockItems.map((item, i) => (
                            <tr key={i}>
                                <td>
                                    <div className="d-flex flex-column gap-1">
                                        <div className="form-check form-switch p-0 m-0 mb-1">
                                            <input className="form-check-input ms-0 me-2" type="checkbox" id={`is_new_${i}`} checked={item.is_new} onChange={e => updateOpeningItem(i, 'is_new', e.target.checked)} />
                                            <label className="form-check-label small text-muted fw-bold" htmlFor={`is_new_${i}`} style={{ fontSize: '0.65rem' }}>NEW PRODUCT?</label>
                                        </div>
                                        {item.is_new ? (
                                            <input type="text" className="form-control form-control-sm" placeholder="PRODUCT NAME" required value={item.new_product_name} onChange={e => updateOpeningItem(i, 'new_product_name', e.target.value.toUpperCase())} />
                                        ) : (
                                            <select className="form-select form-select-sm" required value={item.product_id} onChange={e => updateOpeningItem(i, 'product_id', e.target.value)}>
                                                <option value="">— CHOOSE PRODUCT —</option>
                                                {baseProducts.map(p => <option key={p.id} value={p.id}>{p.name.toUpperCase()}</option>)}
                                            </select>
                                        )}
                                    </div>
                                </td>
                                <td>
                                    <input type="text" className="form-control form-control-sm" placeholder="8GB" value={item.ram} onChange={e => updateOpeningItem(i, 'ram', e.target.value.toUpperCase())} />
                                </td>
                                <td>
                                    <input type="text" className="form-control form-control-sm" placeholder="128GB" value={item.storage} onChange={e => updateOpeningItem(i, 'storage', e.target.value.toUpperCase())} />
                                </td>
                                <td>
                                    <input type="text" className="form-control form-control-sm" placeholder="BLACK" value={item.color} onChange={e => updateOpeningItem(i, 'color', e.target.value.toUpperCase())} />
                                </td>
                                <td>
                                    <input type="number" className="form-control form-control-sm text-center fw-bold" min="1" value={item.quantity} onChange={e => {
                                        const qty = parseInt(e.target.value) || 1;
                                        updateOpeningItem(i, 'quantity', qty);
                                    }} />
                                </td>
                                <td>
                                    <div className="d-flex flex-column gap-1">
                                        {[...Array(item.quantity || 1)].map((_, idx) => {
                                            const imeis = item.imei ? item.imei.split(/[\s,]+/).filter(Boolean) : [];
                                            return (
                                                <input 
                                                    key={idx}
                                                    type="text" 
                                                    className="form-control form-control-sm" 
                                                    placeholder={`IMEI ${idx + 1}`} 
                                                    value={imeis[idx] || ''} 
                                                    onChange={e => {
                                                        const currentImeis = [...imeis];
                                                        currentImeis[idx] = e.target.value.toUpperCase();
                                                        updateOpeningItem(i, 'imei', currentImeis.join(' '));
                                                    }} 
                                                />
                                            );
                                        })}
                                    </div>
                                </td>
                                <td>
                                    <input type="number" className="form-control form-control-sm fw-bold" step="0.01" placeholder="0.00" value={item.unit_price} onChange={e => updateOpeningItem(i, 'unit_price', e.target.value)} />
                                </td>
                                <td>
                                    <input type="number" className="form-control form-control-sm fw-bold border-success text-success" step="0.01" placeholder="0.00" value={item.selling_price} onChange={e => updateOpeningItem(i, 'selling_price', e.target.value)} />
                                </td>
                                <td className="text-center">
                                    <button type="button" className="btn btn-link text-danger p-0" onClick={() => removeOpeningItem(i)} disabled={openingStockItems.length === 1}>🗑️</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
             </div>

             <div className="mt-3">
                 <button type="button" className="btn btn-outline-primary btn-sm fw-bold px-4 text-uppercase shadow-sm" onClick={addOpeningItem}>+ Add More Items</button>
             </div>
             
             <div className="mt-4 pt-3 border-top d-flex gap-2">
                 <button type="submit" disabled={loading} className="btn btn-success btn-lg fw-bold px-5 text-uppercase shadow">
                     {loading ? <span className="spinner-border spinner-border-sm me-2" /> : null}
                     Add to Stock
                 </button>
                 <button type="button" className="btn btn-outline-secondary btn-lg fw-bold px-4 text-uppercase" onClick={() => setTab('stocks')}>Cancel</button>
             </div>
          </div>
        </form>
      )}

      {/* ── History Tab ── */}
      {tab === 'history' && (
        <div className="table-card">
          <div className="table-responsive-mobile">
            {histLoading ? (
              <div className="text-center py-4"><div className="spinner-border spinner-border-sm" /></div>
            ) : (
              <table className="table table-hover mb-0">
                <thead>
                  <tr>
                    <th>Date</th><th>Product</th><th>Type</th><th>Qty</th>
                    <th>Reason</th><th>Buy Price</th><th>Notes</th><th>By</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(adj => (
                    <tr key={adj.id}>
                      <td className="text-muted" style={{ fontSize:'0.8rem', whiteSpace:'nowrap' }}>{formatDate(adj.adjustment_date)}</td>
                      <td>
                        <div className="fw-semibold">{adj.product?.name}</div>
                        <div className="text-muted" style={{ fontSize:'0.72rem' }}>{adj.product?.sku}</div>
                      </td>
                      <td>
                        <span className={`badge ${adj.type==='add'?'bg-success':'bg-danger'}`}>
                          {adj.type === 'add' ? '➕ Add' : '➖ Remove'}
                        </span>
                      </td>
                      <td className="fw-bold">{adj.quantity}</td>
                      <td style={{ fontSize:'0.8rem' }}>
                        {REASONS.find(r => r.value === adj.reason)?.label?.replace(/^.*?—\s*/,'') || adj.reason}
                      </td>
                      <td>{adj.purchase_price ? `₹${adj.purchase_price}` : '—'}</td>
                      <td style={{ maxWidth:180, fontSize:'0.78rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {adj.notes || '—'}
                      </td>
                      <td style={{ fontSize:'0.78rem' }}>{adj.user?.name}</td>
                      <td className="text-end">
                        <div className="d-flex gap-2 justify-content-end">
                          <button className="btn btn-sm btn-outline-primary border-0" onClick={() => {
                            setEditingAdj(adj);
                            setEditForm({
                              quantity: adj.quantity,
                              purchase_price: adj.purchase_price || '',
                              notes: adj.notes || '',
                              adjustment_date: adj.adjustment_date
                            });
                          }}>✏️</button>
                          <button className="btn btn-sm btn-outline-danger border-0" onClick={() => handleDelete(adj.id)}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {history.length === 0 && (
                    <tr><td colSpan={9} className="text-center py-4 text-muted">No stock adjustments recorded yet</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

        {/* Edit Modal */}
        {editingAdj && (
          <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
              <div className="modal-dialog modal-dialog-centered">
                  <form className="modal-content border-0 shadow-lg" onSubmit={handleUpdate}>
                      <div className="modal-header bg-primary text-white border-0 py-3">
                          <h6 className="modal-title text-uppercase fw-bold m-0">Edit Stock Adjustment</h6>
                          <button type="button" className="btn-close btn-close-white" onClick={() => setEditingAdj(null)}></button>
                      </div>
                      <div className="modal-body p-4 text-uppercase">
                          <div className="mb-3">
                              <label className="form-label small fw-bold text-muted text-uppercase mb-1">Product</label>
                              <div className="form-control bg-light border-0 fw-bold">{editingAdj.product?.name}</div>
                          </div>
                          <div className="row g-3 mb-3 text-uppercase">
                              <div className="col-6">
                                  <label className="form-label small fw-bold">Quantity</label>
                                  <input type="number" className="form-control shadow-sm" required value={editForm.quantity} onChange={e => setEditForm({...editForm, quantity: parseInt(e.target.value) || 1})} />
                              </div>
                              <div className="col-6">
                                  <label className="form-label small fw-bold">Date</label>
                                  <input type="date" className="form-control shadow-sm" required value={editForm.adjustment_date} onChange={e => setEditForm({...editForm, adjustment_date: e.target.value})} />
                              </div>
                          </div>
                          <div className="mb-3">
                              <label className="form-label small fw-bold text-uppercase">Buy Price (₹)</label>
                              <input type="number" step="0.01" className="form-control shadow-sm" value={editForm.purchase_price} onChange={e => setEditForm({...editForm, purchase_price: e.target.value})} />
                          </div>
                          <div className="mb-0">
                              <label className="form-label small fw-bold text-uppercase">Notes</label>
                              <textarea className="form-control shadow-sm" rows={3} value={editForm.notes} onChange={e => setEditForm({...editForm, notes: e.target.value.toUpperCase()})} />
                          </div>
                      </div>
                      <div className="modal-footer border-0 p-3 bg-light">
                          <button type="button" className="btn btn-outline-secondary px-4 fw-bold text-uppercase" onClick={() => setEditingAdj(null)}>Cancel</button>
                          <button type="submit" disabled={loading} className="btn btn-primary px-4 fw-bold text-uppercase">
                              {loading ? <span className="spinner-border spinner-border-sm me-2" /> : 'Save Changes'}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
}
