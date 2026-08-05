import { useState, useEffect, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import { formatDate } from '../../utils/formatters';
import { useAuth } from '../../contexts/AuthContext';

const TYPES = [
  { value: '',         label: 'ALL TYPES' },
  { value: 'exchange', label: 'EXCHANGE' },
  { value: 'cash',     label: 'CASH PAYOUT' },
];

const CREDIT_STATUS = [
  { value: '',        label: 'ANY CREDIT STATUS' },
  { value: 'pending', label: 'CREDIT PENDING' },
  { value: 'used',    label: 'CREDIT FULLY USED' },
];

export default function OldMobileExchangeReport() {
  const { hasFullAccess } = useAuth();
  const navigate = useNavigate();

  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [shops, setShops]     = useState([]);
  const [expandedId, setExpandedId] = useState(null);

  const [filter, setFilter] = useState({
    from: '', to: '', type: '', credit_status: '', search: '', shop_id: '',
  });

  useEffect(() => {
    load();
    if (hasFullAccess()) api.get('/shops').then(r => setShops(r.data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    try {
      const { data: res } = await api.get('/reports/old-mobile-exchange', { params: filter });
      setData(res);
    } catch { toast.error('Failed to load old mobile report'); }
    finally  { setLoading(false); }
  }

  const f = v => setFilter(p => ({ ...p, ...v }));
  const reset = () => setFilter({ from: '', to: '', type: '', credit_status: '', search: '', shop_id: '' });

  const rows    = data?.rows ?? [];
  const summary = data?.summary ?? {};
  const inr = n => `₹${parseFloat(n || 0).toLocaleString('en-IN')}`;

  return (
    <div className="container-fluid py-3">
      <div className="page-header mb-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div>
          <h2 className="mb-0 fw-bold text-uppercase">📲 Old Mobile Exchange Report</h2>
          <p className="text-muted small mb-0 text-uppercase">Every device taken in — exchange credit &amp; cash payouts</p>
        </div>
        <div className="d-flex gap-2">
          <button onClick={load} className="btn btn-sm btn-primary fw-bold text-uppercase">🔄 Refresh</button>
        </div>
      </div>

      {/* Stats */}
      {data && (
        <div className="row g-2 mb-3">
          {[
            { label: 'Total Records',        value: summary.total_count,                      color: '#1e293b', bg: '#f1f5f9' },
            { label: 'Exchanges',             value: `${summary.exchange_count} · ${inr(summary.total_exchange_value)}`, color: '#7c3aed', bg: '#faf5ff' },
            { label: 'Cash Payouts',          value: `${summary.cash_count} · ${inr(summary.total_cash_value)}`,         color: '#0891b2', bg: '#ecfeff' },
            { label: 'Credit Pending (Total)',value: inr(summary.total_credit_pending),        color: summary.total_credit_pending > 0 ? '#dc2626' : '#16a34a', bg: summary.total_credit_pending > 0 ? '#fef2f2' : '#f0fdf4' },
          ].map(s => (
            <div key={s.label} className="col-6 col-md-3">
              <div style={{background: s.bg, border:`1.5px solid ${s.color}22`, borderRadius:10, padding:'10px 14px'}}>
                <div style={{fontSize:'.6rem', fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'.5px'}}>{s.label}</div>
                <div style={{fontSize:'1.1rem', fontWeight:900, color: s.color}}>{s.value}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="card shadow-sm mb-3 p-3" style={{border:'1px solid #e2e8f0'}}>
        <div className="row g-2 align-items-end text-uppercase">
          <div className="col-12 col-md-3">
            <label className="small text-muted fw-bold mb-1">Date Range</label>
            <div className="input-group input-group-sm">
              <input type="date" className="form-control" value={filter.from} onChange={e => f({ from: e.target.value })} />
              <span className="input-group-text">—</span>
              <input type="date" className="form-control" value={filter.to} onChange={e => f({ to: e.target.value })} />
            </div>
          </div>
          <div className="col-6 col-md-2">
            <label className="small text-muted fw-bold mb-1">Type</label>
            <select className="form-select form-select-sm" value={filter.type} onChange={e => f({ type: e.target.value })}>
              {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="col-6 col-md-2">
            <label className="small text-muted fw-bold mb-1">Credit Status</label>
            <select className="form-select form-select-sm" value={filter.credit_status} onChange={e => f({ credit_status: e.target.value })}>
              {CREDIT_STATUS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="col-6 col-md-2">
            <label className="small text-muted fw-bold mb-1">Search</label>
            <input type="text" className="form-control form-control-sm" placeholder="Customer, phone, model, IMEI"
              value={filter.search} onChange={e => f({ search: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && load()} />
          </div>
          {hasFullAccess() && (
            <div className="col-6 col-md-1">
              <label className="small text-muted fw-bold mb-1">Shop</label>
              <select className="form-select form-select-sm" value={filter.shop_id} onChange={e => f({ shop_id: e.target.value })}>
                <option value="">ALL</option>
                {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
          <div className="col-6 col-md-1">
            <button className="btn btn-sm btn-primary fw-bold w-100" onClick={load}>GO</button>
          </div>
          <div className="col-6 col-md-1">
            <button className="btn btn-sm btn-outline-secondary fw-bold w-100" onClick={reset}>RESET</button>
          </div>
        </div>
      </div>

      <div style={{fontSize:'.68rem', color:'#94a3b8', marginBottom:10}}>
        ℹ️ &quot;New phone / credit status&quot; is matched per customer (total credit given vs. total credit spent across all their exchange-paid sales) —
        there's no record of exactly which trade-in paid for which purchase, so treat this as a best-effort summary, not a guaranteed link.
      </div>

      {loading ? (
        <div className="text-center py-5"><div className="spinner-border text-primary" /></div>
      ) : (
        <div style={{background:'#fff', borderRadius:10, border:'1px solid #e2e8f0', overflow:'hidden'}}>
          <div className="table-responsive">
            <table style={{width:'100%', borderCollapse:'collapse', fontSize:'.78rem'}}>
              <thead>
                <tr style={{background:'#f1f5f9', borderBottom:'2px solid #cbd5e1'}}>
                  {['DATE','CUSTOMER','OLD PHONE TAKEN IN','TYPE','VALUE','NEW PHONE (CREDIT USE)','CREDIT STATUS','STAFF',''].map(h => (
                    <th key={h} style={{padding:'10px 12px', fontSize:'.6rem', fontWeight:700, color:'#475569', textTransform:'uppercase', letterSpacing:'1px', border:'1px solid #e2e8f0',
                        textAlign: h === 'VALUE' ? 'right' : 'left'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-5 text-muted fw-bold text-uppercase">No old mobile purchases found for this filter</td></tr>
                ) : rows.map(r => {
                  const isOpen = expandedId === r.id;
                  const hasMultiple = r.funded_purchases.length > 1;
                  return (
                    <Fragment key={r.id}>
                      <tr style={{borderBottom:'1px solid #e2e8f0'}}>
                        <td style={{padding:'10px 12px', border:'1px solid #e2e8f0', whiteSpace:'nowrap'}}>
                          <div className="fw-bold">{formatDate(r.purchase_date)}</div>
                          {hasFullAccess() && <div style={{fontSize:'.6rem', color:'#94a3b8'}}>{r.shop_name}</div>}
                        </td>
                        <td style={{padding:'10px 12px', border:'1px solid #e2e8f0'}}>
                          <div className="fw-bold">{r.customer_name}</div>
                          <div style={{fontSize:'.65rem', color:'#64748b'}}>📞 {r.customer_phone}</div>
                        </td>
                        <td style={{padding:'10px 12px', border:'1px solid #e2e8f0', maxWidth:170}}>
                          <div className="fw-bold" style={{fontSize:'.75rem'}}>{r.model_name}</div>
                          {r.specs && <div style={{fontSize:'.62rem', color:'#475569'}}>{r.specs}</div>}
                          {r.imei && <div style={{fontSize:'.6rem', color:'#94a3b8'}}>IMEI: {r.imei}</div>}
                        </td>
                        <td style={{padding:'10px 12px', border:'1px solid #e2e8f0'}}>
                          <span style={{
                            fontSize:'.62rem', fontWeight:800, padding:'2px 8px', borderRadius:20, display:'inline-block',
                            background: r.is_exchange ? '#faf5ff' : '#ecfeff',
                            color: r.is_exchange ? '#7c3aed' : '#0891b2',
                          }}>{r.is_exchange ? 'EXCHANGE' : 'CASH PAYOUT'}</span>
                        </td>
                        <td style={{padding:'10px 12px', border:'1px solid #e2e8f0', textAlign:'right', fontWeight:700, whiteSpace:'nowrap'}}>
                          {inr(r.purchase_price)}
                          {r.selling_price > 0 && <div style={{fontSize:'.6rem', color:'#94a3b8', fontWeight:400}}>Target: {inr(r.selling_price)}</div>}
                        </td>
                        <td style={{padding:'10px 12px', border:'1px solid #e2e8f0', maxWidth:220}}>
                          {!r.is_exchange ? (
                            <span style={{color:'#cbd5e1'}}>—</span>
                          ) : r.funded_purchases.length === 0 ? (
                            <span style={{fontSize:'.68rem', color:'#94a3b8', fontStyle:'italic'}}>Not used yet</span>
                          ) : hasMultiple ? (
                            <button onClick={() => setExpandedId(isOpen ? null : r.id)}
                              style={{fontSize:'.65rem', fontWeight:700, background:'#eff6ff', color:'#1d4ed8', border:'1px solid #bfdbfe', borderRadius:6, padding:'3px 8px', cursor:'pointer'}}>
                              {r.funded_purchases.length} purchases {isOpen ? '▲' : '▼'}
                            </button>
                          ) : (
                            <div>
                              <div className="fw-bold" style={{fontSize:'.72rem'}}>{r.funded_purchases[0].product_name}</div>
                              <div style={{fontSize:'.62rem', color:'#64748b'}}>
                                {inr(r.funded_purchases[0].grand_total)} · {inr(r.funded_purchases[0].credit_used)} credit used
                              </div>
                            </div>
                          )}
                        </td>
                        <td style={{padding:'10px 12px', border:'1px solid #e2e8f0'}}>
                          {!r.is_exchange ? (
                            <span style={{color:'#cbd5e1'}}>—</span>
                          ) : (
                            <>
                              <span style={{
                                fontSize:'.62rem', fontWeight:800, padding:'3px 10px', borderRadius:20, display:'inline-block',
                                background: r.credit_pending > 0 ? '#fee2e2' : '#dcfce7',
                                color: r.credit_pending > 0 ? '#dc2626' : '#16a34a',
                              }}>{r.credit_pending > 0 ? `PENDING ${inr(r.credit_pending)}` : 'FULLY USED'}</span>
                              <div style={{fontSize:'.58rem', color:'#94a3b8', marginTop:2}}>Given {inr(r.credit_given)} · Used {inr(r.credit_used)}</div>
                            </>
                          )}
                        </td>
                        <td style={{padding:'10px 12px', border:'1px solid #e2e8f0', fontSize:'.7rem'}}>{r.staff_name}</td>
                        <td style={{padding:'10px 12px', border:'1px solid #e2e8f0', textAlign:'center'}}>
                          <button onClick={() => navigate(`/old-mobiles`)}
                            style={{padding:'4px 10px', fontSize:'.62rem', fontWeight:800, background:'#f1f5f9', color:'#1e293b', border:'1px solid #cbd5e1', borderRadius:6, cursor:'pointer'}}>
                            VIEW
                          </button>
                        </td>
                      </tr>
                      {isOpen && hasMultiple && (
                        <tr>
                          <td colSpan={9} style={{padding:'8px 12px 12px 40px', border:'1px solid #e2e8f0', background:'#f8fafc'}}>
                            <table style={{width:'100%', fontSize:'.7rem'}}>
                              <thead>
                                <tr style={{color:'#94a3b8', textTransform:'uppercase', fontSize:'.6rem'}}>
                                  <th style={{textAlign:'left', padding:'2px 8px'}}>Invoice</th>
                                  <th style={{textAlign:'left', padding:'2px 8px'}}>Date</th>
                                  <th style={{textAlign:'left', padding:'2px 8px'}}>New Phone</th>
                                  <th style={{textAlign:'right', padding:'2px 8px'}}>Price</th>
                                  <th style={{textAlign:'right', padding:'2px 8px'}}>Credit Used</th>
                                </tr>
                              </thead>
                              <tbody>
                                {r.funded_purchases.map(fp => (
                                  <tr key={fp.invoice_id}>
                                    <td style={{padding:'2px 8px', fontWeight:700}}>{fp.invoice_no}</td>
                                    <td style={{padding:'2px 8px'}}>{formatDate(fp.sale_date)}</td>
                                    <td style={{padding:'2px 8px'}}>{fp.product_name}</td>
                                    <td style={{padding:'2px 8px', textAlign:'right'}}>{inr(fp.grand_total)}</td>
                                    <td style={{padding:'2px 8px', textAlign:'right', color:'#1d4ed8', fontWeight:700}}>{inr(fp.credit_used)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr style={{background:'#f8fafc', borderTop:'2px solid #cbd5e1', fontWeight:900}}>
                    <td colSpan={4} style={{padding:'10px 12px', border:'1px solid #e2e8f0', fontSize:'.75rem', color:'#1e293b'}}>
                      TOTAL ({rows.length} records)
                    </td>
                    <td style={{padding:'10px 12px', border:'1px solid #e2e8f0', textAlign:'right', whiteSpace:'nowrap'}}>
                      {inr(rows.reduce((s, r) => s + parseFloat(r.purchase_price), 0))}
                    </td>
                    <td colSpan={4} style={{padding:'10px 12px', border:'1px solid #e2e8f0'}}>
                      <span style={{fontSize:'.7rem', color:'#dc2626', fontWeight:800}}>
                        Credit Pending: {inr(summary.total_credit_pending)}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
