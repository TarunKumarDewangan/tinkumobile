import { useState } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';
import BarcodeScannerModal from './BarcodeScannerModal';

export default function BulkScanModal({ show, onHide, products, categories, onAddItems }) {
  const [selectedProductId, setSelectedProductId] = useState('');
  const [scannedImeis, setScannedImeis] = useState([]);
  const [showScanner, setShowScanner] = useState(false);
  const [manualImei, setManualImei] = useState('');
  const [isNew, setIsNew] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [categoryId, setCategoryId] = useState(1);
  const [ram, setRam] = useState('');
  const [storage, setStorage] = useState('');
  const [color, setColor] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [minSellingPrice, setMinSellingPrice] = useState('');
  const [maxSellingPrice, setMaxSellingPrice] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const handleAddImei = (imei) => {
    if (imei && !scannedImeis.includes(imei)) {
      setScannedImeis(prev => [...prev, imei]);
    }
  };

  const handleManualAdd = (e) => {
    if (e) e.preventDefault();
    if (manualImei.trim()) {
      handleAddImei(manualImei.trim());
      setManualImei('');
    }
  };

  const handleFinish = () => {
    if (isNew && (!newProductName || !categoryId)) return;
    if (!isNew && !selectedProductId) return;
    
    // Find product to get default prices if existing
    const product = isNew ? null : products.find(p => p.id == selectedProductId);

    const items = scannedImeis.map(imei => ({
      product_id: isNew ? '' : selectedProductId,
      is_new: isNew,
      new_product_name: isNew ? newProductName : '',
      category_id: isNew ? categoryId : (product?.category_id || ''),
      imei: imei, 
      ram: ram, 
      storage: storage, 
      color: color, 
      quantity: 1, 
      unit_price: unitPrice || product?.purchase_price || 0,
      selling_price: sellingPrice || product?.selling_price || 0,
      min_selling_price: minSellingPrice || product?.min_selling_price || 0,
      max_selling_price: maxSellingPrice || product?.max_selling_price || 0
    }));

    onAddItems(items);
    
    // Reset state
    setScannedImeis([]);
    setSelectedProductId('');
    setIsNew(false);
    setNewProductName('');
    setCategoryId(1);
    setRam('');
    setStorage('');
    setColor('');
    setUnitPrice('');
    setSellingPrice('');
    setSearchTerm('');
    setMinSellingPrice('');
    setMaxSellingPrice('');
    setShowDropdown(false);
    onHide();
  };

  const handleProductChange = (id) => {
    setSelectedProductId(id);
    if (id) {
      const p = products.find(x => x.id == id);
      if (p) {
        setUnitPrice(p.purchase_price || '');
        setSellingPrice(p.selling_price || '');
        setMinSellingPrice(p.min_selling_price || '');
        setMaxSellingPrice(p.max_selling_price || '');
        if (p.attributes) {
          setRam(p.attributes.ram || '');
          setStorage(p.attributes.storage || '');
          setColor(p.attributes.color || '');
        }
      }
    } else {
      setUnitPrice('');
      setSellingPrice('');
      setMinSellingPrice('');
      setMaxSellingPrice('');
      setRam('');
      setStorage('');
      setColor('');
      setSearchTerm('');
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <Modal show={show} onHide={onHide} centered size="lg" backdrop="static">
      <Modal.Header closeButton className="bg-light">
        <Modal.Title className="fs-5">📦 Bulk IMEI / Serial Entry</Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-4">
        <div className="row g-4">
          <div className="col-12 col-md-5">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <Form.Label className="fw-bold text-dark small text-uppercase mb-0">1. Product Info</Form.Label>
              <div className="form-check form-switch p-0 m-0">
                <label className="form-check-label me-4 small text-muted">New Product?</label>
                <input className="form-check-input" type="checkbox" checked={isNew} onChange={e => setIsNew(e.target.checked)} />
              </div>
            </div>

            {isNew ? (
              <div className="row g-2 mb-4">
                <div className="col-12">
                  <input type="text" className="form-control shadow-sm" placeholder="Brand Model (e.g. Vivo V70 Elite)" 
                    value={newProductName} onChange={e => setNewProductName(e.target.value)} />
                  <div className="small text-muted mt-1 px-1">Adding to <strong>Mobile New</strong> category.</div>
                </div>
              </div>
            ) : (
              <Form.Group className="mb-4 position-relative">
                <div className="input-group input-group-sm mb-1">
                  <span className="input-group-text bg-white border-primary text-primary">🔍</span>
                  <input 
                    type="text" 
                    className="form-control border-primary shadow-sm" 
                    placeholder="Type to search product..." 
                    value={searchTerm}
                    onFocus={() => setShowDropdown(true)}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    autoComplete="off"
                  />
                  {searchTerm && (
                    <button className="btn btn-outline-secondary border-primary border-start-0" onClick={() => { setSearchTerm(''); handleProductChange(''); }}>✕</button>
                  )}
                </div>
                
                {showDropdown && (
                  <div className="position-absolute w-100 bg-white border border-primary rounded shadow-lg mt-1 searchable-dropdown" 
                    style={{ zIndex: 1050, maxHeight: '250px', overflowY: 'auto' }}>
                    {filteredProducts.length > 0 ? (
                      filteredProducts.map(p => (
                        <div key={p.id} 
                          className={`p-2 border-bottom dropdown-item-custom ${selectedProductId == p.id ? 'bg-primary text-white' : ''}`}
                          style={{ cursor: 'pointer' }}
                          onClick={() => {
                            handleProductChange(p.id);
                            setSearchTerm(p.name);
                            setShowDropdown(false);
                          }}
                        >
                          <div className="fw-bold small">{p.name}</div>
                          {p.sku && <div className={`${selectedProductId == p.id ? 'text-white-50' : 'text-muted'}`} style={{ fontSize: '10px' }}>SKU: {p.sku}</div>}
                        </div>
                      ))
                    ) : (
                      <div className="p-3 text-center text-muted small italic">No products found for "{searchTerm}"</div>
                    )}
                  </div>
                )}
                {/* Backdrop to close dropdown */}
                {showDropdown && <div className="position-fixed top-0 start-0 w-100 h-100" style={{ zIndex: 1040 }} onClick={() => setShowDropdown(false)}></div>}
              </Form.Group>
            )}

            <div className="row g-2 mb-2">
              <div className="col-6">
                <label className="small text-muted mb-1 px-1">Purchase Price (Buy)</label>
                <div className="input-group input-group-sm">
                  <span className="input-group-text p-1">₹</span>
                  <input type="number" className="form-control" step="0.01" placeholder="Buy Price" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} />
                </div>
              </div>
              <div className="col-6">
                <label className="small text-success mb-1 px-1">Selling Price</label>
                <div className="input-group input-group-sm">
                  <span className="input-group-text p-1 text-success">₹</span>
                  <input type="number" className="form-control border-success text-success fw-bold" step="0.01" placeholder="Sell Price" value={sellingPrice} onChange={e => setSellingPrice(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="row g-2 mb-2">
              <div className="col-6">
                <label className="small text-danger mb-1 px-1">Min Selling Price</label>
                <div className="input-group input-group-sm">
                  <span className="input-group-text p-1 text-danger">₹</span>
                  <input type="number" className="form-control border-danger text-danger" step="0.01" placeholder="Min Price" value={minSellingPrice} onChange={e => setMinSellingPrice(e.target.value)} />
                </div>
              </div>
              <div className="col-6">
                <label className="small text-info mb-1 px-1">Max Selling Price</label>
                <div className="input-group input-group-sm">
                  <span className="input-group-text p-1 text-info">₹</span>
                  <input type="number" className="form-control border-info text-info" step="0.01" placeholder="Max Price" value={maxSellingPrice} onChange={e => setMaxSellingPrice(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="row g-2 mb-4">
              <div className="col-4">
                <input type="text" className="form-control form-control-sm" placeholder="RAM" value={ram} onChange={e => setRam(e.target.value)} />
              </div>
              <div className="col-4">
                <input type="text" className="form-control form-control-sm" placeholder="Storage" value={storage} onChange={e => setStorage(e.target.value)} />
              </div>
              <div className="col-4">
                <input type="text" className="form-control form-control-sm" placeholder="Color" value={color} onChange={e => setColor(e.target.value)} />
              </div>
            </div>

            <div className="mb-4">
              <Form.Label className="fw-bold text-dark small text-uppercase">2. Manual Entry</Form.Label>
              <div className="input-group">
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Type IMEI/Serial..." 
                  value={manualImei}
                  onChange={e => setManualImei(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleManualAdd(e)}
                />
                <Button variant="outline-primary" onClick={handleManualAdd} disabled={!manualImei.trim()}>
                  ➕ Add
                </Button>
              </div>
            </div>

            <div className="d-grid mb-3">
              <Form.Label className="fw-bold text-dark small text-uppercase">OR</Form.Label>
              <Button 
                variant="primary" 
                size="lg" 
                className="py-3 shadow-sm"
                disabled={isNew ? (!newProductName || !categoryId) : !selectedProductId} 
                onClick={() => setShowScanner(true)}
              >
                📷 Start Continuous Scan
              </Button>
            </div>
            
            <p className="text-muted small">
              <span className="fw-bold">Pro Tip:</span> Hold the scanner steady. It will beep and add the IMEI to the list automatically. You can scan multiple boxes in one session.
            </p>
          </div>

          <div className="col-12 col-md-7 border-start">
            <div className="d-flex justify-content-between align-items-center mb-2 px-2">
              <label className="fw-bold text-dark small text-uppercase">3. Entry List ({scannedImeis.length})</label>
              {scannedImeis.length > 0 && (
                <button 
                  className="btn btn-link btn-sm text-danger text-decoration-none p-0"
                  onClick={() => setScannedImeis([])}
                >
                  Clear All
                </button>
              )}
            </div>

            <div 
              className="rounded-3 p-3 bg-light border inner-scroll" 
              style={{ minHeight: '260px', maxHeight: '260px', overflowY: 'auto' }}
            >
              {scannedImeis.length === 0 ? (
                <div className="text-center py-5">
                  <div className="fs-2 text-muted mb-2">📥</div>
                  <p className="text-muted small">No IMEIs scanned yet.<br/>Select a product and start scanning.</p>
                </div>
              ) : (
                <div className="row g-2">
                  {[...scannedImeis].reverse().map((imei, idx) => (
                    <div key={idx} className="col-12">
                      <div className="d-flex justify-content-between align-items-center bg-white border rounded-pill px-3 py-2 shadow-sm animate-fade-in">
                        <div className="d-flex align-items-center">
                          <span className="badge bg-primary rounded-circle me-2" style={{ width:20, height:20, display:'flex', alignItems:'center', justifyContent:'center' }}>
                            {scannedImeis.length - idx}
                          </span>
                          <code className="fw-bold text-dark fs-6">{imei}</code>
                        </div>
                        <button 
                           type="button" 
                           className="btn-close" 
                           style={{ padding: '0.25rem' }}
                           onClick={() => setScannedImeis(scannedImeis.filter(x => x !== imei))}
                        ></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer className="bg-light border-top-0">
        <Button variant="outline-secondary" className="px-4" onClick={onHide}>Cancel</Button>
        <Button 
          variant="success" 
          className="px-5 fw-bold shadow-sm"
          disabled={scannedImeis.length === 0 || (isNew ? (!newProductName || !categoryId) : !selectedProductId)} 
          onClick={handleFinish}
        >
          Add {scannedImeis.length} Phones to Form
        </Button>
      </Modal.Footer>

      <BarcodeScannerModal 
        show={showScanner} 
        continuous={true}
        onHide={() => setShowScanner(false)}
        onScanSuccess={handleAddImei}
      />

      <style>{`
        .animate-fade-in {
          animation: fadeIn 0.3s ease-in-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .inner-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .inner-scroll::-webkit-scrollbar-thumb {
          background: #ccc;
          border-radius: 10px;
        }
        .dropdown-item-custom:hover {
          background-color: #f8f9fa;
        }
        .dropdown-item-custom.bg-primary:hover {
          background-color: #0d6efd;
        }
        .cursor-pointer { cursor: pointer; }
        .btn-xs { padding: 1px 5px; font-size: 0.75rem; }
      `}</style>
    </Modal>
  );
}
