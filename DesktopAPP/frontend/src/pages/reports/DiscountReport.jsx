import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { formatDate } from '../../utils/formatters';

export default function DiscountReport() {
  const navigate = useNavigate();
  const [rows, setRows]       = useState([]);
  const [totals, setTotals]   = useState({ discount: 0, cash_discount: 0, hidden_discount: 0, count: 0 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ from: '', to: '', hidden_only: false });

  const load = () => {
    setLoading(true);
    api.get('/reports/discounts', { params: filters })
      .then(r => { setRows(r.data.rows); setTotals(r.data.totals); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const fmt = (n) => Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 });

  return (
    <div className="container-fluid py-3">
      <div className="page-header mb-3 d-flex justify-content-between align-items-center">
        <div className="d-flex align-items-center gap-2">
          <button className="btn btn-sm btn-outline-secondary fw-bold" onClick={() => navigate('/reports')}>← Back</button>
          <div>
            <h2 className="mb-0 fw-bold">🏷️ Discounts Given</h2>
            <p className="text-muted small mb-0 text-uppercase">Every sale with a discount — including cash discounts hidden from the printed bill</p>
          </div>
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
          <div className="col-auto">
            <div className="form-check">
              <input type="checkbox" className="form-check-input" id="hiddenOnly"
                checked={filters.hidden_only}
                onChange={e => setFilters({...filters, hidden_only: e.target.checked})} />
              <label className="form-check-label small fw-bold text-danger" htmlFor="hiddenOnly">
                Hidden discounts only
              </label>
            </div>
          </div>
          <div className="col-auto d-flex gap-2">
            <button className="btn btn-sm btn-primary fw-bold px-3" onClick={load}>Apply</button>
            <button className="btn btn-sm btn-outline-secondary fw-bold" onClick={() => { setFilters({from:'',to:'',hidden_only:false}); load(); }}>Reset</button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="row g-3 mb-3">
        {[
          { label: 'Extra Discount',   value: totals.discount,        color: 'primary' },
          { label: 'Cash Discount',    value: totals.cash_discount,   color: 'success' },
          { label: 'Hidden (Off-Bill)', value: totals.hidden_discount, color: 'danger'  },
          { label: 'Invoices',         value: totals.count,           color: 'dark', isCount: true },
        ].map(c => (
          <div key={c.label} className="col-6 col-md-3">
            <div className={`card border-0 shadow-sm rounded-3 border-start border-4 border-${c.color}`}>
              <div className="card-body py-3">
                <div className="small text-muted fw-bold text-uppercase">{c.label}</div>
                <div className={`h5 fw-black mb-0 text-${c.color}`}>{c.isCount ? c.value : `₹${fmt(c.value)}`}</div>
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
                  <th>Shop</th>
                  <th>Customer</th>
                  <th>Sold By</th>
                  <th className="text-end">Extra Discount</th>
                  <th className="text-end">Cash Discount</th>
                  <th className="text-center">Shown On Bill?</th>
                  <th className="text-end">Grand Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={r.hidden ? 'table-danger' : ''}>
                    <td className="ps-4 fw-bold text-primary" style={{ cursor: 'pointer' }} onClick={() => navigate(`/sales/${r.id}`)}>{r.invoice_no}</td>
                    <td className="text-muted">{formatDate(r.sale_date)}</td>
                    <td>{r.shop_name}</td>
                    <td className="fw-bold">{r.customer_name}</td>
                    <td>{r.sold_by}</td>
                    <td className="text-end">{r.discount > 0 ? `₹${fmt(r.discount)}` : '—'}</td>
                    <td className="text-end">{r.cash_discount > 0 ? `₹${fmt(r.cash_discount)}` : '—'}</td>
                    <td className="text-center">
                      {r.cash_discount > 0 ? (
                        <span className={`badge ${r.is_cash_discount_on_bill ? 'bg-success' : 'bg-danger'}`}>
                          {r.is_cash_discount_on_bill ? '✅ SHOWN' : '🙈 HIDDEN'}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="text-end fw-black">₹{fmt(r.grand_total)}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={9} className="text-center py-5 text-muted fw-bold">No discounted sales for selected period.</td></tr>
                )}
              </tbody>
              {rows.length > 0 && (
                <tfoot className="bg-dark text-white fw-black">
                  <tr>
                    <td colSpan={5} className="ps-4 py-3 text-uppercase">TOTAL ({totals.count} Invoices)</td>
                    <td className="text-end py-3">₹{fmt(totals.discount)}</td>
                    <td className="text-end py-3">₹{fmt(totals.cash_discount)}</td>
                    <td className="text-center py-3">
                      {totals.hidden_discount > 0 && <span className="badge bg-danger">₹{fmt(totals.hidden_discount)} hidden</span>}
                    </td>
                    <td></td>
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
