import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { formatDate } from '../../utils/formatters';

export default function SalesReport() {
  const [data, setData] = useState([]);
  const [filter, setFilter] = useState({ from: '', to: '', bill_type: '' });
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    api.get('/reports/sales', { params: filter }).then(r => setData(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const total = data.reduce((s, i) => s + Number(i.grand_total), 0);

  return (
    <div>
      <div className="page-header"><h2>📊 Sales Report</h2></div>
      <div className="table-card mb-3 p-3 d-flex gap-2 flex-wrap">
        <input type="date" className="form-control form-control-sm" style={{ maxWidth:150 }} value={filter.from} onChange={e => setFilter({...filter, from:e.target.value})} />
        <input type="date" className="form-control form-control-sm" style={{ maxWidth:150 }} value={filter.to} onChange={e => setFilter({...filter, to:e.target.value})} />
        <select className="form-select form-select-sm" style={{ maxWidth:130 }} value={filter.bill_type} onChange={e => setFilter({...filter, bill_type:e.target.value})}>
          <option value="">All Bills</option><option value="kaccha">Kaccha</option><option value="pakka">Pakka</option>
        </select>
        <button className="btn btn-sm btn-primary" onClick={load}>Refresh</button>
        <div className="ms-auto fw-semibold text-success">Total: ₹{total.toLocaleString('en-IN')}</div>
      </div>
      <div className="table-card">
        {loading ? <div className="text-center py-4"><div className="spinner-border spinner-border-sm" /></div> : (
          <table className="table table-hover mb-0">
            <thead><tr><th>Invoice#</th><th>Date</th><th>Customer</th><th>Type</th><th>Grand Total</th><th>Payment</th><th>Staff</th></tr></thead>
            <tbody>
              {data.map(inv => (
                <tr key={inv.id}>
                  <td><code style={{ fontSize:'0.82rem' }}>{inv.invoice_no}</code></td>
                  <td>{formatDate(inv.sale_date)}</td><td>{inv.customer?.name}</td>
                  <td><span className={`badge ${inv.bill_type==='pakka'?'bg-success':'bg-warning text-dark'}`}>{inv.bill_type}</span></td>
                  <td className="fw-semibold">₹{Number(inv.grand_total).toLocaleString('en-IN')}</td>
                  <td>{inv.payment_method}</td><td>{inv.user?.name}</td>
                </tr>
              ))}
              {data.length === 0 && <tr><td colSpan={7} className="text-center py-4 text-muted">No records for this period</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
