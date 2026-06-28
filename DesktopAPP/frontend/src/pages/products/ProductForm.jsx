import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';

// ── Per-category attribute schemas ─────────────────────────────────────────
const CATEGORY_SCHEMAS = {
  'mobile-new': {
    label: '📱 Mobile Phone Details',
    fields: [
      { key: 'brand',   label: 'Brand',   type: 'text', placeholder: 'e.g. Samsung, Apple, Vivo' },
      { key: 'model',   label: 'Model',   type: 'text', placeholder: 'e.g. Galaxy A54, iPhone 15 Pro' },
      { key: 'storage', label: 'Storage', type: 'select', options: ['16GB','32GB','64GB','128GB','256GB','512GB','1TB'] },
      { key: 'ram',     label: 'RAM',     type: 'select', options: ['2GB','3GB','4GB','6GB','8GB','12GB','16GB'] },
      { key: 'color',   label: 'Color',   type: 'text', placeholder: 'e.g. Black, Midnight Blue, Gold' },
      { key: 'battery', label: 'Battery', type: 'text', placeholder: 'e.g. 5000mAh' },
      { key: 'network', label: 'Network', type: 'select', options: ['4G','5G','3G','2G'] },
      { key: 'display', label: 'Display', type: 'text', placeholder: 'e.g. 6.4" AMOLED 120Hz' },
      { key: 'camera',  label: 'Camera',  type: 'text', placeholder: 'e.g. 50MP + 12MP + 10MP' },
      { key: 'os',      label: 'OS',      type: 'text', placeholder: 'e.g. Android 14, iOS 17' },
      { key: 'warranty',label: 'Warranty',type: 'text', placeholder: 'e.g. 1 Year Brand Warranty' },
      { key: 'sim',     label: 'SIM Type',type: 'select', options: ['Dual SIM','Single SIM','Dual SIM + eSIM'] },
    ]
  },
  'mobile-old': {
    label: '🔄 Used Phone Details',
    fields: [
      { key: 'brand',     label: 'Brand',         type: 'text', placeholder: 'e.g. Samsung, Realme' },
      { key: 'model',     label: 'Model',         type: 'text', placeholder: 'e.g. Redmi Note 10' },
      { key: 'storage',   label: 'Storage',       type: 'select', options: ['16GB','32GB','64GB','128GB','256GB'] },
      { key: 'ram',       label: 'RAM',           type: 'select', options: ['2GB','3GB','4GB','6GB','8GB'] },
      { key: 'color',     label: 'Color',         type: 'text', placeholder: 'e.g. Black' },
      { key: 'network',   label: 'Network',       type: 'select', options: ['4G','5G','3G'] },
      { key: 'grade',     label: 'Grade / Condition', type: 'select', options: ['Like New','Good','Fair','Poor'] },
      { key: 'scratches', label: 'Scratches',     type: 'select', options: ['None','Minor','Moderate','Heavy'] },
      { key: 'battery_health', label: 'Battery Health %', type: 'text', placeholder: 'e.g. 85%' },
      { key: 'issues',    label: 'Known Issues',  type: 'text', placeholder: 'e.g. Cracked back, button stiff' },
      { key: 'purchased_from', label: 'Purchased From', type: 'text', placeholder: 'Customer name or source' },
    ]
  },
  'accessory': {
    label: '🔌 Accessory Details',
    fields: [
      { key: 'brand',           label: 'Brand',             type: 'text', placeholder: 'e.g. boAt, Anker, Belkin' },
      { key: 'type',            label: 'Type',              type: 'select', options: ['Charger','Cable','Earphones','Cover/Case','Tempered Glass','Power Bank','Bluetooth Speaker','Headphones','Smart Watch Band','OTG Adapter','Memory Card','Pop Socket','Other'] },
      { key: 'color',           label: 'Color',             type: 'text', placeholder: 'e.g. Black, White' },
      { key: 'compatible_with', label: 'Compatible With',   type: 'text', placeholder: 'e.g. iPhone 14/15, Samsung A54, Universal' },
      { key: 'port',            label: 'Port / Connector',  type: 'select', options: ['USB-C','Lightning','Micro USB','USB-A','3.5mm Jack','Universal'] },
      { key: 'watt',            label: 'Power / Watt',      type: 'text', placeholder: 'e.g. 65W, 18W' },
      { key: 'capacity',        label: 'Capacity / Length', type: 'text', placeholder: 'e.g. 10000mAh, 1m cable' },
      { key: 'warranty',        label: 'Warranty',          type: 'text', placeholder: 'e.g. 6 Months, No Warranty' },
    ]
  },
  'sim': {
    label: '📶 SIM Card Details',
    fields: [
      { key: 'operator',  label: 'Operator',  type: 'select', options: ['Jio','Airtel','Vi','BSNL','Other'] },
      { key: 'plan',      label: 'Plan Type', type: 'select', options: ['Prepaid','Postpaid'] },
      { key: 'size',      label: 'SIM Size',  type: 'select', options: ['Nano','Micro','Standard'] },
      { key: 'offer',     label: 'Offer',     type: 'text', placeholder: 'e.g. 2GB/day for 84 days' },
      { key: 'validity',  label: 'Validity',  type: 'text', placeholder: 'e.g. 84 days, 1 year' },
    ]
  },
  'recharge': {
    label: '⚡ Recharge Details',
    fields: [
      { key: 'operator', label: 'Operator',    type: 'select', options: ['Jio','Airtel','Vi','BSNL','DTH','Other'] },
      { key: 'type',     label: 'Recharge Type', type: 'select', options: ['Mobile Prepaid','Mobile Postpaid','DTH','Data Card','Other'] },
      { key: 'validity', label: 'Validity',     type: 'text', placeholder: 'e.g. 28 days, 84 days' },
      { key: 'data',     label: 'Data',         type: 'text', placeholder: 'e.g. 2GB/day, Unlimited' },
    ]
  },
  'repair-service': {
    label: '🔧 Repair Service Details',
    fields: [
      { key: 'service_type',   label: 'Service Type',  type: 'select', options: ['Screen Replacement','Battery Replacement','Back Panel','Charging Port','Speaker','Mic','Camera','Software Fix','Water Damage','Other'] },
      { key: 'compatible_with',label: 'For Device',    type: 'text', placeholder: 'e.g. iPhone 13, Samsung S21' },
      { key: 'part_quality',  label: 'Part Quality',   type: 'select', options: ['Original','OEM','Compatible'] },
      { key: 'warranty',      label: 'Service Warranty', type: 'text', placeholder: 'e.g. 30 days, 3 months' },
      { key: 'time_required', label: 'Time Required',  type: 'text', placeholder: 'e.g. 30 mins, 2 hours, 1 day' },
    ]
  },
  'laptop': {
    label: '💻 Laptop Details',
    fields: [
      { key: 'brand',     label: 'Brand',         type: 'text', placeholder: 'e.g. HP, Dell, Lenovo, Apple' },
      { key: 'model',     label: 'Model / Series', type: 'text', placeholder: 'e.g. Pavilion 15, Inspiron 14' },
      { key: 'processor', label: 'Processor',     type: 'text', placeholder: 'e.g. Core i5 12th Gen, Ryzen 5 5600U' },
      { key: 'storage',   label: 'Storage',       type: 'select', options: ['128GB SSD','256GB SSD','512GB SSD','1TB SSD','2TB SSD','1TB HDD'] },
      { key: 'ram',       label: 'RAM',           type: 'select', options: ['4GB','8GB','16GB','32GB','64GB'] },
      { key: 'color',     label: 'Color',         type: 'text', placeholder: 'e.g. Platinum Silver, Space Gray' },
      { key: 'os',        label: 'OS',            type: 'select', options: ['Windows 11','Windows 10','macOS','Ubuntu / Linux','DOS'] },
      { key: 'display',   label: 'Display Size',  type: 'select', options: ['13.3"','14"','15.6"','16"','17.3"'] },
      { key: 'gpu',       label: 'Graphics (GPU)', type: 'text', placeholder: 'e.g. Intel Iris Xe, RTX 3050' },
      { key: 'warranty',  label: 'Warranty',      type: 'text', placeholder: 'e.g. 1 Year Brand Warranty' },
    ]
  },
  'tablet': {
    label: '📟 Tablet Details',
    fields: [
      { key: 'brand',     label: 'Brand',         type: 'text', placeholder: 'e.g. Apple, Samsung, Lenovo' },
      { key: 'model',     label: 'Model',         type: 'text', placeholder: 'e.g. iPad Air 5, Galaxy Tab S9' },
      { key: 'storage',   label: 'Storage',       type: 'select', options: ['32GB','64GB','128GB','256GB','512GB','1TB'] },
      { key: 'ram',       label: 'RAM',           type: 'select', options: ['2GB','3GB','4GB','6GB','8GB','12GB','16GB'] },
      { key: 'color',     label: 'Color',         type: 'text', placeholder: 'e.g. Space Gray, Silver' },
      { key: 'display',   label: 'Display Size',  type: 'text', placeholder: 'e.g. 10.9", 11", 12.4"' },
      { key: 'network',   label: 'Connectivity',  type: 'select', options: ['Wi-Fi Only','Wi-Fi + Cellular (LTE/55G)'] },
      { key: 'os',        label: 'OS',            type: 'text', placeholder: 'e.g. iPadOS 17, Android 13' },
      { key: 'warranty',  label: 'Warranty',      type: 'text', placeholder: 'e.g. 1 Year Brand Warranty' },
    ]
  },
};

export default function ProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const category_group = searchParams.get('category_group');
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [selectedCatSlug, setSelectedCatSlug] = useState('');
  const [form, setForm] = useState({
    purchase_price: '', selling_price: '', wholeseller_price: '',
    min_selling_price: '', max_selling_price: '', incentive_amount: '',
    condition: 'new', sku: '', name: '', imei: '', category_id: '', shop_id: '',
    subcategory: ''
  });
  const [attrs, setAttrs] = useState({});
  const [location, setLocation] = useState('');

  // Accessory/Other category specific states
  const [customCategoryName, setCustomCategoryName] = useState('');
  const [customSubcategory, setCustomSubcategory] = useState('');
  const [brandToggle, setBrandToggle] = useState(false);
  const [gstToggle, setGstToggle] = useState(false);
  const [currentStock, setCurrentStock] = useState(0);
  const [shops, setShops] = useState([]);

  const { user, isOwner, hasFullAccess } = useAuth();
  const schema = CATEGORY_SCHEMAS[selectedCatSlug] || null;

  const filteredCategories = categories.filter(c => {
    const slug = c.slug?.toLowerCase() || '';
    if (category_group === 'other') {
      return slug !== 'mobile-new' && slug !== 'mobile-old';
    }
    if (category_group === 'new_mobile') {
      return slug === 'mobile-new';
    }
    if (category_group === 'old_mobile') {
      return slug === 'mobile-old';
    }
    return true;
  });

  useEffect(() => {
    api.get('/categories').then(r => {
      setCategories(r.data);
      if (!id && category_group === 'other') {
        const acc = r.data.find(c => c.slug?.toLowerCase() === 'accessory');
        if (acc) {
          setForm(f => ({ ...f, category_id: acc.id }));
          setSelectedCatSlug('accessory');
        }
      }
    });
    api.get('/subcategories').then(r => setSubcategories(r.data));
  }, [id, category_group]);

  useEffect(() => {
    if (hasFullAccess()) {
      api.get('/shops').then(r => setShops(r.data));
    }
  }, [hasFullAccess]);

  useEffect(() => {
    if (user && !form.shop_id) {
      setForm(f => ({ ...f, shop_id: user.shop_id || '' }));
    }
  }, [user]);

  useEffect(() => {
    if (id) {
      api.get(`/products/${id}`).then(r => {
        const p = r.data;
        setForm({
          category_id: p.category_id, name: p.name, sku: p.sku, imei: p.imei || '',
          purchase_price: p.purchase_price, selling_price: p.selling_price,
          wholeseller_price: p.wholeseller_price || '',
          min_selling_price: p.min_selling_price || '',
          max_selling_price: p.max_selling_price || '',
          incentive_amount: p.incentive_amount || '',
          condition: p.condition,
          subcategory: p.subcategory || ''
        });
        setAttrs(p.attributes || {});
        setLocation(p.location || '');
        if (p.attributes) {
          if (p.attributes.brand) setBrandToggle(true);
          if (p.attributes.gst_rate) setGstToggle(true);
        }
      });
    }
  }, [id]);

  useEffect(() => {
    if (categories.length > 0 && form.category_id) {
      const cat = categories.find(c => c.id == form.category_id);
      if (cat) setSelectedCatSlug(cat.slug?.toLowerCase() || '');
    }
  }, [categories, form.category_id]);

  const handleCategoryChange = (e) => {
    const catId = e.target.value;
    if (catId === 'NEW_CAT') {
      setForm(f => ({ ...f, category_id: catId }));
      setSelectedCatSlug('');
      return;
    }
    const cat = categories.find(c => c.id == catId);
    setForm(f => ({ ...f, category_id: catId }));
    setSelectedCatSlug(cat?.slug?.toLowerCase() || '');
    setAttrs({}); // reset attrs on category change
    setBrandToggle(false);
    setGstToggle(false);
  };

  const setAttr = (key, val) => setAttrs(prev => ({ ...prev, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    let finalCategoryId = form.category_id;

    try {
      if (finalCategoryId === 'NEW_CAT') {
        if (!customCategoryName || !customCategoryName.trim()) {
          toast.error("Please enter a category name");
          return;
        }
        const catRes = await api.post('/categories', { name: customCategoryName.trim() });
        finalCategoryId = catRes.data.id;
        toast.success(`Category "${customCategoryName}" created!`);
      }

      let finalSku = form.sku;
      if (category_group === 'other' && !finalSku) {
        const cleanName = form.name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-');
        const cleanBrand = attrs.brand ? attrs.brand.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-') : 'ACC';
        finalSku = `${cleanBrand}-${cleanName}-${Math.floor(1000 + Math.random() * 9000)}`;
      }

      const cleanAttrs = Object.fromEntries(
        Object.entries(attrs).filter(([, v]) => v !== undefined && v !== null && v !== '')
      );

      // Clean toggles for category_group === 'other'
      if (category_group === 'other') {
        if (!brandToggle) delete cleanAttrs.brand;
        if (!gstToggle) delete cleanAttrs.gst_rate;
      }

      let finalSubcategory = form.subcategory;
      if (selectedCatSlug === 'accessory') {
        if (finalSubcategory === 'OTHER') {
          if (!customSubcategory || !customSubcategory.trim()) {
            toast.error("Please enter a subcategory name");
            return;
          }
          finalSubcategory = customSubcategory.trim().toUpperCase();
        }
      } else {
        finalSubcategory = null;
      }

      const payload = {
        ...form,
        category_id: finalCategoryId,
        sku: finalSku,
        attributes: cleanAttrs,
        location,
        subcategory: finalSubcategory
      };

      let createdProduct;
      if (id) {
        const res = await api.put(`/products/${id}`, payload);
        createdProduct = res.data;
      } else {
        const res = await api.post('/products', payload);
        createdProduct = res.data;
      }

      if (!id && category_group === 'other' && currentStock > 0) {
        const targetShopId = hasFullAccess() && form.shop_id ? form.shop_id : (user.shop_id || 1);
        await api.post('/stock-adjustments', {
          product_id: createdProduct.id,
          shop_id: targetShopId,
          type: 'add',
          quantity: currentStock,
          reason: 'opening_stock',
          purchase_price: form.purchase_price,
          adjustment_date: new Date().toISOString().slice(0, 10),
          notes: 'Opening Stock via Product Entry'
        });
      }

      toast.success(id ? '✅ Product updated!' : '✅ Product created!');
      navigate(category_group ? `/products?category_group=${category_group}` : '/products');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error saving product');
    }
  };

  const profit = form.selling_price && form.purchase_price
    ? (parseFloat(form.selling_price) - parseFloat(form.purchase_price)).toFixed(2)
    : null;
  const margin = profit && form.purchase_price > 0
    ? ((profit / form.purchase_price) * 100).toFixed(1)
    : null;

  const renderAttrField = (field) => {
    const val = attrs[field.key] || '';
    if (field.type === 'select') {
      return (
        <select key={field.key} className="form-select" value={val} onChange={e => setAttr(field.key, e.target.value)}>
          <option value="">— Select —</option>
          {field.options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    return (
      <input key={field.key} className="form-control" placeholder={field.placeholder}
        value={val} onChange={e => setAttr(field.key, e.target.value)} />
    );
  };

  // ── Layout 1: Accessory & Other products layout ──────────────────────────
  if (category_group === 'other') {
    const pPrice = parseFloat(form.purchase_price) || 0;
    const sPrice = parseFloat(form.selling_price) || 0;
    const calcProfit = sPrice - pPrice;
    const calcMargin = sPrice ? ((calcProfit / sPrice) * 100) : 0;

    return (
      <div>
        <div className="page-header">
          <h2>📦 {id ? '✏️ Edit' : '➕ Add'} Other Product / Accessory</h2>
          <button type="button" onClick={() => navigate('/products?category_group=other')} className="btn btn-outline-secondary btn-sm">← Back</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-card mb-3">
            <div className="form-card-title">📦 Product Information</div>
            <div className="row g-3">
              {/* Category selector */}
              <div className="col-12 col-md-6">
                <label className="form-label fw-semibold">Category <span className="text-danger">*</span></label>
                <select className="form-select" required value={form.category_id} onChange={handleCategoryChange}>
                  <option value="">Select category</option>
                  {filteredCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  <option value="NEW_CAT">+ Other (Add Custom Category)...</option>
                </select>
              </div>

              {/* Enter Category Name (only if NEW_CAT selected) */}
              {form.category_id === 'NEW_CAT' && (
                <div className="col-12 col-md-6">
                  <label className="form-label fw-semibold">Enter Category Name <span className="text-danger">*</span></label>
                  <input className="form-control" required placeholder="e.g. Charger, Tempered Glass, SIM Card"
                    value={customCategoryName} onChange={e => setCustomCategoryName(e.target.value)} />
                </div>
              )}

              {/* Subcategory selector for Accessory category */}
              {selectedCatSlug === 'accessory' && (
                <>
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-semibold">Subcategory <span className="text-danger">*</span></label>
                    <select className="form-select" required value={form.subcategory} onChange={e => setForm({ ...form, subcategory: e.target.value })}>
                      <option value="">Select subcategory</option>
                      {subcategories.map(sub => (
                        <option key={sub.id} value={sub.name}>{sub.name}</option>
                      ))}
                      <option value="OTHER">+ Other (Add Custom Subcategory)...</option>
                    </select>
                  </div>

                  {form.subcategory === 'OTHER' && (
                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold">Enter Subcategory Name <span className="text-danger">*</span></label>
                      <input className="form-control" required placeholder="e.g. Neck Band, Charger, USB Cable"
                        value={customSubcategory} onChange={e => setCustomSubcategory(e.target.value)} />
                    </div>
                  )}
                </>
              )}

              {/* Brand Toggle */}
              <div className="col-12">
                <div className="form-check form-switch mt-2">
                  <input className="form-check-input" type="checkbox" id="brandToggle" checked={brandToggle} onChange={e => {
                    setBrandToggle(e.target.checked);
                    if (!e.target.checked) setAttr('brand', '');
                  }} />
                  <label className="form-check-label fw-semibold" htmlFor="brandToggle">Product has Brand</label>
                </div>
              </div>

              {/* Brand Name Input */}
              {brandToggle && (
                <div className="col-12 col-md-6">
                  <label className="form-label fw-semibold">Brand Name <span className="text-danger">*</span></label>
                  <input className="form-control" required={brandToggle} placeholder="e.g. Samsung / Boat / Portronics"
                    value={attrs.brand || ''} onChange={e => setAttr('brand', e.target.value)} />
                </div>
              )}

              {/* Product Name */}
              <div className="col-12 col-md-6">
                <label className="form-label fw-semibold">Product Name <span className="text-danger">*</span></label>
                <input className="form-control" required placeholder="e.g. 25W Fast Charger, Jio 5G SIM"
                  value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>

              {/* Purchase Price */}
              <div className="col-12 col-md-6">
                <label className="form-label fw-semibold">Purchase Price ₹ <span className="text-danger">*</span></label>
                <div className="input-group">
                  <span className="input-group-text">₹</span>
                  <input className="form-control" type="number" step="0.01" required min="0" placeholder="0"
                    id="purchase" value={form.purchase_price || ''} onChange={e => setForm({ ...form, purchase_price: e.target.value })} />
                </div>
              </div>

              {/* Selling Price */}
              <div className="col-12 col-md-6">
                <label className="form-label fw-semibold text-success">Selling Price ₹ <span className="text-danger">*</span></label>
                <div className="input-group">
                  <span className="input-group-text text-success">₹</span>
                  <input className="form-control border-success text-success fw-bold" type="number" step="0.01" required min="0" placeholder="0"
                    id="selling" value={form.selling_price || ''} onChange={e => setForm({ ...form, selling_price: e.target.value })} />
                </div>
              </div>

              {/* GST Toggle */}
              <div className="col-12">
                <div className="form-check form-switch mt-2">
                  <input className="form-check-input" type="checkbox" id="gstToggle" checked={gstToggle} onChange={e => {
                    setGstToggle(e.target.checked);
                    if (e.target.checked && !attrs.gst_rate) {
                      setAttr('gst_rate', '18%');
                    } else if (!e.target.checked) {
                      setAttr('gst_rate', '');
                    }
                  }} />
                  <label className="form-check-label fw-semibold" htmlFor="gstToggle">Apply GST</label>
                </div>
              </div>

              {/* GST rate dropdown */}
              {gstToggle && (
                <div className="col-12 col-md-6">
                  <label className="form-label fw-semibold">GST % <span className="text-danger">*</span></label>
                  <select className="form-select" required value={attrs.gst_rate || '18%'} onChange={e => setAttr('gst_rate', e.target.value)}>
                    <option value="0%">0%</option>
                    <option value="5%">5%</option>
                    <option value="12%">12%</option>
                    <option value="18%">18%</option>
                    <option value="28%">28%</option>
                  </select>
                </div>
              )}

              {/* Current Stock (only on create) */}
              {!id && (
                <div className="col-12 col-md-6">
                  <label className="form-label fw-semibold">Current Stock (Opening Stock)</label>
                  <input className="form-control" type="number" min="0" placeholder="0"
                    value={currentStock} onChange={e => setCurrentStock(parseInt(e.target.value) || 0)} />
                </div>
              )}

              {/* Target Shop / Branch for opening stock (only for owners on create with stock > 0) */}
              {!id && currentStock > 0 && hasFullAccess() && (
                <div className="col-12 col-md-6">
                  <label className="form-label fw-semibold" style={{color:'#6366f1'}}>Target Shop / Branch for Stock <span className="text-danger">*</span></label>
                  <select className="form-select" style={{borderColor:'#6366f1'}} required value={form.shop_id} onChange={e => setForm({...form, shop_id: e.target.value})}>
                    <option value="">Select target shop</option>
                    {shops.map(s => (
                      <option key={s.id} value={s.id}>{s.name.toUpperCase()} {s.is_main ? '⭐' : ''}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Rack Location */}
              <div className="col-12 col-md-6">
                <label className="form-label fw-semibold">Rack Location</label>
                <input className="form-control" placeholder="Rack A-01"
                  value={location} onChange={e => setLocation(e.target.value)} />
              </div>

              {/* Warranty */}
              <div className="col-12 col-md-6">
                <label className="form-label fw-semibold">Warranty</label>
                <select className="form-select" value={attrs.warranty || 'No Warranty'} onChange={e => setAttr('warranty', e.target.value)}>
                  <option value="No Warranty">No Warranty</option>
                  <option value="7 Days">7 Days</option>
                  <option value="30 Days">30 Days</option>
                  <option value="3 Months">3 Months</option>
                  <option value="6 Months">6 Months</option>
                  <option value="1 Year">1 Year</option>
                </select>
              </div>

              {/* Profit & Margin Boxes (Styled exactly like mockup boxes) */}
              <div className="col-12">
                <div className="row g-3 mt-2">
                  <div className="col-6">
                    <div className="p-3 text-center rounded-3" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                      <div className="fw-semibold text-muted mb-1" style={{ fontSize: '0.85rem' }}>Profit</div>
                      <span className="fs-4 fw-bold text-primary">₹{calcProfit.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="p-3 text-center rounded-3" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                      <div className="fw-semibold text-muted mb-1" style={{ fontSize: '0.85rem' }}>Margin</div>
                      <span className="fs-4 fw-bold text-primary">{calcMargin.toFixed(2)}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="col-12">
                <label className="form-label fw-semibold">Description</label>
                <textarea className="form-control" rows="3" placeholder="Product description..."
                  value={attrs.description || ''} onChange={e => setAttr('description', e.target.value)}></textarea>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="d-flex gap-2">
            <button type="submit" className="btn btn-primary px-4 py-2 fw-semibold">
              💾 Save Product
            </button>
            <button type="button" className="btn btn-outline-secondary px-4 py-2" onClick={() => navigate('/products?category_group=other')}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  // ── Layout 2: Mobile / Default products layout ───────────────────────────
  return (
    <div>
      <div className="page-header">
        <h2>{id ? '✏️ Edit' : '➕ Add'} Product</h2>
        <button type="button" onClick={() => navigate(category_group ? `/products?category_group=${category_group}` : '/products')} className="btn btn-outline-secondary btn-sm">← Back</button>
      </div>

      <form onSubmit={handleSubmit}>
        {/* ── Section 1: Basic Info ── */}
        <div className="form-card mb-3">
          <div className="form-card-title">📋 Basic Information</div>
          <div className="row g-3">
            <div className="col-12 col-md-6">
              <label className="form-label fw-semibold">Category <span className="text-danger">*</span></label>
              <select className="form-select" required value={form.category_id} onChange={handleCategoryChange}>
                <option value="">Select category</option>
                {filteredCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label fw-semibold">Product Name <span className="text-danger">*</span></label>
              <input className="form-control" required placeholder="e.g. Samsung Galaxy A54 128GB Black"
                value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label fw-semibold">SKU <span className="text-danger">*</span>
                <span className="ms-2 text-muted fw-normal" style={{ fontSize:'0.76rem' }}>unique product code</span>
              </label>
              <input className="form-control font-monospace" required placeholder="e.g. SAM-A54-128-BLK"
                value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} />
              <div className="form-text">Format suggestion: BRAND-MODEL-SIZE-COLOR</div>
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label fw-semibold">IMEI <span className="text-muted fw-normal" style={{ fontSize:'0.76rem' }}>(mobiles only, optional)</span></label>
              <input className="form-control font-monospace" placeholder="15-digit IMEI"
                value={form.imei} onChange={e => setForm({ ...form, imei: e.target.value })} />
            </div>
            <div className="col-6 col-md-4">
              <label className="form-label fw-semibold">DP(DealerPrice) ₹ <span className="text-danger">*</span></label>
              <div className="input-group">
                <span className="input-group-text">₹</span>
                <input className="form-control" type="number" step="0.01" required min="0" placeholder="0"
                  value={form.purchase_price} onChange={e => setForm({ ...form, purchase_price: e.target.value })} />
              </div>
            </div>
            <div className="col-6 col-md-4">
              <label className="form-label fw-semibold text-success">Sell Price(MOP) ₹ <span className="text-danger">*</span></label>
              <div className="input-group">
                <span className="input-group-text text-success">₹</span>
                <input className="form-control border-success text-success fw-bold" type="number" step="0.01" required min="0" placeholder="0"
                  value={form.selling_price} onChange={e => setForm({ ...form, selling_price: e.target.value })} />
              </div>
            </div>
            <div className="col-6 col-md-4">
              <label className="form-label fw-semibold text-primary">Whole Seller Price ₹</label>
              <div className="input-group">
                <span className="input-group-text text-primary">₹</span>
                <input className="form-control border-primary" type="number" step="0.01" min="0" placeholder="0"
                  value={form.wholeseller_price} onChange={e => setForm({ ...form, wholeseller_price: e.target.value })} />
              </div>
            </div>
            <div className="col-6 col-md-4">
              <label className="form-label fw-semibold text-info">Customer Price ₹</label>
              <div className="input-group">
                <span className="input-group-text text-info">₹</span>
                <input className="form-control border-info font-monospace" type="number" step="0.01" min="0" placeholder="0"
                  value={form.max_selling_price} onChange={e => setForm({ ...form, max_selling_price: e.target.value })} />
              </div>
            </div>
            <div className="col-6 col-md-4">
              <label className="form-label fw-semibold text-danger">Min Price ₹</label>
              <div className="input-group">
                <span className="input-group-text text-danger">₹</span>
                <input className="form-control border-danger font-monospace" type="number" step="0.01" min="0" placeholder="0"
                  value={form.min_selling_price} onChange={e => setForm({ ...form, min_selling_price: e.target.value })} />
              </div>
            </div>
            <div className="col-6 col-md-4">
              <label className="form-label fw-semibold" style={{color:'#6366f1'}}>Commission (Salesman) ₹</label>
              <div className="input-group">
                <span className="input-group-text" style={{color:'#6366f1',borderColor:'#a5b4fc'}}>₹</span>
                <input className="form-control" style={{borderColor:'#a5b4fc'}} type="number" step="0.01" min="0" placeholder="0"
                  value={form.incentive_amount} onChange={e => setForm({ ...form, incentive_amount: e.target.value })} />
              </div>
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label fw-semibold">Condition</label>
              <select className="form-select" value={form.condition} onChange={e => setForm({ ...form, condition: e.target.value })}>
                <option value="new">🆕 New</option>
                <option value="used">🔄 Used / Refurbished</option>
              </select>
            </div>
            {profit !== null && (
              <div className="col-6 col-md-3 d-flex align-items-end">
                <div className={`w-100 p-2 rounded text-center ${parseFloat(profit) >= 0 ? 'bg-success' : 'bg-danger'} bg-opacity-10 border border-opacity-25 ${parseFloat(profit) >= 0 ? 'border-success' : 'border-danger'}`}>
                  <div className="fw-bold" style={{ fontSize:'0.78rem', color: parseFloat(profit) >= 0 ? '#15803d':'#b91c1c' }}>PROFIT PER UNIT</div>
                  <div className="fw-bold fs-5" style={{ color: parseFloat(profit) >= 0 ? '#15803d':'#b91c1c' }}>₹{profit}</div>
                  <div style={{ fontSize:'0.75rem', color: '#555' }}>{margin}% margin</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Section 2: Category-Specific Attributes ── */}
        {form.category_id && !schema && (
          <div className="form-card mb-3">
            <div className="form-card-title">🔧 Product Attributes</div>
            <div className="text-muted" style={{ fontSize: '0.85rem' }}>
              No specific attribute template for this category. You can add the product as-is.
            </div>
          </div>
        )}

        {schema && (
          <div className="form-card mb-3">
            <div className="form-card-title">{schema.label}</div>
            <div className="row g-3">
              {schema.fields.map(field => (
                <div key={field.key} className="col-12 col-sm-6 col-md-4 col-lg-3">
                  <label className="form-label fw-semibold">{field.label}</label>
                  {renderAttrField(field)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Section 3: Shop Location ── */}
        <div className="form-card mb-4">
          <div className="form-card-title">📍 Shop Location <span className="text-muted fw-normal fs-6">(optional, update anytime)</span></div>
          <div className="row">
            <div className="col-12 col-md-6">
              <input className="form-control" placeholder="e.g. Shelf A2 · Counter Display · Drawer 3 · Glass Cabinet · Back Storage"
                value={location} onChange={e => setLocation(e.target.value)} />
              <div className="form-text">Where is this product physically kept in the shop?</div>
            </div>
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="d-flex flex-wrap gap-2 align-items-center">
          <button type="submit" className="btn btn-primary px-4 py-2 fw-semibold">
            💾 {id ? 'Update Product' : 'Save Product'}
          </button>
          <button type="button" className="btn btn-outline-secondary" onClick={() => navigate(category_group ? `/products?category_group=${category_group}` : '/products')}>
            Cancel
          </button>
          {profit !== null && (
            <span className="text-muted ms-2" style={{ fontSize:'0.85rem' }}>
              Margin: <strong className={parseFloat(profit) >= 0 ? 'text-success' : 'text-danger'}>₹{profit} ({margin}%)</strong>
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
