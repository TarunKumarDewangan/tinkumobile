import { useState, useEffect, useCallback } from 'react';
import axios from '../../../api/axios';
import { toast } from 'react-toastify';

const fmt = (n) => parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtRs = (n) => '₹' + parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export default function DailyStockLedger() {
  const today = new Date().toISOString().slice(0, 10);
  const thirtyAgo = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);

  const [fromDate, setFromDate] = useState(thirtyAgo);
  const [toDate, setToDate] = useState(today);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await axios.get('/stocks/daily-ledger', {
        params: { from_date: fromDate, to_date: toDate },
      });
      setData(res);
      setExpanded({});
    } catch {
      toast.error('Failed to load daily ledger');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => { load(); }, [load]);

  const toggle = (date) => setExpanded(e => ({ ...e, [date]: !e[date] }));

  const setPreset = (days) => {
    const t = new Date();
    const f = new Date(Date.now() - (days - 1) * 86400000);
    setToDate(t.toISOString().slice(0, 10));
    setFromDate(f.toISOString().slice(0, 10));
  };

  return (
    <div className="text-uppercase" style={{ fontSize: '.82rem' }}>

      {/* ── Filters ── */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body py-3">
          <div className="row g-2 align-items-end">
            <div className="col-auto">
              <label className="form-label x-small fw-bold text-muted mb-1">FROM DATE</label>
              <input type="date" className="form-control form-control-sm" value={fromDate} onChange={e => setFromDate(e.target.value)} />
            </div>
            <div className="col-auto">
              <label className="form-label x-small fw-bold text-muted mb-1">TO DATE</label>
              <input type="date" className="form-control form-control-sm" value={toDate} onChange={e => setToDate(e.target.value)} />
            </div>
            <div className="col-auto d-flex gap-1 flex-wrap" style={{ paddingTop: '1.5rem' }}>
              {[
                { label: 'Today', days: 1 },
                { label: 'Last 7 Days', days: 7 },
                { label: 'Last 30 Days', days: 30 },
              ].map(p => (
                <button key={p.days} className="btn btn-outline-secondary btn-sm fw-bold" onClick={() => setPreset(p.days)}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <div className="text-center py-5"><div className="spinner-border text-primary" /></div>
      )}

      {!loading && data && (
        <>
          {/* ── Summary Tiles ── */}
          <div className="row g-3 mb-3">
            {[
              { label: 'Opening Stock', value: fmt(data.opening_stock), icon: '📦', color: '#6366f1' },
              { label: 'Stock IN (Purchases)', value: '+' + fmt(data.total_in), icon: '⬇️', color: '#22c55e' },
              { label: 'Stock OUT (Sales)', value: '-' + fmt(data.total_out), icon: '⬆️', color: '#f59e0b' },
              { label: 'Closing Stock', value: fmt(data.closing_stock), icon: '🏪', color: '#0ea5e9' },
              { label: 'Sale Revenue', value: fmtRs(data.total_revenue), icon: '💰', color: '#10b981' },
              { label: 'Sale Cost', value: fmtRs(data.total_cost), icon: '🏷️', color: '#ef4444' },
              { label: 'Gross Profit', value: fmtRs(data.total_profit), icon: '📈', color: data.total_profit >= 0 ? '#22c55e' : '#ef4444' },
            ].map(t => (
              <div key={t.label} className="col-6 col-md-3 col-xl-auto" style={{ flex: 1 }}>
                <div className="card border-0 shadow-sm h-100" style={{ borderLeft: `4px solid ${t.color}` }}>
                  <div className="card-body py-2 px-3">
                    <div className="x-small text-muted fw-bold">{t.icon} {t.label}</div>
                    <div className="fw-black mt-1" style={{ fontSize: '1.15rem', color: t.color }}>{t.value}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Day Table ── */}
          {data.days.length === 0 ? (
            <div className="text-center py-5 text-muted fw-bold card border-0 shadow-sm">
              <div className="py-4">📭 NO STOCK MOVEMENTS IN THIS DATE RANGE</div>
            </div>
          ) : (
            <div className="card border-0 shadow-sm">
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0" style={{ fontSize: '.78rem' }}>
                  <thead className="bg-dark text-white">
                    <tr>
                      <th className="ps-3 py-3" style={{ width: '40px' }}></th>
                      <th style={{ width: '130px' }}>DATE</th>
                      <th className="text-center" style={{ width: '100px' }}>OPENING</th>
                      <th className="text-center" style={{ width: '80px' }}>IN ⬇️</th>
                      <th className="text-center" style={{ width: '80px' }}>OUT ⬆️</th>
                      <th className="text-center" style={{ width: '100px' }}>CLOSING</th>
                      <th className="text-end" style={{ width: '130px' }}>PURCHASE VALUE</th>
                      <th className="text-end" style={{ width: '120px' }}>SALE REVENUE</th>
                      <th className="text-end pe-3" style={{ width: '110px' }}>PROFIT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.days.map(day => (
                      <>
                        {/* ── Day row ── */}
                        <tr
                          key={day.date}
                          className={expanded[day.date] ? 'table-active' : ''}
                          style={{ cursor: 'pointer' }}
                          onClick={() => toggle(day.date)}
                        >
                          <td className="ps-3 text-muted fw-bold">{expanded[day.date] ? '▼' : '▶'}</td>
                          <td>
                            <div className="fw-bold text-dark">{fmtDate(day.date)}</div>
                            <div className="x-small text-muted">
                              {day.purchases.length > 0 && <span className="me-2 text-success">+{day.stock_in} IN</span>}
                              {day.sales.length > 0 && <span className="text-danger">-{day.stock_out} OUT</span>}
                            </div>
                          </td>
                          <td className="text-center fw-bold text-secondary">{fmt(day.opening_stock)}</td>
                          <td className="text-center fw-bold text-success">{day.stock_in > 0 ? '+' + day.stock_in : '—'}</td>
                          <td className="text-center fw-bold text-danger">{day.stock_out > 0 ? '-' + day.stock_out : '—'}</td>
                          <td className="text-center">
                            <span className="badge bg-primary fw-bold" style={{ fontSize: '.82rem' }}>{fmt(day.closing_stock)}</span>
                          </td>
                          <td className="text-end fw-bold text-dark">{day.purchase_value > 0 ? fmtRs(day.purchase_value) : '—'}</td>
                          <td className="text-end fw-bold text-success">{day.sale_revenue > 0 ? fmtRs(day.sale_revenue) : '—'}</td>
                          <td className={`text-end pe-3 fw-bold ${day.profit >= 0 ? 'text-success' : 'text-danger'}`}>
                            {day.stock_out > 0 ? fmtRs(day.profit) : '—'}
                          </td>
                        </tr>

                        {/* ── Expanded detail ── */}
                        {expanded[day.date] && (
                          <tr key={day.date + '-detail'}>
                            <td colSpan="9" className="p-0">
                              <div className="p-3 bg-light border-top border-bottom" style={{ fontSize: '.76rem' }}>
                                <div className="row g-3">

                                  {/* Purchases */}
                                  {day.purchases.length > 0 && (
                                    <div className="col-12 col-md-4">
                                      <div className="fw-black text-success mb-2">⬇️ STOCK IN — PURCHASES</div>
                                      <table className="table table-sm table-bordered mb-0 bg-white" style={{ fontSize: '.74rem' }}>
                                        <thead className="table-success">
                                          <tr>
                                            <th>PRODUCT</th>
                                            <th className="text-center">QTY</th>
                                            <th className="text-end">PURCHASE PRICE</th>
                                            <th className="text-end">TOTAL VALUE</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {day.purchases.map((p, i) => (
                                            <tr key={i}>
                                              <td className="fw-bold" style={{ textTransform: 'none' }}>
                                                {p.product_name}
                                                {p.invoice_no && <div className="text-muted" style={{ fontSize: '.68rem' }}>INV: {p.invoice_no}</div>}
                                              </td>
                                              <td className="text-center fw-bold text-success">+{p.quantity}</td>
                                              <td className="text-end">{fmtRs(p.unit_price)}</td>
                                              <td className="text-end fw-bold">{fmtRs(p.total_value)}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}

                                  {/* Sales */}
                                  {day.sales.length > 0 && (
                                    <div className="col-12 col-md-5">
                                      <div className="fw-black text-danger mb-2">⬆️ STOCK OUT — SALES</div>
                                      <table className="table table-sm table-bordered mb-0 bg-white" style={{ fontSize: '.74rem' }}>
                                        <thead className="table-danger">
                                          <tr>
                                            <th>PRODUCT</th>
                                            <th>CUSTOMER</th>
                                            <th className="text-center">QTY</th>
                                            <th className="text-end">PURCHASE ₹</th>
                                            <th className="text-end">SALE ₹</th>
                                            <th className="text-end">PROFIT</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {day.sales.map((s, i) => (
                                            <tr key={i}>
                                              <td className="fw-bold" style={{ textTransform: 'none' }}>
                                                {s.product_name}
                                                {s.invoice_no && <div className="text-muted" style={{ fontSize: '.68rem' }}>INV: {s.invoice_no}</div>}
                                              </td>
                                              <td style={{ textTransform: 'none' }}>{s.customer_name}</td>
                                              <td className="text-center fw-bold text-danger">-{s.quantity}</td>
                                              <td className="text-end text-muted">{fmtRs(s.purchase_price)}</td>
                                              <td className="text-end fw-bold text-success">{fmtRs(s.sale_price)}</td>
                                              <td className={`text-end fw-bold ${s.profit >= 0 ? 'text-success' : 'text-danger'}`}>{fmtRs(s.profit)}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}

                                  {/* Adjustments */}
                                  {day.adjustments.length > 0 && (
                                    <div className="col-12 col-md-3">
                                      <div className="fw-black text-warning mb-2">⚙️ STOCK ADJUSTMENTS</div>
                                      <table className="table table-sm table-bordered mb-0 bg-white" style={{ fontSize: '.74rem' }}>
                                        <thead className="table-warning">
                                          <tr>
                                            <th>PRODUCT</th>
                                            <th className="text-center">QTY</th>
                                            <th>REASON</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {day.adjustments.map((a, i) => (
                                            <tr key={i}>
                                              <td className="fw-bold" style={{ textTransform: 'none' }}>{a.product_name}</td>
                                              <td className={`text-center fw-bold ${a.type === 'add' ? 'text-success' : 'text-danger'}`}>
                                                {a.type === 'add' ? '+' : '-'}{a.quantity}
                                              </td>
                                              <td className="text-muted" style={{ textTransform: 'none' }}>{a.reason}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}

                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>

                  {/* Totals footer */}
                  <tfoot>
                    <tr className="fw-black bg-dark text-white">
                      <td colSpan="2" className="ps-3 py-2">PERIOD TOTAL</td>
                      <td className="text-center">{fmt(data.opening_stock)}</td>
                      <td className="text-center text-success">+{fmt(data.total_in)}</td>
                      <td className="text-center text-danger">-{fmt(data.total_out)}</td>
                      <td className="text-center"><span className="badge bg-primary">{fmt(data.closing_stock)}</span></td>
                      <td className="text-end">—</td>
                      <td className="text-end text-success">{fmtRs(data.total_revenue)}</td>
                      <td className={`text-end pe-3 ${data.total_profit >= 0 ? 'text-success' : 'text-danger'}`}>{fmtRs(data.total_profit)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
