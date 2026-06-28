import React, { useState, useEffect } from 'react';
import { Modal } from 'react-bootstrap';
import api from '../api/axios';
import { toast } from 'react-toastify';

export default function SingleStockEntryModal({ show, onHide, baseProducts, categories, shops, onSuccess, category_group = 'new_mobile' }) {
  const [loading, setLoading] = useState(false);
  
  // Basic Info
  const [shopId, setShopId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  // Item Info
  const [isNew, setIsNew] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [newProductName, setNewProductName] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  
  // Product Search Dropdown
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  // Specs
  const [imei, setImei] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [ram, setRam] = useState('');
  const [storage, setStorage] = useState('');
  const [color, setColor] = useState('');

  // Pricing
  const [unitPrice, setUnitPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [wholesellerPrice, setWholesellerPrice] = useState('');
  const [maxSellingPrice, setMaxSellingPrice] = useState('');
  const [minSellingPrice, setMinSellingPrice] = useState('');
  const [incentiveAmount, setIncentiveAmount] = useState('');

  const BUILTIN_BRANDS = ['Vivo', 'Oppo', 'Samsung', 'Realme', 'Redmi', 'OnePlus', 'iPhone', 'Motorola', 'Nokia', 'Tecno', 'Itel'];

  // Initialize values
  useEffect(() => {
    if (show) {
      // Default to first shop or main shop
      const mainShop = shops.find(s => s.is_main) || shops[0];
      setShopId(mainShop ? mainShop.id : '');
      
      // Default to Category
      if (category_group === 'other') {
        const accessoryCat = categories.find(c => c.slug === 'accessory' || c.id == 3);
        setSelectedCategoryId(accessoryCat ? accessoryCat.id : (categories.filter(c => c.slug !== 'mobile-new' && c.slug !== 'mobile-old')[0]?.id || ''));
      } else {
        const newMobileCat = categories.find(c => c.slug === 'mobile-new' || c.name?.toLowerCase().includes('new'));
        setSelectedCategoryId(newMobileCat ? newMobileCat.id : (categories[0]?.id || ''));
      }

      // Reset item inputs
      setIsNew(false);
      setSelectedProductId('');
      setNewProductName('');
      setSelectedBrand('');
      setSearchTerm('');
      setImei('');
      setQuantity(1);
      setRam('');
      setStorage('');
      setColor('');
      setUnitPrice('');
      setSellingPrice('');
      setWholesellerPrice('');
      setMaxSellingPrice('');
      setMinSellingPrice('');
      setIncentiveAmount('');
      setNotes('');
      setDate(new Date().toISOString().split('T')[0]);
    }
  }, [show, shops, categories]);

  // Handle choosing product from list
  const handleProductChange = (id) => {
    setSelectedProductId(id);
    if (id) {
      const p = baseProducts.find(x => x.id == id);
      if (p) {
        setUnitPrice(p.purchase_price || '');
        setSellingPrice(p.selling_price || '');
        setWholesellerPrice(p.wholeseller_price || '');
        setMinSellingPrice(p.min_selling_price || '');
        setMaxSellingPrice(p.max_selling_price || '');
        setIncentiveAmount(p.incentive_amount || '');
        if (p.attributes) {
          setRam(p.attributes.ram || '');
          setStorage(p.attributes.storage || '');
          setColor(p.attributes.color || '');
        }
      }
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (isNew && !newProductName) {
      toast.error('Please enter product model name');
      return;
    }
    if (!isNew && !selectedProductId) {
      toast.error('Please choose a product');
      return;
    }
    if (!shopId) {
      toast.error('Please select target shop');
      return;
    }

    setLoading(true);
    try {
      // Finalize product name for new products
      const finalProductName = isNew 
        ? (selectedBrand ? `${selectedBrand} ${newProductName}`.trim() : newProductName).toUpperCase()
        : '';

      const payload = {
        items: [{
          product_id: isNew ? '' : selectedProductId,
          is_new: isNew,
          new_product_name: finalProductName,
          category_id: isNew ? selectedCategoryId : undefined,
          imei: imei ? imei.toUpperCase() : null,
          ram: ram ? ram.toUpperCase() : null,
          storage: storage ? storage.toUpperCase() : null,
          color: color ? color.toUpperCase() : null,
          quantity: quantity || 1,
          unit_price: unitPrice || 0,
          selling_price: sellingPrice || 0,
          wholeseller_price: wholesellerPrice || 0,
          min_selling_price: minSellingPrice || 0,
          max_selling_price: maxSellingPrice || 0,
          incentive_amount: incentiveAmount || 0
        }],
        shop_id: shopId,
        adjustment_date: date,
        notes: notes ? notes.toUpperCase() : 'SINGLE DIRECT STOCK ENTRY'
      };

      const res = await api.post('/stock-adjustments/bulk', payload);
      
      if (res.data.ignored_imeis && res.data.ignored_imeis.length > 0) {
        toast.warning(`Entry added, but skipped duplicate IMEI: ${res.data.ignored_imeis.join(', ')}`);
      } else {
        toast.success(res.data.message || '✅ Stock entry saved successfully!');
      }

      onSuccess && onSuccess();
      onHide();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save stock entry');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Filter base products
  const filteredProducts = baseProducts.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <Modal show={show} onHide={onHide} centered size="lg" backdrop="static">
      <Modal.Header closeButton style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff' }}>
        <Modal.Title className="fw-bold d-flex align-items-center gap-2">
          <span>📥</span> Direct Single Stock Entry
        </Modal.Title>
      </Modal.Header>

      <form onSubmit={handleSave}>
        <Modal.Body className="bg-light p-4" style={{ maxHeight: '78vh', overflowY: 'auto' }}>
          
          {/* GENERAL INFO */}
          <div className="card border-0 shadow-sm rounded-3 p-3 mb-3 bg-white">
            <h6 className="fw-bold text-success mb-3">📋 GENERAL INFORMATION</h6>
            <div className="row g-3">
              <div className="col-12 col-md-4">
                <label className="form-label small fw-bold text-muted text-uppercase">Target Shop/Branch *</label>
                <select className="form-select border-secondary-subtle" required value={shopId} onChange={e => setShopId(e.target.value)}>
                  <option value="">— SELECT SHOP —</option>
                  {shops.map(s => <option key={s.id} value={s.id}>{s.name.toUpperCase()} {s.is_main ? '⭐' : ''}</option>)}
                </select>
              </div>
              <div className="col-6 col-md-4">
                <label className="form-label small fw-bold text-muted text-uppercase">Stock Entry Date *</label>
                <input type="date" className="form-control border-secondary-subtle" required value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div className="col-6 col-md-4">
                <label className="form-label small fw-bold text-muted text-uppercase">General Notes</label>
                <input type="text" className="form-control border-secondary-subtle" placeholder="e.g. DIRECT STOCK ENTRY" value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
            </div>
          </div>

          {/* PRODUCT SELECTION */}
          <div className="card border-0 shadow-sm rounded-3 p-3 mb-3 bg-white">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="fw-bold text-success mb-0">📦 PRODUCT DETAILS</h6>
              <div className="d-flex align-items-center gap-2">
                <label className="small fw-bold text-muted cursor-pointer" htmlFor="is-new-check">New Product Model?</label>
                <input 
                  id="is-new-check"
                  type="checkbox" 
                  className="form-check-input"
                  checked={isNew} 
                  onChange={e => {
                    setIsNew(e.target.checked);
                    setSelectedProductId('');
                    setNewProductName('');
                    setSearchTerm('');
                  }}
                  style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#10b981' }} 
                />
              </div>
            </div>

            <div className="row g-3">
              {isNew ? (
                <>
                  <div className="col-12 col-md-4">
                    <label className="form-label small fw-bold text-muted text-uppercase">Brand / Company</label>
                    <select className="form-select border-secondary-subtle" value={selectedBrand} onChange={e => setSelectedBrand(e.target.value)}>
                      <option value="">— SELECT BRAND —</option>
                      {BUILTIN_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                      <option value="OTHER">OTHER / UNBRANDED</option>
                    </select>
                  </div>
                  <div className="col-12 col-md-4">
                    <label className="form-label small fw-bold text-muted text-uppercase">Model Name *</label>
                    <input 
                      type="text" 
                      className="form-control border-secondary-subtle fw-semibold"
                      placeholder="e.g. V70 Elite" 
                      required 
                      value={newProductName} 
                      onChange={e => setNewProductName(e.target.value)} 
                    />
                  </div>
                  <div className="col-12 col-md-4">
                    <label className="form-label small fw-bold text-muted text-uppercase">Category *</label>
                    <select className="form-select border-secondary-subtle" required value={selectedCategoryId} onChange={e => setSelectedCategoryId(e.target.value)}>
                      {categories
                        .filter(c => {
                          if (category_group === 'other') {
                            return c.slug !== 'mobile-new' && c.slug !== 'mobile-old';
                          } else {
                            return c.slug === 'mobile-new' || c.slug === 'mobile-old';
                          }
                        })
                        .map(c => <option key={c.id} value={c.id}>{c.name.toUpperCase()}</option>)
                      }
                    </select>
                  </div>
                </>
              ) : (
                <div className="col-12">
                  <label className="form-label small fw-bold text-muted text-uppercase">Choose Product *</label>
                  <div className="position-relative">
                    <input 
                      type="text" 
                      className="form-control border-secondary-subtle fw-semibold" 
                      placeholder="Type to search products..." 
                      value={searchTerm} 
                      onFocus={() => setShowDropdown(true)}
                      onChange={e => setSearchTerm(e.target.value)}
                      autoComplete="off"
                    />
                    {showDropdown && (
                      <div className="position-absolute w-100 bg-white border rounded-3 shadow mt-1" style={{ zIndex: 1050, maxHeight: '200px', overflowY: 'auto' }}>
                        {filteredProducts.length > 0 ? filteredProducts.map(p => (
                          <div 
                            key={p.id} 
                            className="p-2 border-bottom cursor-pointer hover-bg-light"
                            style={{ cursor: 'pointer' }}
                            onClick={() => {
                              handleProductChange(p.id);
                              setSearchTerm(p.name);
                              setShowDropdown(false);
                            }}
                          >
                            <div className="fw-bold small">{p.name}</div>
                            {p.sku && <span className="text-muted" style={{ fontSize: '10px' }}>SKU: {p.sku}</span>}
                          </div>
                        )) : <div className="p-3 text-center text-muted small">No products found</div>}
                      </div>
                    )}
                    {showDropdown && <div className="position-fixed top-0 start-0 w-100 h-100" style={{ zIndex: 1040 }} onClick={() => setShowDropdown(false)} />}
                  </div>
                </div>
              )}
            </div>

            <hr className="my-3 text-muted" />

            {/* SPECS & QUANTITY */}
            <div className="row g-3">
              <div className="col-12 col-md-5">
                <label className="form-label small fw-bold text-muted text-uppercase">
                  {category_group === 'other' ? 'Serial / Batch (Optional)' : 'IMEI / Serial Number'}
                </label>
                <input 
                  type="text" 
                  className="form-control border-secondary-subtle fw-bold" 
                  placeholder={category_group === 'other' ? 'ENTER SERIAL OR BATCH...' : 'IMEI/SN (Optional for non-mobiles)'} 
                  value={imei} 
                  onChange={e => setImei(e.target.value)} 
                />
              </div>
              <div className="col-4 col-md-2">
                <label className="form-label small fw-bold text-muted text-uppercase">Qty</label>
                <input 
                  type="number" 
                  className="form-control border-secondary-subtle text-center fw-bold" 
                  min="1" 
                  required 
                  value={quantity} 
                  onChange={e => setQuantity(parseInt(e.target.value) || 1)} 
                />
              </div>
              <div className="col-4 col-md-2">
                <label className="form-label small fw-bold text-muted text-uppercase">RAM</label>
                <input type="text" className="form-control border-secondary-subtle" placeholder="8GB" value={ram} onChange={e => setRam(e.target.value)} />
              </div>
              <div className="col-4 col-md-3">
                <label className="form-label small fw-bold text-muted text-uppercase">Storage</label>
                <input type="text" className="form-control border-secondary-subtle" placeholder="256GB" value={storage} onChange={e => setStorage(e.target.value)} />
              </div>
              <div className="col-12 col-md-4 mt-md-3">
                <label className="form-label small fw-bold text-muted text-uppercase">Color</label>
                <input type="text" className="form-control border-secondary-subtle" placeholder="MONSOON BLUE" value={color} onChange={e => setColor(e.target.value)} />
              </div>
            </div>
          </div>

          {/* PRICING DATA */}
          <div className="card border-0 shadow-sm rounded-3 p-3 bg-white">
            <h6 className="fw-bold text-success mb-3">💰 PRICING INFORMATION (₹)</h6>
            <div className="row g-3">
              <div className="col-6 col-md-4">
                <label className="form-label small fw-bold text-muted text-uppercase">DP (Purchase Price) ₹</label>
                <input type="number" step="0.01" className="form-control border-secondary-subtle fw-bold" placeholder="0.00" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} />
              </div>
              <div className="col-6 col-md-4">
                <label className="form-label small fw-bold text-success text-uppercase">MOP (Selling Price) ₹</label>
                <input type="number" step="0.01" className="form-control border-success fw-bold text-success" placeholder="0.00" value={sellingPrice} onChange={e => setSellingPrice(e.target.value)} />
              </div>
              <div className="col-6 col-md-4">
                <label className="form-label small fw-bold text-primary text-uppercase">Wholesale Price ₹</label>
                <input type="number" step="0.01" className="form-control border-primary fw-bold text-primary" placeholder="0.00" value={wholesellerPrice} onChange={e => setWholesellerPrice(e.target.value)} />
              </div>
              <div className="col-6 col-md-4">
                <label className="form-label small fw-bold text-muted text-uppercase">Cust Max Price ₹</label>
                <input type="number" step="0.01" className="form-control border-secondary-subtle" placeholder="0.00" value={maxSellingPrice} onChange={e => setMaxSellingPrice(e.target.value)} />
              </div>
              <div className="col-6 col-md-4">
                <label className="form-label small fw-bold text-danger text-uppercase">Min Selling Price ₹</label>
                <input type="number" step="0.01" className="form-control border-danger" placeholder="0.00" value={minSellingPrice} onChange={e => setMinSellingPrice(e.target.value)} />
              </div>
              <div className="col-6 col-md-4">
                <label className="form-label small fw-bold text-muted text-uppercase">Company Incentive ₹</label>
                <input type="number" step="0.01" className="form-control border-secondary-subtle" placeholder="0.00" value={incentiveAmount} onChange={e => setIncentiveAmount(e.target.value)} />
              </div>
            </div>
          </div>

        </Modal.Body>

        <Modal.Footer className="bg-white p-3">
          <button type="button" className="btn btn-outline-secondary px-4 py-2" onClick={onHide}>Cancel</button>
          <button type="submit" disabled={loading} className="btn btn-success px-5 py-2 fw-bold shadow-sm">
            {loading ? <span className="spinner-border spinner-border-sm me-2" /> : '✅ Direct Save to Stock'}
          </button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}
