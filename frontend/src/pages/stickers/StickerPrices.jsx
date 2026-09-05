import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../api/axios';

export default function StickerPrices() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]); // one entry per physical sticker to print
  const [error, setError] = useState('');

  useEffect(() => {
    const raw = sessionStorage.getItem('stickerBatch');
    const items = raw ? JSON.parse(raw) : [];
    if (items.length === 0) {
      setError('No products selected. Go to Generate Stickers first.');
      setLoading(false);
      return;
    }

    Promise.all(items.map(it => api.get(`/products/${it.product_id}`).then(r => ({ ...r.data, qty: it.qty }))))
      .then(products => {
        const expanded = [];
        products.forEach(p => {
          const suggestedMrp = parseFloat(p.max_selling_price || 0) > 0 ? p.max_selling_price : p.selling_price;
          for (let i = 0; i < p.qty; i++) {
            expanded.push({
              key: `${p.id}-${i}`,
              product_id: p.id,
              name: (p.brand ? `${p.brand.name.toUpperCase()} ` : '') + p.name,
              condition: p.condition,
              sku: p.sku,
              imei: p.imei,
              ram: p.attributes?.ram || '',
              storage: p.attributes?.storage || '',
              color: p.attributes?.color || '',
              selling_price: p.selling_price,
              mrp: suggestedMrp || '',
              price: '',
            });
          }
        });
        setRows(expanded);
      })
      .catch(() => setError('Failed to load selected products.'))
      .finally(() => setLoading(false));
  }, []);

  const updateRow = (key, field, value) => {
    setRows(prev => prev.map(r => r.key === key ? { ...r, [field]: value } : r));
  };

  const allPricesFilled = rows.length > 0 && rows.every(r => String(r.price).trim() !== '' && parseFloat(r.price) > 0);

  const handlePrint = () => {
    if (!allPricesFilled) {
      toast.error('Enter a Best Price for every sticker before printing');
      return;
    }
    sessionStorage.setItem('stickerPrintBatch', JSON.stringify(rows));
    navigate('/stickers/print');
  };

  if (loading) {
    return <div className="text-center py-5"><div className="spinner-border text-primary" /></div>;
  }

  return (
    <div>
      <div className="page-header">
        <h2>💰 Set Sticker Prices</h2>
        <div className="d-flex gap-2">
          <Link to="/stickers/generate" className="btn btn-outline-secondary btn-sm">← Back to Selection</Link>
          {rows.length > 0 && (
            <button className="btn btn-primary btn-sm fw-bold" disabled={!allPricesFilled} onClick={handlePrint}>
              🖨️ Continue to Print
            </button>
          )}
        </div>
      </div>

      {error && <div className="alert alert-warning">{error}</div>}

      {rows.length > 0 && (
        <div className="table-card">
          <table className="table table-bordered mb-0 align-middle">
            <thead>
              <tr>
                <th>Model</th>
                <th>RAM / Storage / Color</th>
                <th>Condition</th>
                <th style={{ width: 140 }}>MRP ₹</th>
                <th style={{ width: 140 }}>
                  Best Price ₹
                  <div className="fw-normal text-muted" style={{ fontSize: '0.7rem' }}>staff enters before print</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.key}>
                  <td className="fw-semibold">
                    {r.name}
                    <div className="text-muted font-monospace" style={{ fontSize: '0.7rem' }}>
                      {r.sku}{r.imei ? ` · ${r.imei}` : ''}
                    </div>
                  </td>
                  <td>{[r.ram, r.storage, r.color].filter(Boolean).join(' / ') || '—'}</td>
                  <td>
                    <span className={`badge ${r.condition === 'new' ? 'bg-success' : 'bg-secondary'}`}>
                      {r.condition === 'new' ? 'NEW' : 'USED'}
                    </span>
                  </td>
                  <td>
                    <input type="number" min="0" className="form-control form-control-sm"
                      value={r.mrp} onChange={e => updateRow(r.key, 'mrp', e.target.value)} />
                  </td>
                  <td>
                    <input type="number" min="0" className="form-control form-control-sm fw-bold"
                      placeholder={`suggested ₹${parseFloat(r.selling_price || 0).toLocaleString('en-IN')}`}
                      value={r.price} onChange={e => updateRow(r.key, 'price', e.target.value)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
