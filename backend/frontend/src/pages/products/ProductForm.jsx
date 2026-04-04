import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../api/axios';

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
};

export default function ProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [selectedCatSlug, setSelectedCatSlug] = useState('');
  const [form, setForm] = useState({
    category_id: '', name: '', sku: '', imei: '',
    purchase_price: '', selling_price: '', condition: 'new'
  });
  const [attrs, setAttrs] = useState({});
  const [location, setLocation] = useState('');

  const schema = CATEGORY_SCHEMAS[selectedCatSlug] || null;

  useEffect(() => {
    api.get('/categories').then(r => setCategories(r.data));
    if (id) {
      api.get(`/products/${id}`).then(r => {
        const p = r.data;
        setForm({
          category_id: p.category_id, name: p.name, sku: p.sku, imei: p.imei || '',
          purchase_price: p.purchase_price, selling_price: p.selling_price, condition: p.condition
        });
        setAttrs(p.attributes || {});
        setLocation(p.location || '');
        const cat = categories.find(c => c.id == p.category_id);
        if (cat) setSelectedCatSlug(cat.slug);
      });
    }
  }, [id]);

  const handleCategoryChange = (e) => {
    const catId = e.target.value;
    const cat = categories.find(c => c.id == catId);
    setForm(f => ({ ...f, category_id: catId }));
    setSelectedCatSlug(cat?.slug || '');
    setAttrs({}); // reset attrs on category change
  };

  const setAttr = (key, val) => setAttrs(prev => ({ ...prev, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanAttrs = Object.fromEntries(Object.entries(attrs).filter(([, v]) => v && v !== ''));
    const payload = { ...form, attributes: cleanAttrs, location };
    try {
      if (id) await api.put(`/products/${id}`, payload);
      else await api.post('/products', payload);
      toast.success(id ? '✅ Product updated!' : '✅ Product created!');
      navigate('/products');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Error saving product');
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

  return (
    <div>
      <div className="page-header">
        <h2>{id ? '✏️ Edit' : '➕ Add'} Product</h2>
        <button onClick={() => navigate('/products')} className="btn btn-outline-secondary btn-sm">← Back</button>
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
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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
            <div className="col-6 col-md-3">
              <label className="form-label fw-semibold">Purchase Price ₹ <span className="text-danger">*</span></label>
              <div className="input-group">
                <span className="input-group-text">₹</span>
                <input className="form-control" type="number" step="0.01" required min="0" placeholder="0"
                  value={form.purchase_price} onChange={e => setForm({ ...form, purchase_price: e.target.value })} />
              </div>
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label fw-semibold">Selling Price ₹ <span className="text-danger">*</span></label>
              <div className="input-group">
                <span className="input-group-text">₹</span>
                <input className="form-control" type="number" step="0.01" required min="0" placeholder="0"
                  value={form.selling_price} onChange={e => setForm({ ...form, selling_price: e.target.value })} />
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
          <button type="button" className="btn btn-outline-secondary" onClick={() => navigate('/products')}>
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
