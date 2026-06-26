import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { formatDate } from '../../utils/formatters';

export default function ProfitReport() {
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ from: '', to: '' });

  const load = () => {
    setLoading(true);
    api.get('/reports/profit', { params: filters })
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // Summary totals
  const totalRevenue  = data.reduce((s, r) => s + Number(r.grand_total),     0);
  const totalCost     = data.reduce((s, r) => s + Number(r.total_item_cost),  0);
  const totalDiscount = data.reduce((s, r) => s + Number(r.discount_given),   0);
  const totalProfit   = data.reduce((s, r) => s + Number(r.profit),           0);

  const fmt = (n) => Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 });

  return (
    <div className="container-fluid py-3">
      <div className="page-header mb-3 d-flex justify-content-between align-items-center">
        <div>
          <h2 className="mb-0 fw-bold">💹 Profit Analysis</h2>
          <p className="text-muted small mb-0 text-uppercase">Invoice-level profit after all discounts</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card shadow-sm border-0 mb-3 p-3 bg-white rounded-3">
        <div className="row g-2 align-items-end">
          <div className="col-12 col-md-3">
            <label className="small fw-bold text-muted mb-1">From Date</label>
            <input type="date" className="form-control form-control-sm"
              value={filters.from} onChange={e => setFilters({...filters, from: e.target.value})} />
          </div>
          <div className="col-12 col-md-3">
            <label className="small fw-bold text-muted mb-1">To Date</label>
            <input type="date" className="form-control form-control-sm"
              value={filters.to} onChange={e => setFilters({...filters, to: e.target.value})} />
          </div>
          <div className="col-auto d-flex gap-2">
            <button className="btn btn-sm btn-primary fw-bold px-3" onClick={load}>Apply</button>
            <button className="btn btn-sm btn-outline-secondary fw-bold" onClick={() => { setFilters({from:'',to:''}); load(); }}>Reset</button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="row g-3 mb-3">
        {[
          { label: 'Total Revenue',   value: totalRevenue,  color: 'primary'  },
          { label: 'Total Item Cost', value: totalCost,     color: 'danger'   },
          { label: 'Discount Given',  value: totalDiscount, color: 'warning'  },
          { label: 'Net Profit',      value: totalProfit,   color: totalProfit >= 0 ? 'success' : 'danger' },
        ].map(c => (
          <div key={c.label} className="col-6 col-md-3">
            <div className={`card border-0 shadow-sm rounded-3 border-start border-4 border-${c.color}`}>
              <div className="card-body py-3">
                <div className="small text-muted fw-bold text-uppercase">{c.label}</div>
                <div className={`h5 fw-black mb-0 text-${c.color}`}>₹{fmt(c.value)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card shadow-sm border-0 bg-white rounded-3 overflow-hidden">
        {loading ? (
          <div className="text-center py-5"><div className="spinner-border text-primary" /></div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover mb-0 align-middle text-uppercase" style={{ fontSize: '0.82rem' }}>
              <thead className="bg-light fw-bold">
                <tr>
                  <th className="ps-4">Invoice #</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th className="text-end">Grand Total</th>
                  <th className="text-end">Item Cost</th>
                  <th className="text-end text-warning">Discount Given</th>
                  <th className="text-end">Profit</th>
                  <th className="text-center">Margin%</th>
                </tr>
              </thead>
              <tbody>
                {data.map((r, i) => (
                  <tr key={i}>
                    <td className="ps-4 fw-bold text-primary">{r.invoice_no}</td>
                    <td className="text-muted">{formatDate(r.sale_date)}</td>
                    <td className="fw-bold">{r.customer_name}</td>
                    <td className="text-end fw-bold">₹{fmt(r.grand_total)}</td>
                    <td className="text-end text-danger">₹{fmt(r.total_item_cost)}</td>
                    <td className="text-end fw-bold" style={{ color: '#d97706' }}>
                      {Number(r.discount_given) > 0 ? `- ₹${fmt(r.discount_given)}` : '—'}
                    </td>
                    <td className={`text-end fw-black ${Number(r.profit) >= 0 ? 'text-success' : 'text-danger'}`}>
                      ₹{fmt(r.profit)}
                    </td>
                    <td className="text-center">
                      <span className={`badge ${r.margin_pct >= 15 ? 'bg-success' : r.margin_pct >= 5 ? 'bg-warning text-dark' : 'bg-danger'}`}>
                        {r.margin_pct}%
                      </span>
                    </td>
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-5 text-muted fw-bold">No sales data for selected period.</td></tr>
                )}
              </tbody>
              {data.length > 0 && (
                <tfoot className="bg-dark text-white fw-black">
                  <tr>
                    <td colSpan={3} className="ps-4 py-3 text-uppercase">TOTAL ({data.length} Invoices)</td>
                    <td className="text-end py-3">₹{fmt(totalRevenue)}</td>
                    <td className="text-end py-3 text-danger">₹{fmt(totalCost)}</td>
                    <td className="text-end py-3" style={{ color: '#fbbf24' }}>- ₹{fmt(totalDiscount)}</td>
                    <td className={`text-end py-3 ${totalProfit >= 0 ? 'text-success' : 'text-danger'}`}>₹{fmt(totalProfit)}</td>
                    <td className="text-center py-3">
                      <span className={`badge ${totalRevenue > 0 && (totalProfit/totalRevenue*100) >= 10 ? 'bg-success' : 'bg-warning text-dark'}`}>
                        {totalRevenue > 0 ? `${((totalProfit / totalRevenue) * 100).toFixed(1)}%` : '—'}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
