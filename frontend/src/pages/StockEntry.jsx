import { useState, useEffect, useCallback } from 'react';
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
                if (r.data.length > 0 && !form.shop_id) {
                    setForm(f => ({ ...f, shop_id: r.data[0].id }));
                }
            });
        }
    } catch(e) {
        toast.error("Failed to load inventory data");
    } finally {
        setLoading(false);
    }
  }, [isOwner, form.shop_id, filters]);

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
            <button className={`nav-link fw-bold px-4 ${tab==='entry'?'active':''}`} onClick={() => setTab('entry')}>📥 MANUAL ENTRY</button>
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

           <div className="table-card">
              <div className="table-responsive">
                 <table className="table table-hover align-middle mb-0 text-uppercase">
                    <thead className="table-light">
                       <tr>
                          <th>PRODUCT & CONFIG</th>
                          <th>{filters.group_by_config ? 'QTY' : 'IMEI'}</th>
                          <th className="text-center">MIN SELL</th>
                          <th className="text-center">MAX SELL</th>
                          <th className="text-center">CURR PRICE</th>
                          <th>LOCATION</th>
                          <th className="text-end">ACTIONS</th>
                       </tr>
                    </thead>
                    <tbody>
                       {loading ? (
                          <tr><td colSpan={7} className="text-center py-4"><div className="spinner-border spinner-border-sm"/></td></tr>
                       ) : products.map(p => (
                          <tr key={p.id}>
                             <td>
                                <div className="fw-bold text-primary">{p.name}</div>
                                <div className="text-muted x-small">
                                   {p.attributes?.ram || '-'}/{p.attributes?.storage || '-'}/{p.attributes?.color || '-'}
                                </div>
                             </td>
                             <td>
                                {filters.group_by_config ? (
                                   <span className="badge bg-primary text-white border">{p.current_stock} UNITS</span>
                                ) : (
                                   p.attributes?.imei ? (
                                      <span className="badge bg-light text-dark border">🆔 {p.attributes.imei}</span>
                                   ) : (
                                      <span className="text-muted small">—</span>
                                   )
                                )}
                             </td>
                             <td className="text-center fw-bold text-danger">₹{parseFloat(p.min_selling_price || 0).toLocaleString('en-IN')}</td>
                             <td className="text-center fw-bold text-success">₹{parseFloat(p.max_selling_price || 0).toLocaleString('en-IN')}</td>
                             <td className="text-center fw-bold">₹{parseFloat(p.selling_price || 0).toLocaleString('en-IN')}</td>
                             <td>{p.location ? `📍 ${p.location}` : '—'}</td>
                             <td className="text-end">
                                <button 
                                   className="btn btn-sm btn-success fw-bold px-3 shadow-xs" 
                                   onClick={() => {
                                      window.location.href = `/sales/new?imei=${p.attributes?.imei || ''}`;
                                    }}
                                >
                                   SELL
                                </button>
                                <button 
                                   className="btn btn-sm btn-link text-decoration-none small ms-1"
                                   onClick={() => { setForm({...form, product_id: p.product_id || p.id}); setTab('entry'); }}
                                >
                                   ADJUST
                                </button>
                             </td>
                          </tr>
                       ))}
                       {products.length === 0 && !loading && (
                          <tr><td colSpan={7} className="text-center py-5 text-muted">No matching stocks found</td></tr>
                       )}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>
      )}

      {/* ── Entry Tab ── */}
      {tab === 'entry' && (
        <form onSubmit={handleSubmit}>
          <div className="row g-3">
            {/* Left: Form */}
            <div className="col-12 col-lg-7">
              <div className="form-card">
                <div className="form-card-title">📋 Entry Details</div>
                <div className="row g-3">

                  {/* Product picker */}
                  <div className="col-12">
                    <label className="form-label fw-semibold">Product <span className="text-danger">*</span></label>
                    <select className="form-select" required value={form.product_id} onChange={e => setForm({...form, product_id: e.target.value})}>
                      <option value="">— Select product —</option>
                      {baseProducts.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.sku}) — Current: {currentStock[p.id] ?? 0} units
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Shop picker (Owner only) */}
                  {isOwner() && (
                    <div className="col-12">
                        <label className="form-label fw-semibold text-primary">Target Shop <span className="text-danger">*</span></label>
                        <select className="form-select border-primary" required value={form.shop_id} onChange={e => setForm({...form, shop_id: e.target.value})}>
                            {shops.map(s => (
                                <option key={s.id} value={s.id}>{s.name} {s.is_main ? '⭐' : ''}</option>
                            ))}
                        </select>
                        <div className="form-text">As Owner, you must specify which shop's inventory to adjust.</div>
                    </div>
                  )}

                  {/* Reason */}
                  <div className="col-12">
                    <label className="form-label fw-semibold">Reason <span className="text-danger">*</span></label>
                    <select className="form-select" value={form.reason} onChange={e => setForm({...form, reason: e.target.value})}>
                      <optgroup label="— Add Stock">
                        {REASONS.filter(r => ADD_REASONS.includes(r.value)).map(r => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </optgroup>
                      <optgroup label="— Remove Stock">
                        {REASONS.filter(r => REMOVE_REASONS.includes(r.value)).map(r => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </optgroup>
                    </select>
                    <div className={`mt-2 p-2 rounded border ${isAdd ? 'border-success' : 'border-danger'}`}
                      style={{ background: isAdd ? '#f0fdf4' : '#fff1f2', fontSize:'0.8rem', color: isAdd ? '#15803d' : '#b91c1c' }}>
                      {isAdd ? '➕ This will ADD stock to inventory' : '➖ This will REMOVE stock from inventory'}
                    </div>
                  </div>

                  {/* Quantity + Date */}
                  <div className="col-6">
                    <label className="form-label fw-semibold">Quantity <span className="text-danger">*</span></label>
                    <input type="number" className="form-control" min="1" required
                      value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})} />
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">Date of Stock</label>
                    <input type="date" className="form-control"
                      value={form.adjustment_date} onChange={e => setForm({...form, adjustment_date: e.target.value})} />
                    <div className="form-text">Use actual purchase date if backdating</div>
                  </div>

                  {/* Purchase price (optional, for add reasons) */}
                  {isAdd && (
                    <div className="col-12 col-sm-6">
                      <label className="form-label fw-semibold">Purchase Price ₹ <span className="text-muted fw-normal" style={{ fontSize:'0.76rem' }}>(optional — for cost tracking)</span></label>
                      <div className="input-group">
                        <span className="input-group-text">₹</span>
                        <input type="number" className="form-control" step="0.01" min="0" placeholder="0.00"
                          value={form.purchase_price} onChange={e => setForm({...form, purchase_price: e.target.value})} />
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  <div className="col-12">
                    <label className="form-label fw-semibold">Notes <span className="text-muted fw-normal" style={{ fontSize:'0.76rem' }}>(optional)</span></label>
                    <textarea className="form-control" rows={2} placeholder="e.g. Purchased from Samsung showroom on 15 Jan, invoice #INV-2024-112"
                      value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
                  </div>
                </div>

                <div className="mt-4 d-flex gap-2">
                  <button type="submit" disabled={loading}
                    className={`btn fw-semibold px-4 ${isAdd ? 'btn-success' : 'btn-danger'}`}>
                    {loading ? <span className="spinner-border spinner-border-sm me-2" /> : null}
                    {isAdd ? '➕ Add to Stock' : '➖ Remove from Stock'}
                  </button>
                  <button type="button" className="btn btn-outline-secondary"
                    onClick={() => setForm({ product_id:'', quantity:1, reason:'opening_stock', purchase_price:'', notes:'', adjustment_date: new Date().toISOString().slice(0,10) })}>
                    Clear
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Product Summary */}
            <div className="col-12 col-lg-5">
              {selectedProduct ? (
                <div className="form-card h-100">
                  <div className="form-card-title">📱 Selected Product</div>

                  <div className="fw-bold fs-6 mb-1">{selectedProduct.name}</div>
                  <div className="text-muted mb-3" style={{ fontSize:'0.8rem' }}>
                    SKU: <code>{selectedProduct.sku}</code> · {selectedProduct.category?.name}
                  </div>

                  <div className="row g-2">
                    <div className="col-6">
                      <div style={{ background:'#f8f6ff', borderRadius:10, padding:'0.75rem', textAlign:'center' }}>
                        <div style={{ fontSize:'0.72rem', color:'#777', marginBottom:'2px' }}>CURRENT STOCK</div>
                        <div className={`fw-bold fs-4 ${selectedStock === 0 ? 'text-danger' : selectedStock <= 3 ? 'text-warning' : 'text-success'}`}>{selectedStock}</div>
                        <div style={{ fontSize:'0.72rem', color:'#999' }}>units</div>
                      </div>
                    </div>
                    <div className="col-6">
                      <div style={{ background:'#f0fdf4', borderRadius:10, padding:'0.75rem', textAlign:'center' }}>
                        <div style={{ fontSize:'0.72rem', color:'#777', marginBottom:'2px' }}>AFTER {isAdd ? 'ADDING' : 'REMOVING'}</div>
                        <div className="fw-bold fs-4 text-primary">
                          {Math.max(0, selectedStock + (isAdd ? parseInt(form.quantity||0) : -parseInt(form.quantity||0)))}
                        </div>
                        <div style={{ fontSize:'0.72rem', color:'#999' }}>units</div>
                      </div>
                    </div>
                  </div>

                  {/* Product Attributes Preview */}
                  {selectedProduct.attributes && Object.keys(selectedProduct.attributes).length > 0 && (
                    <div className="mt-3">
                      <div className="fw-semibold mb-2" style={{ fontSize:'0.78rem', color:'#555' }}>PRODUCT SPECS</div>
                      <div className="row g-1">
                        {Object.entries(selectedProduct.attributes).map(([k,v]) => (
                          <div key={k} className="col-6" style={{ fontSize:'0.76rem' }}>
                            <span className="text-muted text-capitalize">{k.replace(/_/g,' ')}: </span>
                            <span className="fw-semibold">{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-3 pt-3 border-top row g-1" style={{ fontSize:'0.78rem' }}>
                    <div className="col-6 text-muted">Purchase Price:</div>
                    <div className="col-6 fw-semibold">₹{selectedProduct.purchase_price}</div>
                    <div className="col-6 text-muted">Selling Price:</div>
                    <div className="col-6 fw-semibold text-success">₹{selectedProduct.selling_price}</div>
                    <div className="col-6 text-muted">Condition:</div>
                    <div className="col-6">{selectedProduct.condition === 'new' ? '🆕 New' : '🔄 Used'}</div>
                    {selectedProduct.location && (
                      <>
                        <div className="col-6 text-muted">Location:</div>
                        <div className="col-6">📍 {selectedProduct.location}</div>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="form-card h-100 d-flex flex-column align-items-center justify-content-center text-center text-muted" style={{ minHeight:200 }}>
                  <div style={{ fontSize:'2.5rem' }}>📱</div>
                  <div className="mt-2">Select a product to see its details and current stock</div>
                </div>
              )}
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
                    </tr>
                  ))}
                  {history.length === 0 && (
                    <tr><td colSpan={8} className="text-center py-4 text-muted">No stock adjustments recorded yet</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
