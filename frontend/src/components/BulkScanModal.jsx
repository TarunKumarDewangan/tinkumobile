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
  const [cashDiscount, setCashDiscount] = useState('2');
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
  const mobileNewCatId = categories?.find(c => c.slug?.toLowerCase() === 'mobile-new')?.id
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
    setRateIncTax(''); setDiscountPct('3.85'); setCashDiscount('2'); setGstRate('18'); setRoundingMode('auto');
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
      unit_price: rateIncTax ? parseFloat(taxableValueNum.toFixed(2)) : (unitPrice || product?.purchase_price || 0),
      selling_price: sellingPrice || product?.selling_price || 0,
      wholeseller_price: wholesellerPrice || product?.wholeseller_price || 0,
      min_selling_price: minSellingPrice || product?.min_selling_price || 0,
      max_selling_price: rateIncTax ? parseFloat(finalAmountNum.toFixed(2)) : 0,
      incentive_amount: incentive || product?.incentive_amount || 0
    }));
    setBatchItems(prev => [...prev, ...newItems]);
    // Reset only product/IMEI part, keep modal open
    setScannedImeis([]); setSelectedProductId(''); setIsNew(false); setNewProductName('');
    setRam(''); setStorage(''); setColor(''); setSearchTerm(''); setShowDropdown(false);
    setUnitPrice(''); setSellingPrice(''); setWholesellerPrice('');
    setMinSellingPrice(''); setIncentive('');
    setRateIncTax(''); setDiscountPct('3.85'); setCashDiscount('2');
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
        unit_price: rateIncTax ? parseFloat(taxableValueNum.toFixed(2)) : (unitPrice || product?.purchase_price || 0),
        selling_price: sellingPrice || product?.selling_price || 0,
        wholeseller_price: wholesellerPrice || product?.wholeseller_price || 0,
        min_selling_price: minSellingPrice || product?.min_selling_price || 0,
        max_selling_price: rateIncTax ? parseFloat(finalAmountNum.toFixed(2)) : 0,
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
    .bm-modal-wide .modal-dialog{max-width:98vw !important;width:98vw !important;margin:1vh auto !important;}
    /* ── Modal Shell ── */
    .bm-hdr{background:linear-gradient(135deg,#0f172a 0%,#1e1b4b 60%,#312e81 100%);padding:20px 28px !important;}
    .bm-modal-body{background:#f8fafc;min-height:600px;}

    /* ── Step Badges ── */
    .bm-step-badge{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;font-size:.72rem;font-weight:800;flex-shrink:0;}
    .bm-step-badge.s1{background:#fef3c7;color:#d97706;}
    .bm-step-badge.s2{background:#dbeafe;color:#2563eb;}
    .bm-step-badge.s3{background:#dcfce7;color:#16a34a;}

    /* ── Section Headers ── */
    .bm-section-hdr{display:flex;align-items:center;gap:10px;padding:14px 20px;border-bottom:1px solid #e2e8f0;background:#fff;}
    .bm-section-title{font-size:.72rem;font-weight:800;letter-spacing:.8px;text-transform:uppercase;color:#374151;}
    .bm-section-sub{font-size:.63rem;color:#9ca3af;font-weight:500;}

    /* ── Brand Chips ── */
    .bm-chip{font-size:.72rem;padding:6px 14px;border-radius:24px;font-weight:700;cursor:pointer;transition:all .2s;border:1.5px solid #e2e8f0;background:#fff;line-height:1.5;white-space:nowrap;letter-spacing:.3px;}
    .bm-chip:hover{border-color:#6366f1;color:#6366f1;transform:translateY(-2px);box-shadow:0 4px 12px rgba(99,102,241,.15);}
    .bm-chip.act{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border-color:transparent;box-shadow:0 4px 12px rgba(99,102,241,.35);transform:translateY(-1px);}

    /* ── Labels ── */
    .bm-lbl{font-size:.65rem;font-weight:800;letter-spacing:.9px;text-transform:uppercase;color:#6b7280;margin-bottom:6px;display:flex;align-items:center;gap:6px;}

    /* ── Input Fields ── */
    .bm-inp{border:1.5px solid #e2e8f0 !important;border-radius:10px !important;padding:9px 12px !important;font-size:.85rem !important;font-weight:600 !important;background:#fff !important;transition:all .15s !important;color:#1e293b !important;}
    .bm-inp:focus{border-color:#6366f1 !important;box-shadow:0 0 0 3px rgba(99,102,241,.12) !important;outline:none !important;}
    .bm-inp-ro{background:#f1f5f9 !important;color:#64748b !important;}
    .bm-inp-lg{padding:12px 16px !important;font-size:.95rem !important;border-radius:12px !important;}

    /* ── Pricing Card ── */
    .bm-price-card{background:#fff;border-radius:16px;border:1.5px solid #e2e8f0;overflow:hidden;}
    .bm-price-card-hdr{background:linear-gradient(135deg,#f0f9ff,#e0f2fe);padding:12px 16px;border-bottom:1px solid #bae6fd;}
    .bm-price-row{display:flex;align-items:center;padding:6px 14px;border-bottom:1px solid #f1f5f9;gap:10px;}
    .bm-price-row:last-child{border-bottom:none;}
    .bm-price-lbl{font-size:.62rem;font-weight:800;letter-spacing:.7px;text-transform:uppercase;color:#6b7280;flex:1;}
    .bm-price-val{font-size:.88rem;font-weight:700;color:#1e293b;}
    .bm-price-input{border:1.5px solid #e2e8f0;border-radius:8px;padding:6px 10px;font-size:.82rem;font-weight:700;width:110px;text-align:right;background:#fff;color:#1e293b;transition:all .15s;}
    .bm-price-input:focus{border-color:#6366f1;outline:none;box-shadow:0 0 0 3px rgba(99,102,241,.1);}
    .bm-price-input.warn{border-color:#f59e0b !important;}
    .bm-price-input.danger{border-color:#ef4444 !important;}
    .bm-price-input.success{border-color:#10b981 !important;}
    .bm-price-input.primary{border-color:#6366f1 !important;}
    .bm-price-prefix{font-size:.8rem;font-weight:700;color:#6b7280;width:18px;}

    /* ── Total Banner ── */
    .bm-total-banner{background:linear-gradient(135deg,#4338ca,#6366f1,#8b5cf6);border-radius:14px;padding:16px 20px;color:#fff;}

    /* ── IMEI List ── */
    .bm-pill{display:flex;justify-content:space-between;align-items:center;background:#fff;border:1.5px solid #e0e7ff;border-radius:12px;padding:10px 16px;animation:bmIn .2s ease;box-shadow:0 2px 6px rgba(99,102,241,.06);}
    .bm-pill:hover{border-color:#6366f1;box-shadow:0 4px 12px rgba(99,102,241,.12);}

    /* ── Dropdown ── */
    .bm-item{padding:11px 16px;border-bottom:1px solid #f1f5f9;cursor:pointer;transition:background .12s;font-size:.83rem;}
    .bm-item:hover{background:#eef2ff;}
    .bm-item.sel{background:#6366f1;color:#fff;}

    /* ── IMEI Input ── */
    .bm-imei-input{border:2px solid #c7d2fe;border-radius:12px;padding:13px 16px;font-size:1rem;font-weight:700;background:#fff;width:100%;transition:all .18s;color:#1e293b;letter-spacing:.5px;}
    .bm-imei-input:focus{border-color:#6366f1;box-shadow:0 0 0 4px rgba(99,102,241,.15);outline:none;}

    /* ── Buttons ── */
    .bm-btn-primary{background:linear-gradient(135deg,#6366f1,#8b5cf6);border:none;color:#fff;font-weight:700;border-radius:10px;padding:10px 20px;font-size:.82rem;letter-spacing:.4px;cursor:pointer;transition:all .18s;}
    .bm-btn-primary:hover{opacity:.88;transform:translateY(-1px);}
    .bm-btn-primary:disabled{background:#cbd5e1;cursor:not-allowed;transform:none;}
    .bm-btn-outline{background:#fff;border:1.5px solid #e2e8f0;color:#374151;font-weight:700;border-radius:10px;padding:10px 20px;font-size:.82rem;cursor:pointer;transition:all .15s;}
    .bm-btn-outline:hover{border-color:#6366f1;color:#6366f1;}
    .bm-btn-cam{background:#f1f5f9;border:1.5px solid #e2e8f0;color:#475569;font-weight:700;border-radius:10px;padding:10px 16px;font-size:.82rem;cursor:pointer;transition:all .15s;}
    .bm-btn-cam:hover{background:#e0e7ff;border-color:#a5b4fc;color:#6366f1;}
    .bm-rounding-btn{border:1.5px solid rgba(255,255,255,.25);border-radius:8px;padding:3px 10px;font-size:.7rem;font-weight:700;cursor:pointer;color:#fff;transition:all .15s;background:rgba(255,255,255,.1);}
    .bm-rounding-btn.active{background:rgba(255,255,255,.3);border-color:rgba(255,255,255,.5);}

    /* ── Tip Box ── */
    .bm-tip{background:linear-gradient(135deg,#eff6ff,#dbeafe);border-radius:12px;padding:12px 16px;font-size:.75rem;border:1px solid #bfdbfe;}

    /* ── Scroller ── */
    .bm-sc::-webkit-scrollbar{width:4px;}
    .bm-sc::-webkit-scrollbar-thumb{background:#c7d2fe;border-radius:8px;}

    /* ── Attr inputs ── */
    .bm-attr-inp{border:1.5px solid #e2e8f0;border-radius:10px;padding:8px 12px;font-size:.8rem;font-weight:600;width:100%;background:#fff;color:#334155;transition:all .15s;}
    .bm-attr-inp:focus{border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.1);outline:none;}
    .bm-attr-lbl{font-size:.6rem;font-weight:800;letter-spacing:.7px;text-transform:uppercase;color:#94a3b8;margin-bottom:5px;display:block;}

    /* ── Animations ── */
    @keyframes bmIn{from{opacity:0;transform:translateY(-6px);}to{opacity:1;transform:translateY(0);}}
    .bm-tight{text-align:right;}
  `;

  const brandMatchesExact = allBrands.some(b => b.toLowerCase() === brandInput.toLowerCase());

  return (
    <Modal show={show} onHide={onHide} centered size="xl" backdrop="static" dialogClassName="bm-modal-wide">
      <style>{S}</style>

      <Modal.Header closeButton className="bm-hdr border-0">
        <Modal.Title className="text-white fw-bold d-flex align-items-center gap-3 w-100">
          <span style={{background:'rgba(255,255,255,.15)',borderRadius:14,padding:'10px 14px',fontSize:'1.4rem',lineHeight:1}}>📦</span>
          <div>
            <div style={{fontSize:'1.05rem',letterSpacing:.6,fontWeight:800}}>{isEdit ? '✏️ Edit Item' : 'Bulk IMEI / Serial Entry'}</div>
            <div style={{fontSize:'.72rem',opacity:.5,fontWeight:400,marginTop:2}}>
              {isEdit ? 'Update product details and pricing' : 'Select brand → model → scan or type IMEIs'}
            </div>
          </div>
          {scannedImeis.length > 0 && !isEdit && (
            <span className="ms-auto" style={{background:'rgba(99,102,241,.4)',border:'1.5px solid rgba(255,255,255,.25)',color:'#fff',fontSize:'.8rem',padding:'6px 16px',borderRadius:24,fontWeight:700,backdropFilter:'blur(4px)'}}>
              ✓ {scannedImeis.length} scanned
            </span>
          )}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body className="p-0 bm-modal-body">
        <div className="row g-0" style={{minHeight:600}}>

          {/* ══ LEFT PANEL ══ */}
          <div className="col-12 col-lg-8" style={{background:'#fff',borderRight:'1px solid #e2e8f0'}}>

            {/* STEP 1 — Brand */}
            <div className="bm-section-hdr">
              <span className="bm-step-badge s1">1</span>
              <div>
                <div className="bm-section-title">Select Brand / Company</div>
                <div className="bm-section-sub">Pick a manufacturer to filter models</div>
              </div>
            </div>
            <div style={{padding:'18px 20px 16px',borderBottom:'1px solid #e2e8f0'}}>
              <div className="d-flex flex-wrap gap-2 mb-4">
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
              <div className="row align-items-center g-3">
                <div className="col-md-6">
                  <div className="position-relative">
                    <div style={{position:'relative'}}>
                      <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',fontSize:'1rem'}}>🔍</span>
                      <input type="text" style={{paddingLeft:38,border:'1.5px solid #6366f1',borderRadius:10,padding:'10px 12px 10px 38px',width:'100%',fontSize:'.85rem',fontWeight:600,color:'#1e293b',background:'#fff',outline:'none'}}
                        placeholder="Or type a brand name..."
                        value={brandInput}
                        onFocus={() => setShowBrandDropdown(true)}
                        onChange={e => { setBrandInput(e.target.value); setShowBrandDropdown(true); }}
                        onKeyDown={e => e.key==='Enter' && handleAddCustomBrand()}
                        autoComplete="off" />
                    </div>
                    {showBrandDropdown && (
                      <div className="position-absolute w-100 bg-white border rounded-3 shadow-lg mt-1" style={{zIndex:1060,maxHeight:'200px',overflowY:'auto'}}>
                        {filteredBrandList.map(b => (
                          <div key={b} className={`bm-item fw-bold${selectedBrand.toLowerCase()===b.toLowerCase()?' sel':''}`} onClick={() => handleSelectBrand(b)}>{b}</div>
                        ))}
                        {brandInput && !brandMatchesExact && (
                          <div className="bm-item fw-bold text-primary" style={{background:'#f0f4ff'}} onClick={handleAddCustomBrand}>➕ Use "{brandInput}" as brand filter</div>
                        )}
                      </div>
                    )}
                    {showBrandDropdown && <div className="position-fixed top-0 start-0 w-100 h-100" style={{zIndex:1050}} onClick={() => setShowBrandDropdown(false)} />}
                  </div>
                </div>
                <div className="col-md-6">
                  {selectedBrand ? (
                    <div className="d-flex align-items-center gap-2" style={{background:'#f0fdf4',border:'1.5px solid #86efac',borderRadius:10,padding:'9px 14px'}}>
                      <span style={{fontSize:'1rem'}}>✅</span>
                      <span style={{fontWeight:700,color:'#15803d',fontSize:'.85rem'}}>{selectedBrand}</span>
                      <span style={{background:'#dcfce7',color:'#16a34a',fontSize:'.65rem',fontWeight:700,padding:'2px 8px',borderRadius:20,marginLeft:4}}>{filteredProducts.length} models</span>
                      <button type="button" onClick={() => { setSelectedBrand(''); setBrandInput(''); setSelectedProductId(''); setSearchTerm(''); }} style={{marginLeft:'auto',background:'none',border:'none',color:'#ef4444',fontWeight:700,cursor:'pointer',fontSize:'1rem',lineHeight:1}}>✕</button>
                    </div>
                  ) : (
                    <div style={{background:'#fafafa',border:'1.5px dashed #e2e8f0',borderRadius:10,padding:'9px 14px',color:'#9ca3af',fontSize:'.8rem'}}>💡 Select a brand above to filter models</div>
                  )}
                </div>
              </div>
            </div>

            {/* STEP 2 + 3 */}
            <div style={{padding:'0'}}>
              <div className="row g-0">
                {/* LEFT COL: Product + IMEI */}
                <div className="col-md-6" style={{padding:'20px',borderRight:'1px solid #f1f5f9'}}>

                  {/* Step 2 header */}
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <div className="d-flex align-items-center gap-2">
                      <span className="bm-step-badge s2">2</span>
                      <div>
                        <div className="bm-section-title" style={{fontSize:'.68rem'}}>PRODUCT INFO</div>
                      </div>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <label style={{fontSize:'.72rem',color:'#6b7280',fontWeight:600,cursor:'pointer'}}>New Product?</label>
                      <input className="form-check-input" type="checkbox" checked={isNew} onChange={e => setIsNew(e.target.checked)} style={{width:18,height:18,cursor:'pointer',accentColor:'#6366f1'}} />
                    </div>
                  </div>

                  {/* Product search / new input */}
                  {isNew ? (
                    <input type="text" style={{border:'1.5px solid #6366f1',borderRadius:10,padding:'11px 14px',width:'100%',fontSize:'.88rem',fontWeight:600,color:'#1e293b',background:'#f8f9ff',outline:'none',marginBottom:16}}
                      placeholder="Full model name (e.g. Vivo V70 Elite)"
                      value={newProductName} onChange={e => setNewProductName(e.target.value)} />
                  ) : (
                    <div className="position-relative" style={{marginBottom:16}}>
                      <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',fontSize:'1rem',zIndex:1}}>🔍</span>
                      <input type="text" style={{paddingLeft:38,border:'1.5px solid #3b82f6',borderRadius:10,padding:'11px 14px 11px 38px',width:'100%',fontSize:'.88rem',fontWeight:600,color:'#1e293b',background:'#fff',outline:'none'}}
                        placeholder={selectedBrand ? `Search ${selectedBrand} models...` : 'Search models...'}
                        value={searchTerm}
                        onFocus={() => setShowDropdown(true)}
                        onChange={e => setSearchTerm(e.target.value)}
                        autoComplete="off" />
                      {showDropdown && (
                        <div className="position-absolute w-100 bg-white border border-primary rounded-3 shadow-lg mt-1" style={{zIndex:1050,maxHeight:'230px',overflowY:'auto'}}>
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

                  {/* RAM / Storage / Color */}
                  <div className="row g-2" style={{marginBottom:12}}>
                    <div className="col-6">
                      <span className="bm-attr-lbl">RAM</span>
                      <input type="text" list="ramOptions" className="bm-attr-inp" placeholder="e.g. 8GB" value={ram} onChange={e => setRam(e.target.value)} />
                      <datalist id="ramOptions">{['2GB','4GB','6GB','8GB','12GB','16GB'].map(v => <option key={v} value={v} />)}</datalist>
                    </div>
                    <div className="col-6">
                      <span className="bm-attr-lbl">ROM (STORAGE)</span>
                      <input type="text" list="storageOptions" className="bm-attr-inp" placeholder="e.g. 128GB" value={storage} onChange={e => setStorage(e.target.value)} />
                      <datalist id="storageOptions">{['32GB','64GB','128GB','256GB','512GB'].map(v => <option key={v} value={v} />)}</datalist>
                    </div>
                  </div>
                  <div className="row g-2" style={{marginBottom:20}}>
                    <div className="col-12">
                      <span className="bm-attr-lbl">COLOR</span>
                      <input type="text" list="colorOptions" className="bm-attr-inp" placeholder="e.g. Blue / Starry Night" value={color} onChange={e => setColor(e.target.value)} />
                      <datalist id="colorOptions">{['Black','White','Blue','Gold','Silver'].map(v => <option key={v} value={v} />)}</datalist>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="d-flex align-items-center gap-2 mb-3">
                    <span className="bm-step-badge s3">3</span>
                    <div className="bm-section-title" style={{fontSize:'.68rem'}}>SCAN / TYPE IMEI</div>
                  </div>
                  <div style={{display:'flex',gap:8,marginBottom:12}}>
                    <input type="text" className="bm-imei-input" ref={manualInputRef}
                      placeholder="🔢  Scan or type IMEI here..."
                      value={manualImei} onChange={e => setManualImei(e.target.value)}
                      onKeyDown={e => e.key==='Enter' && handleManualAdd(e)} style={{flex:1}} />
                    <button onClick={handleManualAdd} disabled={!manualImei.trim()} className="bm-btn-primary" style={{padding:'10px 18px',fontSize:'1.1rem'}}>➕</button>
                  </div>
                  <div className="d-flex gap-2">
                    <button type="button" className="bm-btn-cam flex-grow-1" onClick={() => setShowScanner(true)}>📷 Camera Scan</button>
                    {!isEdit && (
                      <button type="button" className="bm-btn-primary flex-grow-1"
                        disabled={!scannedImeis.length || (isNew ? !newProductName : !selectedProductId)} onClick={handleAddAnother}>
                        ➕ Add Another Model
                      </button>
                    )}
                  </div>
                </div>

                {/* RIGHT COL: Pricing */}
                <div className="col-md-6" style={{padding:'20px',background:'#fafbff'}}>
                  <div className="bm-price-card">
                    <div className="bm-price-card-hdr">
                      <div style={{fontSize:'.65rem',fontWeight:800,letterSpacing:'.8px',textTransform:'uppercase',color:'#0369a1'}}>💰 Pricing Calculator</div>
                    </div>

                    <div className="bm-price-row">
                      <span className="bm-price-lbl">DP (Inc. GST)</span>
                      <div style={{display:'flex',alignItems:'center',gap:6}}>
                        <span className="bm-price-prefix">₹</span>
                        <input type="number" className="bm-price-input" value={rateIncTax} onChange={e => { setRateIncTax(e.target.value); setUnitPrice(e.target.value); }} placeholder="0" />
                      </div>
                    </div>

                    <div className="bm-price-row">
                      <span className="bm-price-lbl">GST Rate</span>
                      <select style={{border:'1.5px solid #e2e8f0',borderRadius:8,padding:'5px 10px',fontSize:'.8rem',fontWeight:700,color:'#1e293b',background:'#fff',cursor:'pointer'}} value={gstRate} onChange={e => setGstRate(e.target.value)}>
                        {[0,5,12,18,28].map(v => <option key={v} value={v}>{v}%</option>)}
                      </select>
                    </div>

                    <div className="bm-price-row" style={{background:'#f8fafc'}}>
                      <span className="bm-price-lbl" style={{color:'#94a3b8'}}>Base Ex-GST</span>
                      <span className="bm-price-val" style={{color:'#64748b'}}>₹{rateExclTax || '—'}</span>
                    </div>

                    <div className="bm-price-row" style={{flexWrap:'wrap'}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,flex:1}}>
                        <span className="bm-price-lbl" style={{color:'#d97706'}}>Trade Disc %</span>
                        <div style={{display:'flex',gap:4}}>
                          {['3.85','4.76','0'].map(p => (
                            <button key={p} type="button" onClick={() => setDiscountPct(p)} style={{background:discountPct===p?'#fef3c7':'#f1f5f9',border:discountPct===p?'1px solid #f59e0b':'1px solid #e2e8f0',color:discountPct===p?'#d97706':'#64748b',fontSize:'.65rem',fontWeight:700,padding:'2px 6px',borderRadius:6,cursor:'pointer',lineHeight:1}}>
                              {p}%
                            </button>
                          ))}
                        </div>
                      </div>
                      <input type="number" className="bm-price-input warn" value={discountPct} onChange={e => setDiscountPct(e.target.value)} placeholder="3.85" />
                    </div>

                    <div className="bm-price-row" style={{background:'#f8fafc'}}>
                      <span className="bm-price-lbl" style={{color:'#94a3b8'}}>After Discount</span>
                      <span className="bm-price-val" style={{color:'#64748b'}}>₹{priceAfterDisc || '—'}</span>
                    </div>

                    <div className="bm-price-row" style={{flexWrap:'wrap'}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,flex:1}}>
                        <span className="bm-price-lbl" style={{color:'#dc2626'}}>Cash Disc %</span>
                        <div style={{display:'flex',gap:4}}>
                          {['2','0'].map(p => (
                            <button key={p} type="button" onClick={() => setCashDiscount(p)} style={{background:cashDiscount===p?'#fee2e2':'#f1f5f9',border:cashDiscount===p?'1px solid #ef4444':'1px solid #e2e8f0',color:cashDiscount===p?'#dc2626':'#64748b',fontSize:'.65rem',fontWeight:700,padding:'2px 6px',borderRadius:6,cursor:'pointer',lineHeight:1}}>
                              {p}%
                            </button>
                          ))}
                        </div>
                      </div>
                      <input type="number" className="bm-price-input danger" value={cashDiscount} onChange={e => setCashDiscount(e.target.value)} placeholder="2" />
                    </div>

                    <div className="bm-price-row" style={{background:'#f8fafc'}}>
                      <span className="bm-price-lbl" style={{color:'#94a3b8'}}>Taxable Value</span>
                      <span className="bm-price-val" style={{color:'#64748b'}}>₹{taxableValue || '—'}</span>
                    </div>

                    <div className="bm-price-row">
                      <span className="bm-price-lbl" style={{color:'#16a34a'}}>MOP ₹</span>
                      <input type="number" className="bm-price-input success" value={sellingPrice} onChange={e => setSellingPrice(e.target.value)} placeholder="0" />
                    </div>

                    <div className="bm-price-row">
                      <span className="bm-price-lbl" style={{color:'#6366f1'}}>Wholesale ₹</span>
                      <input type="number" className="bm-price-input primary" value={wholesellerPrice} onChange={e => setWholesellerPrice(e.target.value)} placeholder="0" />
                    </div>
                  </div>

                  {/* Total Banner */}
                  <div className="bm-total-banner mt-3">
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                      <div>
                        <div style={{fontSize:'.62rem',fontWeight:700,opacity:.7,letterSpacing:'.5px',textTransform:'uppercase',marginBottom:4}}>
                          {scannedImeis.length > 1 ? `Total for ${scannedImeis.length} phones` : 'Final Purchase Price'}
                        </div>
                        <div style={{fontSize:'1.5rem',fontWeight:800,letterSpacing:'-0.5px'}}>₹{batchTotal || '0.00'}</div>
                        <div style={{fontSize:'.85rem',fontWeight:600,color:'#dbeafe',marginTop:2}}>
                          Taxable Total: ₹{(taxableValueNum * count).toFixed(2)}
                        </div>
                      </div>
                      <div style={{display:'flex',gap:4,flexDirection:'column',alignItems:'flex-end'}}>
                        <span style={{fontSize:'.6rem',opacity:.6,textTransform:'uppercase',letterSpacing:'.5px'}}>Rounding</span>
                        <div style={{display:'flex',gap:4}}>
                          {['down','auto','up','exact'].map(m => (
                            <button key={m} type="button" onClick={() => setRoundingMode(m)}
                              className={`bm-rounding-btn${roundingMode===m?' active':''}`}>
                              {m === 'down' ? '▼' : m === 'up' ? '▲' : m === 'auto' ? 'A' : 'Ex'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    {rateIncTax && (
                      <div style={{marginTop:10,paddingTop:10,borderTop:'1px solid rgba(255,255,255,.2)',fontSize:'.68rem',display:'flex',flexWrap:'wrap',gap:'6px 16px',opacity:.8}}>
                        <span>Base: ₹{(rateExclTaxNum * count).toFixed(2)}</span>
                        <span>Disc: -₹{((discountAmtNum + cashDiscAmtNum) * count).toFixed(2)}</span>
                        <span>CGST: ₹{((gstAmtNum * count) / 2).toFixed(2)}</span>
                        <span>SGST: ₹{((gstAmtNum * count) / 2).toFixed(2)}</span>
                        {Math.abs(roundDiff) > 0 && <span style={{color:'#fde68a'}}>Round: {roundDiff > 0 ? '+' : ''}{roundDiff.toFixed(2)}</span>}
                      </div>
                    )}
                  </div>

                  <div className="bm-tip mt-3">
                    <strong>📟 Tip:</strong> Click the IMEI box and use a physical USB/Bluetooth scanner for rapid entry.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ══ RIGHT PANEL: IMEI Entry List ══ */}
          <div className="col-12 col-lg-4 d-flex flex-column" style={{background:'#f8fafc',borderLeft:'1px solid #e2e8f0'}}>
            <div style={{padding:'16px 20px',borderBottom:'1px solid #e2e8f0',background:'#fff',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <span style={{fontSize:'1.1rem'}}>📋</span>
                <div>
                  <div style={{fontSize:'.7rem',fontWeight:800,letterSpacing:'.8px',textTransform:'uppercase',color:'#374151'}}>Entry List</div>
                  <div style={{fontSize:'.62rem',color:'#9ca3af'}}>Scanned devices</div>
                </div>
                <span style={{background:'#6366f1',color:'#fff',fontSize:'.72rem',fontWeight:700,padding:'3px 10px',borderRadius:20,marginLeft:4}}>
                  {scannedImeis.length + batchItems.length}
                </span>
              </div>
              {(scannedImeis.length > 0 || batchItems.length > 0) && (
                <button style={{background:'#fef2f2',border:'1.5px solid #fca5a5',color:'#ef4444',fontWeight:700,fontSize:'.72rem',borderRadius:8,padding:'5px 12px',cursor:'pointer'}}
                  onClick={() => { setScannedImeis([]); setBatchItems([]); }}>Clear All</button>
              )}
            </div>

            <div className="bm-sc d-flex flex-column gap-2 flex-grow-1" style={{padding:'16px 16px',overflowY:'auto',maxHeight:500}}>
              {batchItems.length > 0 && (
                <div style={{background:'#e0e7ff',borderRadius:10,padding:'8px 14px',fontSize:'.72rem',color:'#6366f1',fontWeight:700,display:'flex',alignItems:'center',gap:6}}>
                  ✅ <span>{batchItems.length} phone(s) committed to batch</span>
                </div>
              )}
              {scannedImeis.length === 0 && batchItems.length === 0 ? (
                <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',flex:1,opacity:.4,paddingTop:60}}>
                  <div style={{fontSize:'3rem',marginBottom:12}}>📥</div>
                  <div style={{fontWeight:700,fontSize:'.85rem',color:'#64748b'}}>Waiting for IMEIs</div>
                  <div style={{fontSize:'.72rem',color:'#94a3b8',marginTop:4}}>Scan or type to begin</div>
                </div>
              ) : (
                [...scannedImeis].reverse().map((imei, idx) => (
                  <div key={idx} className="bm-pill">
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <span style={{width:24,height:24,borderRadius:'50%',background:'linear-gradient(135deg,#6366f1,#8b5cf6)',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'.65rem',fontWeight:800,flexShrink:0}}>
                        {scannedImeis.length - idx}
                      </span>
                      <code style={{fontWeight:700,color:'#1e293b',fontSize:'.82rem',letterSpacing:'.3px'}}>{imei}</code>
                    </div>
                    <button type="button" style={{background:'#f1f5f9',border:'none',borderRadius:6,width:24,height:24,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#94a3b8',fontWeight:700,fontSize:'.8rem'}}
                      onClick={() => setScannedImeis(scannedImeis.filter(x => x !== imei))}>✕</button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </Modal.Body>

      <Modal.Footer style={{background:'#fff',borderTop:'1px solid #e2e8f0',padding:'16px 24px'}}>
        <button type="button" className="bm-btn-outline px-4" onClick={onHide}>Cancel</button>
        <button className="bm-btn-primary px-5"
          style={{background: (scannedImeis.length + batchItems.length) > 0 ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : '#cbd5e1', cursor: (scannedImeis.length + batchItems.length) === 0 ? 'not-allowed' : 'pointer', fontSize:'.88rem', padding:'11px 32px'}}
          disabled={(scannedImeis.length + batchItems.length) === 0}
          onClick={handleFinish}>
          {isEdit ? '✅ Update Item' : `✅ Add ${scannedImeis.length + batchItems.length} Phone${(scannedImeis.length + batchItems.length)!==1?'s':''} to Purchase`}
        </button>
      </Modal.Footer>

      <BarcodeScannerModal show={showScanner} continuous={true}
        onHide={() => setShowScanner(false)} onScanSuccess={handleAddImei} />
    </Modal>
  );
}
