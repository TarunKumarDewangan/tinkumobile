import { useState, useEffect } from 'react';
import api from '../../api/axios';

export default function ProfitReport() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.get('/reports/profit').then(r => setData(r.data)).finally(() => setLoading(false)); }, []);
  const totalProfit = data.reduce((s, r) => s + Number(r.profit), 0);

  return (
    <div>
      <div className="page-header">
        <h2>💹 Profit Analysis</h2>
        <span className={`fw-bold fs-5 ${totalProfit >= 0 ? 'text-success' : 'text-danger'}`}>Total Profit: ₹{totalProfit.toLocaleString('en-IN')}</span>
      </div>
      <div className="table-card">
        {loading ? <div className="text-center py-4"><div className="spinner-border spinner-border-sm" /></div> : (
          <table className="table table-hover mb-0">
            <thead><tr><th>Product</th><th>Category</th><th>Qty Sold</th><th>Revenue</th><th>Cost</th><th>Profit</th><th>Margin %</th></tr></thead>
            <tbody>
              {data.sort((a,b) => b.profit - a.profit).map(r => (
                <tr key={r.product_id}>
                  <td className="fw-semibold">{r.product?.name}</td>
                  <td>{r.product?.category?.name}</td>
                  <td>{r.qty_sold}</td>
                  <td>₹{Number(r.revenue).toLocaleString('en-IN')}</td>
                  <td className="text-danger">₹{Number(r.cost).toLocaleString('en-IN')}</td>
                  <td className={`fw-bold ${r.profit >= 0 ? 'text-success' : 'text-danger'}`}>₹{Number(r.profit).toLocaleString('en-IN')}</td>
                  <td><span className={`badge ${r.margin >= 20 ? 'bg-success' : r.margin >= 10 ? 'bg-warning text-dark' : 'bg-danger'}`}>{r.margin}%</span></td>
                </tr>
              ))}
              {data.length === 0 && <tr><td colSpan={7} className="text-center py-4 text-muted">No sales data</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
