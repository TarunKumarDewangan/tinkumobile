import { useState, useRef, useEffect } from 'react';
import { Modal, Button } from 'react-bootstrap';
import BarcodeScannerModal from './BarcodeScannerModal';

// initialData is optional, used for editing a single item
export default function BulkScanModal({ show, onHide, products, categories, onAddItems, initialData }) {
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
  const [discountPct, setDiscountPct] = useState('3.85');
  const [cashDiscount, setCashDiscount] = useState('4.76');
  const [gstRate, setGstRate] = useState('18');
  const [roundingMode, setRoundingMode] = useState('auto'); // auto, up, down, exact
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
    if (show && initialData) {
      // Pre-fill fields for editing
      setSelectedProductId(initialData.product_id || '');
      setIsNew(!!initialData.is_new);
      setNewProductName(initialData.new_product_name || '');
      setRam(initialData.ram || '');
      setStorage(initialData.storage || '');
      setColor(initialData.color || '');
      setUnitPrice(initialData.unit_price || '');
      setSellingPrice(initialData.selling_price || '');
      setWholesellerPrice(initialData.wholeseller_price || '');
      setMinSellingPrice(initialData.min_selling_price || '');
      setIncentive(initialData.incentive_amount || '');
      setRateIncTax(initialData.unit_price || ''); // Best guess for DP if not stored
      setScannedImeis(initialData.imei ? [initialData.imei] : []);
      
      // Auto-detect brand from name if possible
      if (initialData.is_new && initialData.new_product_name) {
        const brandMatch = BUILTIN_BRANDS.find(b => initialData.new_product_name.toLowerCase().startsWith(b.toLowerCase()));
        if (brandMatch) setSelectedBrand(brandMatch);
      }
    } else if (show && !showScanner) {
      setTimeout(() => manualInputRef.current?.focus(), 300);
    }
  }, [show, initialData]);

  const isEdit = !!initialData;

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
  const priceAfterDiscNum = rateExclTaxNum - discountAmtNum;
  const priceAfterDisc = rateIncTax ? priceAfterDiscNum.toFixed(2) : '';
  
  const cashDiscAmtNum = (priceAfterDiscNum && cashDiscount) ? (priceAfterDiscNum * parseFloat(cashDiscount) / 100) : 0;
  const taxableValueNum = priceAfterDiscNum - cashDiscAmtNum;
  const taxableValue = rateIncTax ? taxableValueNum.toFixed(2) : '';
  
  const gstAmtNum = taxableValueNum * (parseFloat(gstRate || 0) / 100);
  const gstAmt = rateIncTax ? gstAmtNum.toFixed(2) : '0.00';
  
  const finalAmountNum = taxableValueNum + gstAmtNum;
  
  // Rounding Logic
  const count = scannedImeis.length || 1;
  const rawBatchTotal = finalAmountNum * count;
  let roundedBatchTotal = rawBatchTotal;
  if (roundingMode === 'auto') roundedBatchTotal = Math.round(rawBatchTotal);
  else if (roundingMode === 'up') roundedBatchTotal = Math.ceil(rawBatchTotal);
  else if (roundingMode === 'down') roundedBatchTotal = Math.floor(rawBatchTotal);
  
  const roundDiff = roundedBatchTotal - rawBatchTotal;
  const finalAmount = rateIncTax ? (roundedBatchTotal / count).toFixed(2) : '';
  const batchTotal = rateIncTax ? roundedBatchTotal.toFixed(2) : '';
  
  // Re-calculate taxable value based on rounded total if needed? 
  // Actually, let's just use the rounded total for the modal's display.
  // The unit_price sent to backend will be (RoundedTotal/Count) / (1 + GST%)
  const adjustedTaxableNum = rateIncTax ? (roundedBatchTotal / count) / (1 + parseFloat(gstRate || 0)/100) : taxableValueNum;

  const handleReset = () => {
    setScannedImeis([]); setSelectedProductId(''); setIsNew(false); setNewProductName('');
    setRam(''); setStorage(''); setColor('');
    setUnitPrice(''); setSellingPrice(''); setWholesellerPrice(''); setSearchTerm('');
    setMinSellingPrice(''); setIncentive(''); setShowDropdown(false);
    setSelectedBrand(''); setBrandInput(''); setShowBrandDropdown(false);
    setRateIncTax(''); setDiscountPct('3.85'); setCashDiscount('4.76'); setGstRate('18'); setRoundingMode('auto');
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
      unit_price: rateIncTax ? adjustedTaxableNum : (unitPrice || product?.purchase_price || 0),
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
    setRateIncTax(''); setDiscountPct('3.85'); setCashDiscount('4.76');
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
        unit_price: rateIncTax ? adjustedTaxableNum : (unitPrice || product?.purchase_price || 0),
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
      setRateIncTax(''); setDiscountPct('3.85'); setCashDiscount('4.76');
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
    .bm-tight{padding-left:4px !important;padding-right:4px !important;text-align:center;}
  `;

  const brandMatchesExact = allBrands.some(b => b.toLowerCase() === brandInput.toLowerCase());

  return (
    <Modal show={show} onHide={onHide} centered size="xl" backdrop="static">
      <style>{S}</style>

      <Modal.Header closeButton className="bm-hdr border-0 py-3 px-4">
        <Modal.Title className="text-white fw-bold d-flex align-items-center gap-3 w-100">
          <span style={{background:'rgba(255,255,255,.13)',borderRadius:10,padding:'7px 11px',fontSize:'1.25rem'}}>📦</span>
          <div>
            <div style={{fontSize:'.95rem',letterSpacing:.8}}>{isEdit ? '✏️ EDIT ITEM' : '📦 BULK IMEI / SERIAL ENTRY'}</div>
            <div style={{fontSize:'.68rem',opacity:.55,fontWeight:400}}>
              {isEdit ? 'Update product details and pricing' : 'Select company → product → scan or type IMEIs'}
            </div>
          </div>
          {scannedImeis.length > 0 && !isEdit && (
            <span className="ms-auto badge" style={{background:'#6366f1',fontSize:'.78rem',padding:'6px 13px',borderRadius:20}}>
              {scannedImeis.length} scanned
            </span>
          )}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body className="p-0" style={{background:'#f1f5f9'}}>
        <div className="row g-0">
          {/* LEFT SIDE: Steps 1 & 2 (Stacked Rows) */}
          <div className="col-12 col-lg-8 border-end" style={{background:'#fff'}}>
            
            {/* ── ROW 1: Brand/Company filter (Step 1) ── */}
            <div className="p-3 border-bottom">
              <div className="bm-lbl">🏷️ Step 1 — Select Company / Brand</div>
              <div className="d-flex flex-wrap gap-1 mb-3">
                {BUILTIN_BRANDS.map(name => (
                  <button key={name} type="button"
                    className={`bm-chip${selectedBrand.toLowerCase()===name.toLowerCase()?' act':''}`}
                    onClick={() => selectedBrand.toLowerCase()===name.toLowerCase() ? handleSelectBrand('') : handleSelectBrand(name)}>
                    {name}
                  </button>
                ))}
                {customBrands.filter(b => !BUILTIN_BRANDS.map(x=>x.toLowerCase()).includes(b.toLowerCase())).map(name => (
                  <button key={name} type="button"
                    className={`bm-chip${selectedBrand.toLowerCase()===name.toLowerCase()?' act':''}`}
                    onClick={() => selectedBrand.toLowerCase()===name.toLowerCase() ? handleSelectBrand('') : handleSelectBrand(name)}>
                    {name}
                  </button>
                ))}
              </div>

              <div className="row">
                <div className="col-md-6">
                  <div className="position-relative">
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
                        {brandInput && !brandMatchesExact && (
                          <div className="bm-item fw-bold text-primary" style={{background:'#f0f4ff'}} onClick={handleAddCustomBrand}>
                            ➕ Use "{brandInput}" as brand filter
                          </div>
                        )}
                      </div>
                    )}
                    {showBrandDropdown && <div className="position-fixed top-0 start-0 w-100 h-100" style={{zIndex:1050}} onClick={() => setShowBrandDropdown(false)} />}
                  </div>
                </div>
                <div className="col-md-6 d-flex align-items-center">
                  {selectedBrand ? (
                    <div className="px-1 d-flex align-items-center gap-2">
                      <span className="small fw-bold" style={{color:'#6366f1'}}>
                        ✓ {selectedBrand}
                        <span className="badge ms-2" style={{background:'#e0e7ff',color:'#6366f1',fontSize:'.65rem'}}>
                          {filteredProducts.length} items
                        </span>
                      </span>
                      <button className="btn btn-link btn-sm p-0 text-danger text-decoration-none small" type="button"
                        onClick={() => { setSelectedBrand(''); setBrandInput(''); setSelectedProductId(''); setSearchTerm(''); }}>✕</button>
                    </div>
                  ) : (
                    <div className="px-1 small text-muted" style={{fontSize:'.72rem'}}>
                      💡 Pick a brand to filter models
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── ROW 2: Product + Prices + IMEI (Step 2 & 3) ── */}
            <div className="p-3 bg-light">
              <div className="row g-3">
                <div className="col-md-6">
                  <div className="bm-lbl">
                    📱 Step 2 — Product Info
                    <div className="ms-auto form-check form-switch p-0 m-0 d-flex align-items-center gap-1">
                      <label className="small text-muted" style={{fontSize:'.7rem'}}>New?</label>
                      <input className="form-check-input ms-1" type="checkbox" checked={isNew} onChange={e => setIsNew(e.target.checked)} />
                    </div>
                  </div>

                  {isNew ? (
                    <div className="mb-3">
                      <input type="text" className="form-control form-control-sm shadow-sm"
                        placeholder="Full Model name (e.g. Vivo V70 Elite)"
                        value={newProductName} onChange={e => setNewProductName(e.target.value)} />
                    </div>
                  ) : (
                    <div className="position-relative mb-3">
                      <div className="input-group input-group-sm">
                        <span className="input-group-text bg-white border-primary text-primary">🔍</span>
                        <input type="text" className="form-control border-primary shadow-sm"
                          placeholder={selectedBrand ? `Search ${selectedBrand} models...` : 'Search models...'}
                          value={searchTerm}
                          onFocus={() => setShowDropdown(true)}
                          onChange={e => setSearchTerm(e.target.value)}
                          autoComplete="off" />
                      </div>
                      {showDropdown && (
                        <div className="position-absolute w-100 bg-white border border-primary rounded-3 shadow-lg mt-1"
                          style={{zIndex:1050,maxHeight:'230px',overflowY:'auto'}}>
                          {filteredProducts.length > 0 ? filteredProducts.map(p => (
                            <div key={p.id} className={`bm-item${selectedProductId==p.id?' sel':''}`}
                              onClick={() => { handleProductChange(p.id); setSearchTerm(p.name); setShowDropdown(false); }}>
                              <div className="fw-bold">{p.name}</div>
                              <div className="d-flex flex-wrap gap-1 align-items-center mt-1" style={{fontSize:'10px'}}>
                                {p.sku && <span className="text-muted">SKU: {p.sku}</span>}
                                {p.attributes?.ram && <span className="badge bg-light text-dark border fw-normal" style={{fontSize:'9px'}}>RAM: {p.attributes.ram}</span>}
                                {p.attributes?.storage && <span className="badge bg-light text-dark border fw-normal" style={{fontSize:'9px'}}>ROM: {p.attributes.storage}</span>}
                                {p.attributes?.color && <span className="badge bg-light text-dark border fw-normal" style={{fontSize:'9px'}}>{p.attributes.color}</span>}
                              </div>
                            </div>
                          )) : <div className="p-3 text-center text-muted small">No items found.</div>}
                        </div>
                      )}
                      {showDropdown && <div className="position-fixed top-0 start-0 w-100 h-100" style={{zIndex:1040}} onClick={() => setShowDropdown(false)} />}
                    </div>
                  )}

                  <div className="row g-2 mb-3">
                    <div className="col-4">
                      <input type="text" list="ramOptions" className="form-control form-control-sm" placeholder="RAM" value={ram} onChange={e => setRam(e.target.value)} />
                      <datalist id="ramOptions">{['2GB','4GB','6GB','8GB','12GB','16GB'].map(v => <option key={v} value={v} />)}</datalist>
                    </div>
                    <div className="col-4">
                      <input type="text" list="storageOptions" className="form-control form-control-sm" placeholder="ROM" value={storage} onChange={e => setStorage(e.target.value)} />
                      <datalist id="storageOptions">{['32GB','64GB','128GB','256GB','512GB'].map(v => <option key={v} value={v} />)}</datalist>
                    </div>
                    <div className="col-4">
                      <input type="text" list="colorOptions" className="form-control form-control-sm" placeholder="Color" value={color} onChange={e => setColor(e.target.value)} />
                      <datalist id="colorOptions">{['Black','White','Blue','Gold','Silver'].map(v => <option key={v} value={v} />)}</datalist>
                    </div>
                  </div>

                  <div className="bm-lbl mt-4">🔢 Step 3 — Scan / Type IMEI</div>
                  <div className="input-group mb-2">
                    <input type="text" className="form-control shadow-sm" ref={manualInputRef}
                      placeholder="Scan IMEI..."
                      value={manualImei} onChange={e => setManualImei(e.target.value)}
                      onKeyDown={e => e.key==='Enter' && handleManualAdd(e)} />
                    <Button onClick={handleManualAdd} disabled={!manualImei.trim()} style={{background:'#6366f1',borderColor:'#6366f1'}}>➕</Button>
                  </div>
                  <div className="d-flex gap-2">
                    <Button variant="outline-secondary" className="flex-grow-1 fw-bold" size="sm" onClick={() => setShowScanner(true)}>📷 Camera</Button>
                    {!isEdit && (
                      <button type="button" className="btn btn-primary flex-grow-1 fw-bold" style={{fontSize:'.75rem'}}
                        disabled={!scannedImeis.length || (isNew ? !newProductName : !selectedProductId)} onClick={handleAddAnother}>➕ Add Another</button>
                    )}
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="bm-card">
                    <div className="row g-2">
                      <div className="col-4">
                        <label className="x-small fw-bold">DP (Inc. GST)</label>
                        <div className="input-group input-group-sm">
                          <span className="input-group-text px-1">₹</span>
                          <input type="number" className="form-control fw-bold px-1" value={rateIncTax} onChange={e => { setRateIncTax(e.target.value); setUnitPrice(e.target.value); }} />
                        </div>
                      </div>
                      <div className="col-3">
                        <label className="x-small fw-bold">GST %</label>
                        <select className="form-select form-select-sm px-1" value={gstRate} onChange={e => setGstRate(e.target.value)}>
                          {[0,5,12,18,28].map(v => <option key={v} value={v}>{v}%</option>)}
                        </select>
                      </div>
                      <div className="col-5">
                        <label className="x-small fw-bold">Base (Ex-GST)</label>
                        <input type="text" className="form-control form-control-sm bg-light text-muted fw-bold bm-tight" readOnly value={rateExclTax} />
                      </div>

                      <div className="col-6">
                        <label className="x-small fw-bold text-warning">Disc %</label>
                        <input type="number" className="form-control form-control-sm border-warning" value={discountPct} onChange={e => setDiscountPct(e.target.value)} />
                      </div>
                      <div className="col-6">
                        <label className="x-small fw-bold">Price After Disc</label>
                        <div className="input-group input-group-sm">
                          <span className="input-group-text">₹</span>
                          <input type="text" className="form-control bg-light text-muted" readOnly value={priceAfterDisc} />
                        </div>
                      </div>

                      <div className="col-6">
                        <label className="x-small fw-bold text-danger">CD %</label>
                        <input type="number" className="form-control form-control-sm border-danger" value={cashDiscount} onChange={e => setCashDiscount(e.target.value)} />
                      </div>
                      <div className="col-6">
                        <label className="x-small fw-bold">Taxable Value (After CD)</label>
                        <div className="input-group input-group-sm">
                          <span className="input-group-text">₹</span>
                          <input type="text" className="form-control bg-light text-muted" readOnly value={taxableValue} />
                        </div>
                      </div>

                      <div className="col-12">
                        <div className="p-2 rounded-2 d-flex justify-content-between align-items-center my-1" style={{background:'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)', color:'#fff'}}>
                          <div className="d-flex flex-column">
                            <span className="fw-bold x-small">{scannedImeis.length > 1 ? `TOTAL FOR ${scannedImeis.length} PHONES:` : 'FINAL PURCHASE UNIT PRICE:'}</span>
                            <div className="d-flex gap-1 mt-1">
                              {['down','auto','up','exact'].map(m => (
                                <button key={m} type="button" onClick={() => setRoundingMode(m)}
                                  style={{
                                    background: roundingMode === m ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)',
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    color: '#fff', fontSize: '9px', padding: '1px 5px', borderRadius: '4px', cursor: 'pointer', fontWeight: 700, textTransform: 'capitalize'
                                  }}>
                                  {m === 'down' ? '▼' : m === 'up' ? '▲' : m === 'auto' ? 'A' : 'Exact'}
                                </button>
                              ))}
                            </div>
                          </div>
                          <span className="fw-bold">₹{batchTotal || '0.00'}</span>
                        </div>
                        {/* GST Breakdown */}
                        {rateIncTax && (
                          <div className="p-2 border rounded-2 bg-white mt-1 mb-2 shadow-sm animate-fade-in" style={{fontSize:'.62rem', fontWeight:600}}>
                            {scannedImeis.length > 1 ? (
                              <>
                                <div className="d-flex justify-content-between border-bottom pb-1 mb-1">
                                  <span className="text-muted">UNIT PRICE (EX-GST): ₹{taxableValue}</span>
                                  <div className="d-flex gap-3 align-items-center">
                                    {Math.abs(roundDiff) > 0 && (
                                      <span className={roundDiff > 0 ? 'text-success' : 'text-danger'} style={{fontSize:'9px'}}>
                                        Rounding: {roundDiff > 0 ? '+' : ''}{roundDiff.toFixed(2)}
                                      </span>
                                    )}
                                    <span className="text-muted">BATCH COUNT: {scannedImeis.length}</span>
                                  </div>
                                </div>
                                <div className="d-flex flex-wrap gap-x-3 gap-y-1 justify-content-between">
                                  <div className="text-muted">TOTAL TAXABLE: <span className="text-dark">₹{(taxableValueNum * scannedImeis.length).toFixed(2)}</span></div>
                                  <div className="text-primary d-flex gap-2">
                                    <span>CGST({(parseFloat(gstRate)/2).toFixed(1)}%): ₹{(taxableValueNum * scannedImeis.length * (parseFloat(gstRate)/200)).toFixed(2)}</span>
                                    <span>SGST({(parseFloat(gstRate)/2).toFixed(1)}%): ₹{(taxableValueNum * scannedImeis.length * (parseFloat(gstRate)/200)).toFixed(2)}</span>
                                  </div>
                                </div>
                              </>
                            ) : (
                              <div className="d-flex flex-wrap gap-x-3 gap-y-1 justify-content-between">
                                <div className="text-muted">BASE: <span className="text-dark">₹{rateExclTax}</span></div>
                                <div className="text-muted">TOTAL DISC: <span className="text-danger">-₹{(discountAmtNum + cashDiscAmtNum).toFixed(2)}</span></div>
                                <div className="text-muted">TAXABLE: <span className="text-dark">₹{taxableValue}</span></div>
                                {Math.abs(roundDiff) > 0 && (
                                  <div className={roundDiff > 0 ? 'text-success' : 'text-danger'} style={{fontSize:'9px', fontWeight:700}}>
                                    ROUNDING: {roundDiff > 0 ? '+' : ''}{roundDiff.toFixed(2)}
                                  </div>
                                )}
                                <div className="text-primary d-flex gap-2">
                                  <span>CGST: ₹{(gstAmtNum/2).toFixed(2)}</span>
                                  <span>SGST: ₹{(gstAmtNum/2).toFixed(2)}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="col-6">
                        <label className="x-small fw-bold text-success">MOP ₹</label>
                        <input type="number" className="form-control form-control-sm border-success fw-bold" value={sellingPrice} onChange={e => setSellingPrice(e.target.value)} />
                      </div>
                      <div className="col-6">
                        <label className="x-small fw-bold text-primary">Whole ₹</label>
                        <input type="number" className="form-control form-control-sm border-primary" value={wholesellerPrice} onChange={e => setWholesellerPrice(e.target.value)} />
                      </div>
                    </div>
                  </div>
                  <div className="bm-tip mt-2" style={{fontSize:'.65rem'}}>
                    <strong>📟 Tip:</strong> Click the IMEI box and use a physical scanner for high speed.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT SIDE: Entry List (Full Height Column) */}
          <div className="col-12 col-lg-4 p-3 d-flex flex-column" style={{background:'#f8fafc'}}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div className="bm-lbl mb-0">
                📋 Entry List&nbsp;
                <span className="badge rounded-pill" style={{background:'#6366f1',fontSize:'.7rem',padding:'3px 9px'}}>
                  {scannedImeis.length + batchItems.length}
                </span>
              </div>
              {(scannedImeis.length > 0 || batchItems.length > 0) && (
                <button className="btn btn-link btn-sm p-0 text-danger text-decoration-none" style={{fontSize:'.75rem'}}
                  onClick={() => { setScannedImeis([]); setBatchItems([]); }}>Clear</button>
              )}
            </div>

            <div className="bm-sc d-flex flex-column gap-2 flex-grow-1" style={{maxHeight:'480px', overflowY:'auto'}}>
              {batchItems.length > 0 && (
                <div className="px-2 py-1 rounded-3 mb-1" style={{background:'#e0e7ff',fontSize:'.68rem',color:'#6366f1',fontWeight:700}}>
                  ✅ {batchItems.length} phone(s) batched
                </div>
              )}
              {scannedImeis.length === 0 && batchItems.length === 0 ? (
                <div className="text-center py-5 text-muted my-auto">
                  <div style={{fontSize:'2.5rem',opacity:.3}}>📥</div>
                  <div className="fw-bold small">Waiting for IMEIs...</div>
                </div>
              ) : (
                [...scannedImeis].reverse().map((imei, idx) => (
                  <div key={idx} className="bm-pill">
                    <div className="d-flex align-items-center gap-2">
                      <span className="badge rounded-circle d-flex align-items-center justify-content-center"
                        style={{width:20,height:20,fontSize:'.6rem',background:'#6366f1'}}>{scannedImeis.length - idx}</span>
                      <code className="fw-bold text-dark" style={{fontSize:'.78rem'}}>{imei}</code>
                    </div>
                    <button type="button" className="btn-close" style={{transform:'scale(.65)'}}
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
          {isEdit ? '✅ Update Item' : `✅ Add ${scannedImeis.length + batchItems.length} Phone${(scannedImeis.length + batchItems.length)!==1?'s':''} to Purchase`}
        </Button>
      </Modal.Footer>

      <BarcodeScannerModal show={showScanner} continuous={true}
        onHide={() => setShowScanner(false)} onScanSuccess={handleAddImei} />
    </Modal>
  );
}
