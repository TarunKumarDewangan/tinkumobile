import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import { formatDate } from '../../utils/formatters';
import { useAuth } from '../../contexts/AuthContext';

const SALE_TYPES = [
  { value: '', label: 'ALL TYPES' },
  { value: 'new',   label: 'NEW MOBILE' },
  { value: 'old',   label: '2ND HAND MOBILE' },
  { value: 'other', label: 'OTHER PRODUCTS' },
];

const FIN_STATUS = [
  { value: '',         label: 'ALL STATUS' },
  { value: 'RECEIVED', label: 'RECEIVED' },
  { value: 'PENDING',  label: 'PENDING' },
];

export default function FinancerReport() {
  const { hasFullAccess } = useAuth();
  const navigate = useNavigate();

  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [shops, setShops]     = useState([]);
  const [view, setView]       = useState('list'); // 'list' | 'financer'

  const [filter, setFilter] = useState({
    from: '', to: '', financer_id: '', sale_type: '',
    bill_type: '', finance_status: '', shop_id: '',
  });

  useEffect(() => {
    load();
    if (hasFullAccess()) api.get('/shops').then(r => setShops(r.data));
  }, []);

  async function load() {
    setLoading(true);
    try {
      const { data: res } = await api.get('/reports/financer', { params: filter });
      setData(res);
    } catch { toast.error('Failed to load financer report'); }
    finally  { setLoading(false); }
  }

  const f = v => setFilter(p => ({ ...p, ...v }));

  const summary = data?.summary ?? {};
  const byFinancer = data?.by_financer ?? [];
  const invoices   = data?.invoices ?? [];
  const financers  = data?.financers ?? [];

  const saleTypeColor = { 'New Mobile': '#1d4ed8', '2nd Hand': '#0891b2', 'Other': '#7c3aed' };
  const saleTypeBg    = { 'New Mobile': '#eff6ff', '2nd Hand': '#ecfeff', 'Other': '#faf5ff' };

  return (
    <div className="container-fluid py-3">
      <div className="page-header mb-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div>
          <h2 className="mb-0 fw-bold text-uppercase">🏦 Financer Report</h2>
          <p className="text-muted small mb-0 text-uppercase">External Finance / EMI — All Financed Sales</p>
        </div>
        <div className="d-flex gap-2">
          <button onClick={load} className="btn btn-sm btn-primary fw-bold text-uppercase">🔄 Refresh</button>
        </div>
      </div>

      {/* Stats */}
      {data && (
        <div className="row g-2 mb-3">
          {[
            { label: 'Total Sales',     value: summary.total_sales,                                          color: '#1e293b', bg: '#f1f5f9' },
            { label: 'Total Financed',  value: `₹${parseFloat(summary.total_financed||0).toLocaleString('en-IN')}`, color: '#1d4ed8', bg: '#eff6ff' },
            { label: 'Received',        value: `₹${parseFloat(summary.total_received||0).toLocaleString('en-IN')}`, color: '#16a34a', bg: '#f0fdf4' },
            { label: 'Pending from Financer', value: `₹${parseFloat(summary.total_pending||0).toLocaleString('en-IN')}`, color: '#dc2626', bg: '#fef2f2' },
            { label: 'Financers',       value: byFinancer.length,                                            color: '#7c3aed', bg: '#faf5ff' },
          ].map(s => (
            <div key={s.label} className="col-6 col-md-2">
              <div style={{background: s.bg, border:`1.5px solid ${s.color}22`, borderRadius:10, padding:'10px 14px'}}>
                <div style={{fontSize:'.6rem', fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'.5px'}}>{s.label}</div>
                <div style={{fontSize:'1.2rem', fontWeight:900, color: s.color}}>{s.value}</div>
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
            <label className="small text-muted fw-bold mb-1">Financer</label>
            <select className="form-select form-select-sm fw-bold" value={filter.financer_id} onChange={e => f({ financer_id: e.target.value })}>
              <option value="">ALL FINANCERS</option>
              {financers.map(fn => <option key={fn.id} value={fn.id}>{fn.name}</option>)}
            </select>
          </div>
          <div className="col-6 col-md-2">
            <label className="small text-muted fw-bold mb-1">Sale Type</label>
            <select className="form-select form-select-sm" value={filter.sale_type} onChange={e => f({ sale_type: e.target.value })}>
              {SALE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="col-6 col-md-2">
            <label className="small text-muted fw-bold mb-1">Finance Status</label>
            <select className="form-select form-select-sm" value={filter.finance_status} onChange={e => f({ finance_status: e.target.value })}>
              {FIN_STATUS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="col-6 col-md-1">
            <label className="small text-muted fw-bold mb-1">Bill</label>
            <select className="form-select form-select-sm" value={filter.bill_type} onChange={e => f({ bill_type: e.target.value })}>
              <option value="">ALL</option>
              <option value="kaccha">KACCHA</option>
              <option value="pakka">PAKKA</option>
            </select>
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
            <button className="btn btn-sm btn-outline-secondary fw-bold w-100"
              onClick={() => { setFilter({ from:'',to:'',financer_id:'',sale_type:'',bill_type:'',finance_status:'',shop_id:'' }); }}>
              RESET
            </button>
          </div>
        </div>
      </div>

      {/* View Toggle */}
      <div className="d-flex gap-2 mb-3">
        {[['list', '📋 Invoice List'], ['financer', '🏦 Financer Summary']].map(([v, l]) => (
          <button key={v} onClick={() => setView(v)}
            style={{
              padding: '5px 18px', fontSize: '.72rem', fontWeight: 800, borderRadius: 20,
              border: '1.5px solid #cbd5e1', cursor: 'pointer', textTransform: 'uppercase',
              background: view === v ? '#1e293b' : '#f8fafc',
              color: view === v ? '#fff' : '#64748b',
            }}>{l}</button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-5"><div className="spinner-border text-primary" /></div>
      ) : !data ? null : view === 'financer' ? (

        /* ── FINANCER SUMMARY VIEW ─────────────────────────────────── */
        <div>
          {byFinancer.length === 0 ? (
            <div className="text-center text-muted py-5 fw-bold text-uppercase">No financed sales found</div>
          ) : byFinancer.map(fn => {
            const pct = fn.total_financed > 0 ? Math.round(fn.total_received / fn.total_financed * 100) : 0;
            return (
              <div key={fn.financer_id} style={{background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:'20px 24px', marginBottom:12}}>
                <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
                  <div>
                    <div style={{fontSize:'1.1rem', fontWeight:900, color:'#1e293b'}}>{fn.financer_name}</div>
                    <div style={{fontSize:'.7rem', color:'#64748b', marginTop:2}}>{fn.count} invoice{fn.count > 1 ? 's' : ''}</div>
                  </div>
                  <div className="d-flex gap-3 flex-wrap">
                    {[
                      { label: 'Total Financed', val: fn.total_financed, color: '#1d4ed8' },
                      { label: 'Received',       val: fn.total_received, color: '#16a34a' },
                      { label: 'Pending',        val: fn.total_pending,  color: fn.total_pending > 0 ? '#dc2626' : '#16a34a' },
                    ].map(s => (
                      <div key={s.label} className="text-end">
                        <div style={{fontSize:'.6rem', color:'#64748b', fontWeight:700, textTransform:'uppercase'}}>{s.label}</div>
                        <div style={{fontSize:'.95rem', fontWeight:900, color: s.color}}>₹{parseFloat(s.val).toLocaleString('en-IN')}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{marginTop:12}}>
                  <div style={{height:8, background:'#e2e8f0', borderRadius:8, overflow:'hidden'}}>
                    <div style={{height:'100%', width:`${pct}%`, background: pct === 100 ? '#16a34a' : '#1d4ed8', borderRadius:8, transition:'width .4s'}} />
                  </div>
                  <div style={{fontSize:'.65rem', color:'#64748b', marginTop:3, fontWeight:700}}>{pct}% received</div>
                </div>

                {/* Mini table of invoices under this financer */}
                <div style={{marginTop:12, overflowX:'auto'}}>
                  <table style={{width:'100%', borderCollapse:'collapse', fontSize:'.73rem'}}>
                    <thead>
                      <tr style={{background:'#f8fafc', borderBottom:'1px solid #e2e8f0'}}>
                        {['DATE', 'INVOICE', 'CUSTOMER', 'PRODUCT', 'GRAND TOTAL', 'FINANCE AMT', 'STATUS', ''].map(h => (
                          <th key={h} style={{padding:'6px 10px', fontSize:'.6rem', fontWeight:700, color:'#64748b', textTransform:'uppercase', textAlign: h === 'GRAND TOTAL' || h === 'FINANCE AMT' ? 'right' : 'left'}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.filter(inv => inv.financer_id === fn.financer_id).map(inv => (
                        <tr key={inv.id} style={{borderBottom:'1px solid #f1f5f9'}}>
                          <td style={{padding:'6px 10px', whiteSpace:'nowrap'}}>{formatDate(inv.sale_date)}</td>
                          <td style={{padding:'6px 10px', fontWeight:700, color:'#1e293b'}}>{inv.invoice_no}</td>
                          <td style={{padding:'6px 10px'}}>
                            <div>{inv.customer_name}</div>
                            <div style={{fontSize:'.62rem', color:'#94a3b8'}}>{inv.customer_phone}</div>
                          </td>
                          <td style={{padding:'6px 10px'}}>
                            <div style={{fontWeight:600}}>{inv.product_name}</div>
                            {inv.specs && <div style={{fontSize:'.62rem', color:'#64748b'}}>{inv.specs}</div>}
                          </td>
                          <td style={{padding:'6px 10px', textAlign:'right', fontWeight:700}}>₹{parseFloat(inv.grand_total).toLocaleString('en-IN')}</td>
                          <td style={{padding:'6px 10px', textAlign:'right', fontWeight:700, color:'#1d4ed8'}}>₹{parseFloat(inv.finance_amount).toLocaleString('en-IN')}</td>
                          <td style={{padding:'6px 10px'}}>
                            <span style={{
                              fontSize:'.6rem', fontWeight:800, padding:'2px 8px', borderRadius:20,
                              background: inv.finance_payment_status === 'RECEIVED' ? '#dcfce7' : '#fee2e2',
                              color: inv.finance_payment_status === 'RECEIVED' ? '#16a34a' : '#dc2626',
                            }}>{inv.finance_payment_status}</span>
                          </td>
                          <td style={{padding:'6px 10px'}}>
                            <button onClick={() => navigate(`/sales/${inv.id}`)}
                              style={{padding:'2px 8px', fontSize:'.6rem', fontWeight:700, background:'#f1f5f9', border:'1px solid #cbd5e1', borderRadius:4, cursor:'pointer'}}>
                              VIEW
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>

      ) : (

        /* ── INVOICE LIST VIEW ─────────────────────────────────────── */
        <div style={{background:'#fff', borderRadius:10, border:'1px solid #e2e8f0', overflow:'hidden'}}>
          <div className="table-responsive">
            <table style={{width:'100%', borderCollapse:'collapse', fontSize:'.78rem'}}>
              <thead>
                <tr style={{background:'#f1f5f9', borderBottom:'2px solid #cbd5e1'}}>
                  {['DATE','CUSTOMER','PRODUCT','TYPE','GRAND TOTAL','DOWN PMT','FINANCED','FINANCER','STATUS','INVOICE',''].map(h => (
                    <th key={h} style={{padding:'10px 12px', fontSize:'.6rem', fontWeight:700, color:'#475569', textTransform:'uppercase', letterSpacing:'1px', border:'1px solid #e2e8f0',
                        textAlign: ['GRAND TOTAL','DOWN PMT','FINANCED'].includes(h) ? 'right' : 'left'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 ? (
                  <tr><td colSpan={11} className="text-center py-5 text-muted fw-bold text-uppercase">No financed sales found for this filter</td></tr>
                ) : invoices.map(inv => (
                  <tr key={inv.id} style={{borderBottom:'1px solid #e2e8f0'}}>
                    <td style={{padding:'10px 12px', border:'1px solid #e2e8f0', whiteSpace:'nowrap'}}>
                      <div className="fw-bold">{formatDate(inv.sale_date)}</div>
                      {hasFullAccess() && <div style={{fontSize:'.6rem', color:'#94a3b8'}}>{inv.shop_name}</div>}
                    </td>
                    <td style={{padding:'10px 12px', border:'1px solid #e2e8f0'}}>
                      <div className="fw-bold">{inv.customer_name}</div>
                      <div style={{fontSize:'.65rem', color:'#64748b'}}>📞 {inv.customer_phone}</div>
                    </td>
                    <td style={{padding:'10px 12px', border:'1px solid #e2e8f0', maxWidth:150}}>
                      <div className="fw-bold" style={{fontSize:'.75rem'}}>{inv.product_name}</div>
                      {inv.specs && <div style={{fontSize:'.62rem', color:'#475569'}}>{inv.specs}</div>}
                      {inv.imei && <div style={{fontSize:'.6rem', color:'#94a3b8'}}>IMEI: {inv.imei}</div>}
                    </td>
                    <td style={{padding:'10px 12px', border:'1px solid #e2e8f0'}}>
                      <span style={{
                        fontSize:'.62rem', fontWeight:800, padding:'2px 8px', borderRadius:20, display:'inline-block',
                        background: saleTypeBg[inv.sale_type] ?? '#f1f5f9',
                        color: saleTypeColor[inv.sale_type] ?? '#475569',
                      }}>{inv.sale_type}</span>
                      <div style={{fontSize:'.6rem', color:'#94a3b8', marginTop:2}}>{inv.bill_type?.toUpperCase()}</div>
                    </td>
                    <td style={{padding:'10px 12px', border:'1px solid #e2e8f0', textAlign:'right', fontWeight:700, whiteSpace:'nowrap'}}>
                      ₹{parseFloat(inv.grand_total).toLocaleString('en-IN')}
                    </td>
                    <td style={{padding:'10px 12px', border:'1px solid #e2e8f0', textAlign:'right', whiteSpace:'nowrap', color:'#16a34a', fontWeight:700}}>
                      ₹{parseFloat(inv.down_payment || 0).toLocaleString('en-IN')}
                    </td>
                    <td style={{padding:'10px 12px', border:'1px solid #e2e8f0', textAlign:'right', whiteSpace:'nowrap', color:'#1d4ed8', fontWeight:900}}>
                      ₹{parseFloat(inv.finance_amount).toLocaleString('en-IN')}
                    </td>
                    <td style={{padding:'10px 12px', border:'1px solid #e2e8f0', fontWeight:700, color:'#7c3aed', fontSize:'.75rem'}}>
                      {inv.financer_name}
                    </td>
                    <td style={{padding:'10px 12px', border:'1px solid #e2e8f0', textAlign:'center'}}>
                      <span style={{
                        fontSize:'.62rem', fontWeight:800, padding:'3px 10px', borderRadius:20, display:'inline-block',
                        background: inv.finance_payment_status === 'RECEIVED' ? '#dcfce7' : '#fee2e2',
                        color: inv.finance_payment_status === 'RECEIVED' ? '#16a34a' : '#dc2626',
                      }}>{inv.finance_payment_status}</span>
                    </td>
                    <td style={{padding:'10px 12px', border:'1px solid #e2e8f0', fontSize:'.7rem', fontWeight:700, color:'#1e293b'}}>
                      {inv.invoice_no}
                    </td>
                    <td style={{padding:'10px 12px', border:'1px solid #e2e8f0', textAlign:'center'}}>
                      <button onClick={() => navigate(`/sales/${inv.id}`)}
                        style={{padding:'4px 12px', fontSize:'.65rem', fontWeight:800, background:'#1d4ed8', color:'#fff', border:'none', borderRadius:6, cursor:'pointer'}}>
                        VIEW
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {invoices.length > 0 && (
                <tfoot>
                  <tr style={{background:'#f8fafc', borderTop:'2px solid #cbd5e1', fontWeight:900}}>
                    <td colSpan={4} style={{padding:'10px 12px', border:'1px solid #e2e8f0', fontSize:'.75rem', color:'#1e293b'}}>
                      TOTAL ({invoices.length} invoices)
                    </td>
                    <td style={{padding:'10px 12px', border:'1px solid #e2e8f0', textAlign:'right', whiteSpace:'nowrap'}}>
                      ₹{invoices.reduce((s,i) => s + parseFloat(i.grand_total), 0).toLocaleString('en-IN')}
                    </td>
                    <td style={{padding:'10px 12px', border:'1px solid #e2e8f0', textAlign:'right', whiteSpace:'nowrap', color:'#16a34a'}}>
                      ₹{invoices.reduce((s,i) => s + parseFloat(i.down_payment||0), 0).toLocaleString('en-IN')}
                    </td>
                    <td style={{padding:'10px 12px', border:'1px solid #e2e8f0', textAlign:'right', whiteSpace:'nowrap', color:'#1d4ed8'}}>
                      ₹{invoices.reduce((s,i) => s + parseFloat(i.finance_amount), 0).toLocaleString('en-IN')}
                    </td>
                    <td colSpan={4} style={{padding:'10px 12px', border:'1px solid #e2e8f0'}}>
                      <span style={{fontSize:'.7rem', color:'#16a34a', fontWeight:800}}>
                        Received: ₹{invoices.filter(i => i.finance_payment_status === 'RECEIVED').reduce((s,i) => s + parseFloat(i.finance_amount), 0).toLocaleString('en-IN')}
                      </span>
                      <span style={{fontSize:'.7rem', color:'#dc2626', fontWeight:800, marginLeft:12}}>
                        Pending: ₹{invoices.filter(i => i.finance_payment_status === 'PENDING').reduce((s,i) => s + parseFloat(i.finance_amount), 0).toLocaleString('en-IN')}
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
