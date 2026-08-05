import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../api/axios';

export default function GenerateStickers() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);

  // { [productId]: { qty, name, brand, ram, storage } } — kept across pages so the
  // selection summary survives paging/searching.
  const [selected, setSelected] = useState({});

  useEffect(() => {
    api.get('/categories').then(r => setCategories(r.data));
  }, []);

  useEffect(() => {
    setLoading(true);
    api.get('/products/sticker-list', { params: { search, category_id: categoryId, page } })
      .then(r => {
        setProducts(r.data.data || []);
        setLastPage(r.data.last_page || 1);
      })
      .finally(() => setLoading(false));
  }, [search, categoryId, page]);

  const toggle = (p) => {
    setSelected(prev => {
      const next = { ...prev };
      if (next[p.id]) {
        delete next[p.id];
      } else {
        next[p.id] = {
          qty: 1,
          name: p.name,
          brand: p.attributes?.brand || '',
          ram: p.attributes?.ram || '',
          storage: p.attributes?.storage || '',
        };
      }
      return next;
    });
  };

  const setQty = (id, qty) => {
    const q = Math.max(1, parseInt(qty) || 1);
    setSelected(prev => prev[id] ? { ...prev, [id]: { ...prev[id], qty: q } } : prev);
  };

  const selectedIds = Object.keys(selected);
  const totalStickers = Object.values(selected).reduce((sum, v) => sum + v.qty, 0);

  const handleGenerate = () => {
    if (selectedIds.length === 0) {
      toast.error('Select at least one product first');
      return;
    }
    const items = selectedIds.map(id => ({ product_id: Number(id), qty: selected[id].qty }));
    sessionStorage.setItem('stickerBatch', JSON.stringify(items));
    navigate('/stickers/print');
  };

  return (
    <div>
      <div className="page-header">
        <h2>🏷️ Generate Stickers</h2>
      </div>

      <div className="table-card">
        <div className="p-3 border-bottom d-flex flex-wrap gap-2 align-items-center">
          <input className="form-control form-control-sm" style={{ maxWidth: 260 }}
            placeholder="Search by name, SKU or company..." value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }} />
          <select className="form-select form-select-sm" style={{ maxWidth: 220 }}
            value={categoryId} onChange={e => { setCategoryId(e.target.value); setPage(1); }}>
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <div className="ms-auto d-flex align-items-center gap-3">
            <span className="text-muted small">
              {selectedIds.length} product{selectedIds.length === 1 ? '' : 's'} selected · {totalStickers} sticker{totalStickers === 1 ? '' : 's'}
            </span>
            <button className="btn btn-primary btn-sm fw-bold" onClick={handleGenerate}>
              Generate Stickers →
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-4"><div className="spinner-border spinner-border-sm text-primary" /></div>
        ) : (
          <table className="table table-bordered table-hover mb-0 align-middle">
            <thead>
              <tr>
                <th style={{ width: 40 }}></th>
                <th>Company</th>
                <th>Model</th>
                <th>IMEI</th>
                <th>RAM</th>
                <th>Storage</th>
                <th>MOP ₹</th>
                <th style={{ width: 100 }}>Qty</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr><td colSpan="8" className="text-center py-4 text-muted">No products found</td></tr>
              ) : products.map(p => {
                const isSelected = !!selected[p.id];
                return (
                  <tr key={p.id} className={isSelected ? 'table-primary' : ''}>
                    <td>
                      <input type="checkbox" className="form-check-input" checked={isSelected} onChange={() => toggle(p)} />
                    </td>
                    <td className="fw-semibold">{p.attributes?.brand || '—'}</td>
                    <td>{p.name}</td>
                    <td className="font-monospace" style={{ fontSize: '0.8rem' }}>{p.imei || '—'}</td>
                    <td>{p.attributes?.ram || '—'}</td>
                    <td>{p.attributes?.storage || '—'}</td>
                    <td>₹{parseFloat(p.selling_price || 0).toLocaleString('en-IN')}</td>
                    <td>
                      <input type="number" min="1" className="form-control form-control-sm"
                        disabled={!isSelected} value={selected[p.id]?.qty ?? 1}
                        onChange={e => setQty(p.id, e.target.value)} />
                    </td>
                  </tr>
                );
              })}
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
