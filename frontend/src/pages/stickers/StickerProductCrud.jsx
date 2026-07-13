import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import pinGate from '../../utils/pinGate';
import { useAuth } from '../../contexts/AuthContext';

const emptyForm = {
  id: null, category_id: '', name: '', purchase_price: '', selling_price: '',
  brand: '', ram: '', storage: '',
};

function generateSku(name, brand) {
  const base = (brand || name || 'PRD').replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase() || 'PRD';
  const unique = Date.now().toString(36).toUpperCase().slice(-5);
  return `${base}-${unique}`;
}

export default function StickerProductCrud() {
  const { can } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/categories').then(r => {
      setCategories(r.data);
      const mobileNew = r.data.find(c => (c.slug || '').toLowerCase() === 'mobile-new');
      if (mobileNew) setForm(f => ({ ...f, category_id: f.category_id || mobileNew.id }));
    });
  }, []);

  const load = () => {
    setLoading(true);
    api.get('/products/sticker-list', { params: { search, page } })
      .then(r => {
        setProducts(r.data.data || []);
        setLastPage(r.data.last_page || 1);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [search, page]);

  const openAdd = () => {
    const mobileNew = categories.find(c => (c.slug || '').toLowerCase() === 'mobile-new');
    setForm({ ...emptyForm, category_id: mobileNew?.id || '' });
    setShowForm(true);
  };

  const openEdit = async (p) => {
    const { data } = await api.get(`/products/${p.id}`);
    setForm({
      id: data.id,
      category_id: data.category_id,
      name: data.name,
      purchase_price: data.purchase_price,
      selling_price: data.selling_price,
      brand: data.attributes?.brand || '',
      ram: data.attributes?.ram || '',
      storage: data.attributes?.storage || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!await pinGate.confirm()) return;
    try {
      await api.delete(`/products/${id}`);
      toast.success('Product deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete product');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.category_id || !form.name || form.purchase_price === '' || form.selling_price === '') {
      toast.error('Please fill Category, Model, DP and MOP');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        category_id: form.category_id,
        name: form.name,
        purchase_price: form.purchase_price,
        selling_price: form.selling_price,
        attributes: { brand: form.brand, ram: form.ram, storage: form.storage },
      };
      if (form.id) {
        await api.put(`/products/${form.id}`, payload);
        toast.success('Product updated');
      } else {
        await api.post('/products', { ...payload, sku: generateSku(form.name, form.brand) });
        toast.success('Product created');
      }
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>🛠️ Sticker Products — CRUD</h2>
        {can('create_products') && (
          <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Add Product</button>
        )}
      </div>

      {showForm && (
        <div className="form-card mb-3">
          <div className="form-card-title">{form.id ? '✏️ Edit Product' : '➕ Add Product'}</div>
          <form onSubmit={handleSubmit}>
            <div className="row g-3">
              <div className="col-12 col-md-4">
                <label className="form-label fw-semibold">Category <span className="text-danger">*</span></label>
                <select className="form-select" required value={form.category_id}
                  onChange={e => setForm({ ...form, category_id: e.target.value })}>
                  <option value="">Select category</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label fw-semibold">Company</label>
                <input className="form-control" placeholder="e.g. Samsung, Apple, Vivo"
                  value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} />
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label fw-semibold">Model <span className="text-danger">*</span></label>
                <input className="form-control" required placeholder="e.g. iPhone 14 Pro"
                  value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label fw-semibold">RAM</label>
                <input className="form-control" placeholder="e.g. 8GB"
                  value={form.ram} onChange={e => setForm({ ...form, ram: e.target.value })} />
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label fw-semibold">Storage</label>
                <input className="form-control" placeholder="e.g. 128GB"
                  value={form.storage} onChange={e => setForm({ ...form, storage: e.target.value })} />
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label fw-semibold">DP (Purchase Price) ₹ <span className="text-danger">*</span></label>
                <input className="form-control" type="number" step="0.01" min="0" required
                  value={form.purchase_price} onChange={e => setForm({ ...form, purchase_price: e.target.value })} />
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label fw-semibold text-success">MOP (Selling Price) ₹ <span className="text-danger">*</span></label>
                <input className="form-control border-success text-success fw-bold" type="number" step="0.01" min="0" required
                  value={form.selling_price} onChange={e => setForm({ ...form, selling_price: e.target.value })} />
              </div>
            </div>
            <div className="d-flex gap-2 mt-3">
              <button type="submit" className="btn btn-primary px-4" disabled={saving}>
                💾 {form.id ? 'Update' : 'Save'}
              </button>
              <button type="button" className="btn btn-outline-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="table-card">
        <div className="p-3 border-bottom d-flex gap-2">
          <input className="form-control form-control-sm" style={{ maxWidth: 260 }}
            placeholder="Search by name, SKU or company..." value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>

        {loading ? (
          <div className="text-center py-4"><div className="spinner-border spinner-border-sm text-primary" /></div>
        ) : (
          <table className="table table-bordered table-hover mb-0 align-middle">
            <thead>
              <tr>
                <th>Company</th><th>Model</th><th>RAM</th><th>Storage</th><th>MOP ₹</th><th style={{ width: 140 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr><td colSpan="6" className="text-center py-4 text-muted">No products found</td></tr>
              ) : products.map(p => (
                <tr key={p.id}>
                  <td className="fw-semibold">{p.attributes?.brand || '—'}</td>
                  <td>{p.name}</td>
                  <td>{p.attributes?.ram || '—'}</td>
                  <td>{p.attributes?.storage || '—'}</td>
                  <td>₹{parseFloat(p.selling_price || 0).toLocaleString('en-IN')}</td>
                  <td>
                    <div className="d-flex gap-1">
                      {can('create_products') && (
                        <button className="btn btn-sm btn-outline-primary" onClick={() => openEdit(p)}>Edit</button>
                      )}
                      {can('create_products') && (
                        <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(p.id)}>Delete</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {lastPage > 1 && (
          <div className="card-footer d-flex justify-content-between align-items-center bg-white py-3">
            <button className="btn btn-outline-secondary btn-sm px-4" disabled={page === 1} onClick={() => setPage(p => p - 1)}>PREVIOUS</button>
            <span className="text-muted small text-uppercase fw-bold">Page {page} of {lastPage}</span>
            <button className="btn btn-outline-secondary btn-sm px-4" disabled={page === lastPage} onClick={() => setPage(p => p + 1)}>NEXT</button>
          </div>
        )}
      </div>
    </div>
  );
}
