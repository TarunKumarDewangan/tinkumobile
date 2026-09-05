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
  const [groupByConfig, setGroupByConfig] = useState(true);

  // { [rowId]: qty } — rowId is either a real product id or a synthetic
  // "grp_..." group id. Kept across searches so the selection count
  // survives paging/searching.
  const [selected, setSelected] = useState({});

  useEffect(() => {
    api.get('/categories').then(r => setCategories(r.data));
  }, []);

  useEffect(() => {
    setLoading(true);
    api.get('/products/sticker-list', { params: { search, category_id: categoryId, page, group_by_config: groupByConfig } })
      .then(r => {
        setProducts(r.data.data || []);
        setLastPage(r.data.last_page || 1);
      })
      .finally(() => setLoading(false));
  }, [search, categoryId, page, groupByConfig]);

  const toggle = (p) => {
    setSelected(prev => {
      const next = { ...prev };
      if (next[p.id]) delete next[p.id];
      else next[p.id] = p.is_group ? p.count : 1;
      return next;
    });
  };

  const setQty = (p, qty) => {
    const max = p.is_group ? p.count : 999;
    const q = Math.min(max, Math.max(1, parseInt(qty) || 1));
    setSelected(prev => prev[p.id] !== undefined ? { ...prev, [p.id]: q } : prev);
  };

  const selectedIds = Object.keys(selected);
  const totalStickers = Object.values(selected).reduce((sum, v) => sum + v, 0);

  const handleNext = () => {
    if (selectedIds.length === 0) {
      toast.error('Select at least one product first');
      return;
    }
    // Every group expands into its own real product_ids (each carrying its
    // own distinct IMEI) — one sticker per physical unit — instead of
    // reusing a single product_id with qty > 1, which would print the same
    // IMEI on every copy.
    const items = [];
    selectedIds.forEach(id => {
      const p = products.find(pr => String(pr.id) === String(id));
      if (!p) return;
      const qty = selected[id];
      if (p.is_group) {
        p.product_ids.slice(0, qty).forEach(pid => items.push({ product_id: pid, qty: 1 }));
      } else {
        items.push({ product_id: p.id, qty });
      }
    });
    sessionStorage.setItem('stickerBatch', JSON.stringify(items));
    navigate('/stickers/prices');
  };

  return (
    <div>
      <div className="page-header">
        <h2>🏷️ Generate Stickers</h2>
      </div>

      <div className="table-card">
        <div className="p-3 border-bottom d-flex flex-wrap gap-2 align-items-center">
          <input className="form-control form-control-sm" style={{ maxWidth: 260 }}
            placeholder="Search by name, SKU or IMEI..." value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }} />
          <select className="form-select form-select-sm" style={{ maxWidth: 220 }}
            value={categoryId} onChange={e => { setCategoryId(e.target.value); setPage(1); }}>
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="form-check form-switch d-flex align-items-center gap-2">
            <input
              className="form-check-input" type="checkbox" role="switch" id="groupByConfig"
              checked={groupByConfig}
              onChange={e => { setGroupByConfig(e.target.checked); setPage(1); setSelected({}); }}
            />
            <label className="form-check-label small fw-bold" htmlFor="groupByConfig" title="Group multiple units of the exact same model/RAM/storage/color into one row — selecting it prints one sticker per unit, each with its own real IMEI.">
              Group Same Config
            </label>
          </div>

          <div className="ms-auto d-flex align-items-center gap-3">
            <span className="text-muted small">
              {selectedIds.length} row{selectedIds.length === 1 ? '' : 's'} selected · {totalStickers} sticker{totalStickers === 1 ? '' : 's'}
            </span>
            <button className="btn btn-primary btn-sm fw-bold" onClick={handleNext}>
              Next: Set Prices →
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
                <th>Model</th>
                <th>SKU</th>
                <th>IMEI</th>
                <th>RAM / Storage / Color</th>
                <th>Condition</th>
                <th>Selling Price</th>
                <th style={{ width: 100 }}>Qty</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr><td colSpan="8" className="text-center py-4 text-muted">No products found</td></tr>
              ) : products.map(p => {
                const isSelected = selected[p.id] !== undefined;
                return (
                  <tr key={p.id} className={isSelected ? 'table-primary' : ''}>
                    <td>
                      <input type="checkbox" className="form-check-input" checked={isSelected} onChange={() => toggle(p)} />
                    </td>
                    <td className="fw-semibold">{p.brand ? `${p.brand.name.toUpperCase()} ` : ''}{p.name}</td>
                    <td className="font-monospace" style={{ fontSize: '0.8rem' }}>{p.sku || '—'}</td>
                    <td className="font-monospace" style={{ fontSize: '0.8rem' }}>
                      {p.is_group ? <span className="badge bg-info text-dark">{p.count} PCS · own IMEI each</span> : (p.imei || '—')}
                    </td>
                    <td>{[p.attributes?.ram, p.attributes?.storage, p.attributes?.color].filter(Boolean).join(' / ') || '—'}</td>
                    <td>
                      <span className={`badge ${p.condition === 'new' ? 'bg-success' : 'bg-secondary'}`}>
                        {p.condition === 'new' ? 'NEW' : 'USED'}
                      </span>
                    </td>
                    <td>₹{parseFloat(p.selling_price || 0).toLocaleString('en-IN')}</td>
                    <td>
                      <input type="number" min="1" max={p.is_group ? p.count : undefined} className="form-control form-control-sm"
                        disabled={!isSelected} value={selected[p.id] ?? (p.is_group ? p.count : 1)}
                        title={p.is_group ? `Up to ${p.count} available` : undefined}
                        onChange={e => setQty(p, e.target.value)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {!groupByConfig && lastPage > 1 && (
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
