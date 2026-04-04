import { useState, useEffect } from 'react';
import api from '../../api/axios';

export default function StockReport() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLow, setShowLow] = useState(false);
  useEffect(() => { api.get('/reports/stock').then(r => setData(r.data)).finally(() => setLoading(false)); }, []);
  const filtered = showLow ? data.filter(d => d.stock <= 5) : data;

  return (
    <div>
      <div className="page-header">
        <h2>📦 Stock Levels</h2>
        <label className="d-flex align-items-center gap-2" style={{ cursor:'pointer' }}>
          <input type="checkbox" checked={showLow} onChange={e => setShowLow(e.target.checked)} />
          <span className="fw-semibold text-danger">Show Low Stock Only</span>
        </label>
      </div>
      <div className="table-card">
        {loading ? <div className="text-center py-4"><div className="spinner-border spinner-border-sm" /></div> : (
          <table className="table table-hover mb-0">
            <thead><tr><th>Product</th><th>Category</th><th>Shop</th><th>Stock</th><th>Status</th></tr></thead>
            <tbody>
              {filtered.map(d => (
                <tr key={d.id}>
                  <td className="fw-semibold">{d.product?.name}</td>
                  <td>{d.product?.category?.name}</td>
                  <td>{d.shop?.name}</td>
                  <td className={d.stock <= 2 ? 'text-danger fw-bold' : d.stock <= 5 ? 'text-warning fw-bold' : ''}>{d.stock}</td>
                  <td><span className={`badge ${d.stock === 0 ? 'bg-danger' : d.stock <= 5 ? 'bg-warning text-dark' : 'bg-success'}`}>
                    {d.stock === 0 ? 'Out of Stock' : d.stock <= 5 ? 'Low Stock' : 'In Stock'}
                  </span></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={5} className="text-center py-4 text-muted">No inventory data</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
