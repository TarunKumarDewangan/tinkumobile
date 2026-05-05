import { useState, useRef, useEffect } from 'react';
import { Modal, Button } from 'react-bootstrap';
import BarcodeScannerModal from './BarcodeScannerModal';

// categories prop is still accepted (for new product category_id) but NOT used for brand list
export default function BulkScanModal({ show, onHide, products, categories, onAddItems }) {
  const [selectedProductId, setSelectedProductId] = useState('');
  const [scannedImeis, setScannedImeis] = useState([]);
  const [showScanner, setShowScanner] = useState(false);
  const [manualImei, setManualImei] = useState('');
  const [isNew, setIsNew] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [ram, setRam] = useState('');
  const [storage, setStorage] = useState('');
  const [color, setColor] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [wholesellerPrice, setWholesellerPrice] = useState('');
  const [minSellingPrice, setMinSellingPrice] = useState('');
  const [incentive, setIncentive] = useState('');
  // New price flow
  const [rateIncTax, setRateIncTax] = useState('');
  const [discountPct, setDiscountPct] = useState('');
  const [cashDiscount, setCashDiscount] = useState('');
  const [gstRate, setGstRate] = useState('18');
  // Multi-product batch
  const [batchItems, setBatchItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const manualInputRef = useRef(null);

  // Brand = keyword filter on product name (NOT category)
  const [selectedBrand, setSelectedBrand] = useState(''); // just a string like "Vivo"
  const [brandInput, setBrandInput] = useState('');
  const [customBrands, setCustomBrands] = useState([]); // user-added brands (local only)
  const [showBrandDropdown, setShowBrandDropdown] = useState(false);

  // "Mobile New" category id for new products (id=1 typically; use categories prop to find it)
  const mobileNewCatId = categories?.find(c => c.slug === 'mobile-new')?.id
    || categories?.find(c => c.name?.toLowerCase().includes('mobile new'))?.id
    || 1;

  const BUILTIN_BRANDS = ['Vivo', 'Oppo', 'Samsung', 'Realme', 'Redmi', 'OnePlus', 'iPhone', 'Motorola', 'Nokia', 'Tecno', 'Itel'];
  const allBrands = [...BUILTIN_BRANDS, ...customBrands.filter(b => !BUILTIN_BRANDS.map(x=>x.toLowerCase()).includes(b.toLowerCase()))];

  useEffect(() => {
    if (show && !showScanner) setTimeout(() => manualInputRef.current?.focus(), 300);
  }, [show, showScanner, selectedProductId, isNew]);

  const handleAddImei = (imei) => {
    if (imei && !scannedImeis.includes(imei)) setScannedImeis(prev => [...prev, imei]);
  };

  const handleManualAdd = (e) => {
    if (e) e.preventDefault();
    if (manualImei.trim()) { handleAddImei(manualImei.trim()); setManualImei(''); }
  };

  // Derived price calculations
  const rateExclTaxNum = rateIncTax ? (parseFloat(rateIncTax) / (1 + parseFloat(gstRate || 0) / 100)) : 0;
  const rateExclTax = rateIncTax ? rateExclTaxNum.toFixed(2) : '';
  
  const discountAmtNum = (rateExclTaxNum && discountPct) ? (rateExclTaxNum * parseFloat(discountPct) / 100) : 0;
  const cashDiscNum = parseFloat(cashDiscount || 0);
  
  const rateExclTaxAfterDiscNum = rateIncTax ? (rateExclTaxNum - discountAmtNum - cashDiscNum) : 0;
  const rateExclTaxAfterDisc = rateIncTax ? rateExclTaxAfterDiscNum.toFixed(2) : '';
  
  const gstAmtNum = rateExclTaxAfterDiscNum * (parseFloat(gstRate || 0) / 100);
  const gstAmt = rateIncTax ? gstAmtNum.toFixed(2) : '0.00';
  
  const finalAmountNum = rateExclTaxAfterDiscNum + gstAmtNum;
  const finalAmount = rateIncTax ? finalAmountNum.toFixed(2) : '';

  const handleReset = () => {
    setScannedImeis([]); setSelectedProductId(''); setIsNew(false); setNewProductName('');
    setRam(''); setStorage(''); setColor('');
    setUnitPrice(''); setSellingPrice(''); setWholesellerPrice(''); setSearchTerm('');
    setMinSellingPrice(''); setIncentive(''); setShowDropdown(false);
    setSelectedBrand(''); setBrandInput(''); setShowBrandDropdown(false);
    setRateIncTax(''); setDiscountPct(''); setCashDiscount(''); setGstRate('18');
  };

  // Commit current product's IMEIs to batch, reset for next product
  const handleAddAnother = () => {
    if (!scannedImeis.length || (isNew ? !newProductName : !selectedProductId)) return;
    const product = isNew ? null : products.find(p => p.id == selectedProductId);
    const newItems = scannedImeis.map(imei => ({
      product_id: isNew ? '' : selectedProductId,
      is_new: isNew,
      new_product_name: isNew ? (selectedBrand ? `${selectedBrand} ${newProductName}`.trim() : newProductName) : '',
      category_id: isNew ? mobileNewCatId : (product?.category_id || mobileNewCatId),
      imei, ram, storage, color, quantity: 1,
      unit_price: rateIncTax ? rateExclTaxAfterDiscNum : (unitPrice || product?.purchase_price || 0),
      selling_price: sellingPrice || product?.selling_price || 0,
      wholeseller_price: wholesellerPrice || product?.wholeseller_price || 0,
      min_selling_price: minSellingPrice || product?.min_selling_price || 0,
      max_selling_price: rateIncTax ? finalAmountNum : 0,
      incentive_amount: incentive || product?.incentive_amount || 0
    }));
    setBatchItems(prev => [...prev, ...newItems]);
    // Reset only product/IMEI part, keep modal open
    setScannedImeis([]); setSelectedProductId(''); setIsNew(false); setNewProductName('');
    setRam(''); setStorage(''); setColor(''); setSearchTerm(''); setShowDropdown(false);
    setUnitPrice(''); setSellingPrice(''); setWholesellerPrice('');
    setMinSellingPrice(''); setIncentive('');
    setRateIncTax(''); setDiscountPct(''); setCashDiscount('');
  };

  const handleFinish = () => {
    if (isNew && !newProductName && !batchItems.length) return;
    if (!isNew && !selectedProductId && !batchItems.length) return;
    let allItems = [...batchItems];
    // Include current product if it has IMEIs
    if (scannedImeis.length && (isNew ? newProductName : selectedProductId)) {
      const product = isNew ? null : products.find(p => p.id == selectedProductId);
      const currentItems = scannedImeis.map(imei => ({
        product_id: isNew ? '' : selectedProductId,
        is_new: isNew,
        new_product_name: isNew ? (selectedBrand ? `${selectedBrand} ${newProductName}`.trim() : newProductName) : '',
        category_id: isNew ? mobileNewCatId : (product?.category_id || mobileNewCatId),
        imei, ram, storage, color, quantity: 1,
        unit_price: rateIncTax ? rateExclTaxAfterDiscNum : (unitPrice || product?.purchase_price || 0),
        selling_price: sellingPrice || product?.selling_price || 0,
        wholeseller_price: wholesellerPrice || product?.wholeseller_price || 0,
        min_selling_price: minSellingPrice || product?.min_selling_price || 0,
        max_selling_price: rateIncTax ? finalAmountNum : 0,
        incentive_amount: incentive || product?.incentive_amount || 0
      }));
      allItems = [...allItems, ...currentItems];
    }
    if (!allItems.length) return;
    onAddItems(allItems);
    setBatchItems([]);
    handleReset();
    onHide();
  };

  const handleProductChange = (id) => {
    setSelectedProductId(id);
    if (id) {
      const p = products.find(x => x.id == id);
      if (p) {
        setUnitPrice(p.purchase_price || ''); setSellingPrice(p.selling_price || '');
        setWholesellerPrice(p.wholeseller_price || '');
        setMinSellingPrice(p.min_selling_price || ''); setIncentive(p.incentive_amount || '');
        setRateIncTax(p.purchase_price || '');
        if (p.attributes) { setRam(p.attributes.ram||''); setStorage(p.attributes.storage||''); setColor(p.attributes.color||''); }
      }
    } else {
      setUnitPrice(''); setSellingPrice(''); setWholesellerPrice(''); setMinSellingPrice(''); setIncentive('');
      setRateIncTax(''); setDiscountPct(''); setCashDiscount('');
      setRam(''); setStorage(''); setColor(''); setSearchTerm('');
    }
  };

  const handleSelectBrand = (name) => {
    setSelectedBrand(name);
    setBrandInput(name);
    setShowBrandDropdown(false);
    setSelectedProductId('');
    setSearchTerm('');
  };

  const handleAddCustomBrand = () => {
    const name = brandInput.trim();
    if (!name) return;
    if (!customBrands.map(b=>b.toLowerCase()).includes(name.toLowerCase())) {
      setCustomBrands(prev => [...prev, name]);
    }
    handleSelectBrand(name);
  };

  // Filter products: by brand keyword (name contains brand) AND search term
  const filteredProducts = products.filter(p => {
    const nameLower = p.name.toLowerCase();
    const matchesBrand = !selectedBrand || nameLower.includes(selectedBrand.toLowerCase());
    const matchesSearch = !searchTerm ||
      nameLower.includes(searchTerm.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesBrand && matchesSearch;
  });

  const filteredBrandList = allBrands.filter(b =>
    !brandInput || b.toLowerCase().includes(brandInput.toLowerCase())
  );

  const S = `
    .bm-hdr{background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);}
    .bm-chip{font-size:.65rem;padding:3px 11px;border-radius:20px;font-weight:700;cursor:pointer;transition:all .18s;border:1.5px solid #dee2e6;background:#fff;line-height:1.7;white-space:nowrap;}
    .bm-chip:hover{border-color:#6366f1;color:#6366f1;transform:translateY(-1px);}
    .bm-chip.act{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border-color:transparent;box-shadow:0 2px 8px rgba(99,102,241,.4);}
    .bm-lbl{font-size:.67rem;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#94a3b8;margin-bottom:8px;display:flex;align-items:center;gap:6px;}
    .bm-card{background:#fff;border-radius:12px;border:1px solid #e9ecef;padding:14px;}
    .bm-card label{font-size:.7rem;font-weight:700;margin-bottom:3px;display:block;}
    .bm-item{padding:8px 14px;border-bottom:1px solid #f1f5f9;cursor:pointer;transition:background .1s;font-size:.82rem;}
    .bm-item:hover{background:#eef2ff;}
    .bm-item.sel{background:#6366f1;color:#fff;}
    .bm-pill{display:flex;justify-content:space-between;align-items:center;background:#fff;border:1px solid #e0e7ff;border-radius:50px;padding:7px 14px;animation:bmIn .2s ease;box-shadow:0 1px 4px rgba(99,102,241,.07);}
    .bm-pill:hover{border-color:#6366f1;background:#fafafa;}
    @keyframes bmIn{from{opacity:0;transform:translateY(-5px);}to{opacity:1;transform:translateY(0);}}
    .bm-sc::-webkit-scrollbar{width:4px;}
    .bm-sc::-webkit-scrollbar-thumb{background:#c7d2fe;border-radius:8px;}
    .bm-tip{background:linear-gradient(135deg,#e0f2fe,#dbeafe);border-radius:10px;padding:10px 14px;font-size:.75rem;}
  `;

  const brandMatchesExact = allBrands.some(b => b.toLowerCase() === brandInput.toLowerCase());

  return (
    <Modal show={show} onHide={onHide} centered size="xl" backdrop="static">
      <style>{S}</style>

      <Modal.Header closeButton className="bm-hdr border-0 py-3 px-4">
        <Modal.Title className="text-white fw-bold d-flex align-items-center gap-3 w-100">
          <span style={{background:'rgba(255,255,255,.13)',borderRadius:10,padding:'7px 11px',fontSize:'1.25rem'}}>📦</span>
          <div>
            <div style={{fontSize:'.95rem',letterSpacing:.8}}>BULK IMEI / SERIAL ENTRY</div>
            <div style={{fontSize:'.68rem',opacity:.55,fontWeight:400}}>Select company → product → scan or type IMEIs</div>
          </div>
          {scannedImeis.length > 0 && (
            <span className="ms-auto badge" style={{background:'#6366f1',fontSize:'.78rem',padding:'6px 13px',borderRadius:20}}>
              {scannedImeis.length} scanned
            </span>
          )}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body className="p-0" style={{background:'#f1f5f9'}}>
        <div className="row g-0" style={{minHeight:530}}>

          {/* ── COL 1: Brand/Company filter ── */}
          <div className="col-12 col-lg-4 p-3 border-end" style={{background:'#fff'}}>
            <div className="bm-lbl">🏷️ Step 1 — Select Company / Brand</div>

            {/* Quick chips */}
            <div className="d-flex flex-wrap gap-1 mb-3">
              {BUILTIN_BRANDS.map(name => (
                <button key={name} type="button"
                  className={`bm-chip${selectedBrand.toLowerCase()===name.toLowerCase()?' act':''}`}
                  onClick={() => selectedBrand.toLowerCase()===name.toLowerCase() ? handleSelectBrand('') : handleSelectBrand(name)}>
                  {name}
                </button>
              ))}
              {/* Custom user-added brands */}
              {customBrands.filter(b => !BUILTIN_BRANDS.map(x=>x.toLowerCase()).includes(b.toLowerCase())).map(name => (
                <button key={name} type="button"
                  className={`bm-chip${selectedBrand.toLowerCase()===name.toLowerCase()?' act':''}`}
                  onClick={() => selectedBrand.toLowerCase()===name.toLowerCase() ? handleSelectBrand('') : handleSelectBrand(name)}>
                  {name}
                </button>
              ))}
            </div>

            {/* Type-to-search/add brand */}
            <div className="position-relative mb-2">
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-white" style={{borderColor:'#6366f1'}}>🔍</span>
                <input type="text" className="form-control" style={{borderColor:'#6366f1',borderLeft:'none'}}
                  placeholder="Search or type company name..."
                  value={brandInput}
                  onFocus={() => setShowBrandDropdown(true)}
                  onChange={e => { setBrandInput(e.target.value); setShowBrandDropdown(true); }}
                  onKeyDown={e => e.key==='Enter' && handleAddCustomBrand()}
                  autoComplete="off" />
                {selectedBrand && (
                  <span className="input-group-text text-white fw-bold" style={{background:'#6366f1',borderColor:'#6366f1'}}>✓</span>
                )}
              </div>

              {showBrandDropdown && (
                <div className="position-absolute w-100 bg-white border rounded-3 shadow-lg mt-1"
                  style={{zIndex:1060,maxHeight:'200px',overflowY:'auto'}}>
                  {filteredBrandList.map(b => (
                    <div key={b} className={`bm-item fw-bold${selectedBrand.toLowerCase()===b.toLowerCase()?' sel':''}`}
                      onClick={() => handleSelectBrand(b)}>
                      {b}
                    </div>
                  ))}
                  {/* Add new if not matching */}
                  {brandInput && !brandMatchesExact && (
                    <div className="bm-item fw-bold text-primary"
                      style={{background:'#f0f4ff'}}
                      onClick={handleAddCustomBrand}>
                      ➕ Use "{brandInput}" as brand filter
                    </div>
                  )}
                  {filteredBrandList.length === 0 && !brandInput && (
                    <div className="bm-item text-muted small">Type to search brands above</div>
                  )}
                </div>
              )}
              {showBrandDropdown && (
                <div className="position-fixed top-0 start-0 w-100 h-100" style={{zIndex:1050}}
                  onClick={() => setShowBrandDropdown(false)} />
              )}
            </div>

            {selectedBrand ? (
              <div className="mt-2 px-1 d-flex align-items-center justify-content-between">
                <span className="small fw-bold" style={{color:'#6366f1'}}>
                  ✓ Filtering by: <strong>{selectedBrand}</strong>
                  {' '}
                  <span className="badge" style={{background:'#e0e7ff',color:'#6366f1',fontSize:'.65rem'}}>
                    {filteredProducts.length} products
                  </span>
                </span>
                <button className="btn btn-link btn-sm p-0 text-danger text-decoration-none small" type="button"
                  onClick={() => { setSelectedBrand(''); setBrandInput(''); setSelectedProductId(''); setSearchTerm(''); }}>
                  ✕ Clear
                </button>
              </div>
            ) : (
              <div className="mt-2 px-1 small text-muted" style={{fontSize:'.72rem'}}>
                💡 Pick a brand above to filter products, or skip and search all {products.length} products directly.
              </div>
            )}
          </div>

          {/* ── COL 2: Product + Prices + IMEI ── */}
          <div className="col-12 col-lg-4 p-3 border-end">
            <div className="bm-lbl">
              📱 Step 2 — Product Info
              <div className="ms-auto form-check form-switch p-0 m-0 d-flex align-items-center gap-1">
                <label className="small text-muted" style={{fontSize:'.7rem'}}>New Product?</label>
                <input className="form-check-input ms-1" type="checkbox" checked={isNew} onChange={e => setIsNew(e.target.checked)} />
              </div>
            </div>

            {isNew ? (
              <div className="mb-3">
                {selectedBrand && (
                  <div className="input-group input-group-sm mb-1">
                    <span className="input-group-text fw-bold" style={{background:'#6366f1',color:'#fff',borderColor:'#6366f1'}}>{selectedBrand}</span>
                    <input type="text" className="form-control"
                      placeholder="Model name (e.g. V70 Elite)"
                      value={newProductName} onChange={e => setNewProductName(e.target.value)} />
                  </div>
                )}
                {!selectedBrand && (
                  <input type="text" className="form-control form-control-sm shadow-sm"
                    placeholder="Full name (e.g. Vivo V70 Elite)"
                    value={newProductName} onChange={e => setNewProductName(e.target.value)} />
                )}
                <div className="small mt-1 text-muted" style={{fontSize:'.7rem'}}>
                  📁 Will be added to <strong>Mobile New</strong> category
                </div>
              </div>
            ) : (
              <div className="position-relative mb-3">
                <div className="input-group input-group-sm">
                  <span className="input-group-text bg-white border-primary text-primary">🔍</span>
                  <input type="text" className="form-control border-primary shadow-sm"
                    placeholder={selectedBrand ? `Search ${selectedBrand} models...` : 'Search all products...'}
                    value={searchTerm}
                    onFocus={() => setShowDropdown(true)}
                    onChange={e => setSearchTerm(e.target.value)}
                    autoComplete="off" />
                  {searchTerm && (
                    <button className="btn btn-outline-secondary border-primary border-start-0"
                      onClick={() => { setSearchTerm(''); handleProductChange(''); }}>✕</button>
                  )}
                </div>
                {showDropdown && (
                  <div className="position-absolute w-100 bg-white border border-primary rounded-3 shadow-lg mt-1"
                    style={{zIndex:1050,maxHeight:'230px',overflowY:'auto'}}>
                    {filteredProducts.length > 0 ? filteredProducts.map(p => (
                      <div key={p.id} className={`bm-item${selectedProductId==p.id?' sel':''}`}
                        onClick={() => { handleProductChange(p.id); setSearchTerm(p.name); setShowDropdown(false); }}>
                        <div className="fw-bold">{p.name}</div>
                        {p.sku && <div style={{fontSize:'10px',opacity:.6}}>SKU: {p.sku}</div>}
                      </div>
                    )) : (
                      <div className="p-3 text-center text-muted small">
                        {selectedBrand
                          ? `No "${selectedBrand}" products found${searchTerm ? ` for "${searchTerm}"` : ''}. Try toggling "New Product".`
                          : `No products found${searchTerm ? ` for "${searchTerm}"` : ''}`}
                      </div>
                    )}
                  </div>
                )}
                {showDropdown && <div className="position-fixed top-0 start-0 w-100 h-100" style={{zIndex:1040}} onClick={() => setShowDropdown(false)} />}
              </div>
            )}

            {/* Prices */}
            <div className="bm-card mb-3">
              <div className="row g-2">
                {/* Row 1: Rate Inc Tax + GST % */}
                <div className="col-7">
                  <label style={{color:'#1e293b',fontWeight:800}}>Rate (Inc. Tax) — DP</label>
                  <div className="input-group input-group-sm">
                    <span className="input-group-text">₹</span>
                    <input type="number" className="form-control fw-bold" step=".01" placeholder="0"
                      value={rateIncTax}
                      onChange={e => { setRateIncTax(e.target.value); setUnitPrice(e.target.value); }} />
                  </div>
                </div>
                <div className="col-5">
                  <label className="text-muted">GST %</label>
                  <select className="form-select form-select-sm" value={gstRate} onChange={e => setGstRate(e.target.value)}>
                    <option value="0">0% (No GST)</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                </div>
                {/* Row 2: Rate Excl Tax (auto) */}
                <div className="col-6">
                  <label className="text-muted">Rate w/o Tax (auto)</label>
                  <div className="input-group input-group-sm">
                    <span className="input-group-text">₹</span>
                    <input type="number" className="form-control bg-light text-muted" readOnly value={rateExclTax} />
                  </div>
                </div>
                {/* Row 3: Discount % + CD */}
                <div className="col-3">
                  <label className="text-warning">Disc %</label>
                  <input type="number" className="form-control form-control-sm border-warning" step=".01" placeholder="0"
                    value={discountPct} onChange={e => setDiscountPct(e.target.value)} />
                </div>
                <div className="col-3">
                  <label className="text-danger" style={{fontSize:'.65rem'}}>CD (Cash Disc)</label>
                  <div className="input-group input-group-sm">
                    <span className="input-group-text text-danger">₹</span>
                    <input type="number" className="form-control border-danger" step=".01" placeholder="0"
                      value={cashDiscount} onChange={e => setCashDiscount(e.target.value)} />
                  </div>
                </div>
                {/* Row 4: Amount after discounts (w/o tax) */}
                <div className="col-6">
                  <label style={{color:'#059669',fontWeight:800}}>Rate w/o Tax (After Disc)</label>
                  <div className="input-group input-group-sm">
                    <span className="input-group-text text-success">₹</span>
                    <input type="number" className="form-control border-success fw-bold text-success bg-white" readOnly value={rateExclTaxAfterDisc} />
                  </div>
                </div>
                <div className="col-6">
                  <label className="text-muted">GST Amount</label>
                  <div className="input-group input-group-sm">
                    <span className="input-group-text">₹</span>
                    <input type="number" className="form-control bg-light text-muted" readOnly value={gstAmt} />
                  </div>
                </div>
                {/* Final Unit Price */}
                <div className="col-12 mt-2 mb-2">
                  <div className="p-2 rounded-2 d-flex justify-content-between align-items-center" style={{background:'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)', color:'#fff'}}>
                    <span className="fw-bold" style={{fontSize:'.8rem'}}>FINAL AMOUNT PER UNIT:</span>
                    <span className="fs-5 fw-bold">₹{finalAmount || '0.00'}</span>
                  </div>
                </div>
                {/* Sell Price + Commission */}
                <div className="col-6">
                  <label className="text-success">Sell Price (MOP)</label>
                  <div className="input-group input-group-sm"><span className="input-group-text text-success">₹</span>
                    <input type="number" className="form-control border-success fw-bold" step=".01" placeholder="0" value={sellingPrice} onChange={e => setSellingPrice(e.target.value)} /></div>
                </div>
                <div className="col-6">
                  <label className="text-primary">Whole Seller Price</label>
                  <div className="input-group input-group-sm"><span className="input-group-text text-primary">₹</span>
                    <input type="number" className="form-control border-primary" step=".01" placeholder="0" value={wholesellerPrice} onChange={e => setWholesellerPrice(e.target.value)} /></div>
                </div>
                <div className="col-6">
                  <label className="text-danger">Min Price</label>
                  <div className="input-group input-group-sm"><span className="input-group-text text-danger">₹</span>
                    <input type="number" className="form-control border-danger" step=".01" placeholder="0" value={minSellingPrice} onChange={e => setMinSellingPrice(e.target.value)} /></div>
                </div>
                <div className="col-6">
                  <label style={{color:'#6366f1'}}>Commission</label>
                  <div className="input-group input-group-sm"><span className="input-group-text" style={{color:'#6366f1',borderColor:'#a5b4fc'}}>₹</span>
                    <input type="number" className="form-control" style={{borderColor:'#a5b4fc'}} step=".01" placeholder="0" value={incentive} onChange={e => setIncentive(e.target.value)} /></div>
                </div>
              </div>
            </div>

            <div className="row g-2 mb-3">
              <div className="col-4"><input type="text" className="form-control form-control-sm" placeholder="RAM" value={ram} onChange={e => setRam(e.target.value)} /></div>
              <div className="col-4"><input type="text" className="form-control form-control-sm" placeholder="Storage" value={storage} onChange={e => setStorage(e.target.value)} /></div>
              <div className="col-4"><input type="text" className="form-control form-control-sm" placeholder="Color" value={color} onChange={e => setColor(e.target.value)} /></div>
            </div>

            <div className="bm-lbl">🔢 Step 3 — Scan / Type IMEI</div>
            <div className="input-group mb-2">
              <input type="text" className="form-control shadow-sm" ref={manualInputRef}
                placeholder="Scan or type IMEI / Serial..."
                value={manualImei} onChange={e => setManualImei(e.target.value)}
                onKeyDown={e => e.key==='Enter' && handleManualAdd(e)} />
              <Button onClick={handleManualAdd} disabled={!manualImei.trim()}
                style={{background:'#6366f1',borderColor:'#6366f1'}}>➕ Add</Button>
            </div>
            <Button variant="outline-secondary" className="w-100 mb-2" size="sm"
              disabled={isNew ? !newProductName : !selectedProductId}
              onClick={() => setShowScanner(true)}>
              📷 Use Camera Scanner
            </Button>
            {/* Add Another Product */}
            <button type="button"
              className="btn btn-outline-primary w-100 fw-bold mb-2"
              style={{fontSize:'.78rem',borderRadius:8}}
              disabled={!scannedImeis.length || (isNew ? !newProductName : !selectedProductId)}
              onClick={handleAddAnother}>
              ➕ Done — Add Another Product
            </button>
            <div className="bm-tip">
              <strong>📟 Physical Scanner?</strong> Click the IMEI box above and scan — items add automatically.
            </div>
          </div>

          {/* ── COL 3: IMEI List ── */}
          <div className="col-12 col-lg-4 p-3" style={{background:'#f8fafc'}}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div className="bm-lbl mb-0">
                📋 Entry List&nbsp;
                <span className="badge rounded-pill" style={{background:'#6366f1',fontSize:'.7rem',padding:'3px 9px'}}>
                  {scannedImeis.length + batchItems.length}
                </span>
              </div>
              {(scannedImeis.length > 0 || batchItems.length > 0) && (
                <button className="btn btn-link btn-sm p-0 text-danger text-decoration-none" style={{fontSize:'.75rem'}}
                  onClick={() => { setScannedImeis([]); setBatchItems([]); }}>Clear All</button>
              )}
            </div>

            <div className="bm-sc d-flex flex-column gap-2" style={{maxHeight:430,overflowY:'auto'}}>
              {/* Batched products from previous "Add Another" */}
              {batchItems.length > 0 && (
                <div className="px-2 py-1 rounded-3 mb-1" style={{background:'#e0e7ff',fontSize:'.68rem',color:'#6366f1',fontWeight:700}}>
                  ✅ {batchItems.length} phone{batchItems.length!==1?'s':''} from previous product(s) added
                </div>
              )}
              {scannedImeis.length === 0 && batchItems.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  <div style={{fontSize:'2.8rem',marginBottom:10,opacity:.4}}>📥</div>
                  <div className="fw-bold small">No IMEIs yet</div>
                  <div style={{fontSize:'.72rem',opacity:.7}}>Select a product and start scanning</div>
                </div>
              ) : (
                [...scannedImeis].reverse().map((imei, idx) => (
                  <div key={idx} className="bm-pill">
                    <div className="d-flex align-items-center gap-2">
                      <span className="badge rounded-circle d-flex align-items-center justify-content-center"
                        style={{width:22,height:22,fontSize:'.62rem',background:'#6366f1',flexShrink:0}}>
                        {scannedImeis.length - idx}
                      </span>
                      <code className="fw-bold text-dark" style={{fontSize:'.82rem'}}>{imei}</code>
                    </div>
                    <button type="button" className="btn-close" style={{transform:'scale(.75)'}}
                      onClick={() => setScannedImeis(scannedImeis.filter(x => x !== imei))} />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </Modal.Body>

      <Modal.Footer className="border-top px-4 py-3" style={{background:'#fff'}}>
        <Button variant="outline-secondary" className="px-4 fw-bold" onClick={onHide}>Cancel</Button>
        <Button className="px-5 fw-bold shadow"
          style={{
            background: (scannedImeis.length + batchItems.length) > 0 ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : '#adb5bd',
            borderColor: 'transparent', letterSpacing: .5
          }}
          disabled={(scannedImeis.length + batchItems.length) === 0}
          onClick={handleFinish}>
          ✅ Add {scannedImeis.length + batchItems.length} Phone{(scannedImeis.length + batchItems.length)!==1?'s':''} to Purchase
        </Button>
      </Modal.Footer>

      <BarcodeScannerModal show={showScanner} continuous={true}
        onHide={() => setShowScanner(false)} onScanSuccess={handleAddImei} />
    </Modal>
  );
}
