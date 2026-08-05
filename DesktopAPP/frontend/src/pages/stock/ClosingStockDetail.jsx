import { useState, useEffect, useCallback, Fragment } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import axios from '../../api/axios';

const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export default function ClosingStockDetail() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const today = new Date().toISOString().slice(0, 10);
  const date = searchParams.get('date') || today;

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [color, setColor] = useState('');
  const [ram, setRam] = useState('');
  const [storage, setStorage] = useState('');
  const [imei, setImei] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get('/stocks/closing-stock-detail', { params: { date } });
      setRows(data.rows || []);
      setTotal(data.total || 0);
    } catch {
      toast.error('Failed to load closing stock detail');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const setDate = (val) => setSearchParams(val ? { date: val } : {});

  const filtered = rows.filter(r => {
    const s = search.trim().toUpperCase();
    if (s && !`${r.company} ${r.model}`.toUpperCase().includes(s)) return false;
    if (color && !(r.color || '').toUpperCase().includes(color.toUpperCase())) return false;
    if (ram && !(r.ram || '').toUpperCase().includes(ram.toUpperCase())) return false;
    if (storage && !(r.storage || '').toUpperCase().includes(storage.toUpperCase())) return false;
    if (imei && !(r.imeis || []).some(i => i.includes(imei))) return false;
    return true;
  });

  const filteredTotal = filtered.reduce((sum, r) => sum + r.pcs, 0);
  const hasFilters = search || color || ram || storage || imei;
  const clearFilters = () => { setSearch(''); setColor(''); setRam(''); setStorage(''); setImei(''); };

  // Group filtered rows by company, matching Model Wise Stock's layout/visual language.
  const grouped = {};
  filtered.forEach(r => {
    if (!grouped[r.company]) grouped[r.company] = { total: 0, variants: [] };
    grouped[r.company].total += r.pcs;
    grouped[r.company].variants.push(r);
  });
  const sortedCompanies = Object.keys(grouped).sort();

  const PS = `
    .pm-wrap{background:#f1f5f9;min-height:100vh;padding:20px;}
    .pm-hero{background:linear-gradient(135deg,#1a1a2e 0%,#16213e 60%,#0f3460 100%);border-radius:16px;padding:22px 28px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;}
    .pm-hero h2{color:#fff;font-size:1.15rem;font-weight:800;letter-spacing:1px;margin:0;}
    .pm-hero p{color:rgba(255,255,255,.5);font-size:.7rem;margin:2px 0 0;letter-spacing:.5px;}
    .pm-back-btn{background:rgba(255,255,255,0.08);border:1.5px solid rgba(255,255,255,0.15);color:#fff;padding:7px 16px;border-radius:8px;font-size:.75rem;font-weight:700;cursor:pointer;text-decoration:none;}
    .pm-back-btn:hover{background:rgba(255,255,255,0.15);color:#fff;}
    .pm-filters{background:#fff;border-radius:14px;padding:16px 18px;margin-bottom:16px;box-shadow:0 2px 12px rgba(0,0,0,.06);}
    .pm-flabel{font-size:.63rem;font-weight:800;letter-spacing:.8px;color:#94a3b8;text-transform:uppercase;margin-bottom:4px;display:block;}
    .pm-finput{font-size:.78rem;border:1.5px solid #e2e8f0;border-radius:8px;padding:5px 10px;width:100%;background:#f8fafc;transition:border-color .15s;}
    .pm-finput:focus{outline:none;border-color:#6366f1;background:#fff;}
    .pm-clear-btn{font-size:.7rem;font-weight:700;padding:5px 12px;border-radius:8px;border:1.5px solid #e2e8f0;background:#fff;color:#64748b;cursor:pointer;transition:all .15s;}
    .pm-clear-btn:hover{border-color:#ef4444;color:#ef4444;}
    .pm-table-wrap{background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06);}
    .pm-table{width:100%;border-collapse:collapse;font-size:.78rem;}
    .pm-table thead tr{background:linear-gradient(135deg,#1e293b,#0f172a);}
    .pm-table thead th{color:rgba(255,255,255,.7);font-size:.62rem;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:11px 14px;border:none;}
    .pm-table tbody tr{border-bottom:1px solid #f1f5f9;transition:background .1s;}
    .pm-table tbody tr:hover{background:#f8fafc;}
    .pm-table td{padding:11px 14px;vertical-align:middle;border:none;color:#334155;}
    .pm-badge{font-size:.6rem;font-weight:700;padding:3px 10px;border-radius:20px;letter-spacing:.5px;display:inline-block;}
  `;

  return (
    <div className="pm-wrap">
      <style>{PS}</style>

      <div className="pm-hero">
        <div>
          <h2>🏪 Closing Stock — as of {fmtDate(date)}</h2>
          <p>Full breakdown of what was on hand as of this date</p>
        </div>
        <button className="pm-back-btn" onClick={() => navigate('/stock-entry')}>← Back to Stocks</button>
      </div>

      <div className="pm-filters">
        <div className="row g-2 align-items-end">
          <div className="col-6 col-md-2">
            <span className="pm-flabel">📅 As of Date</span>
            <input type="date" className="pm-finput" value={date} onChange={e => setDate(e.target.value)} max={today} />
          </div>
          <div className="col-6 col-md-2">
            <span className="pm-flabel">🔍 Company / Model</span>
            <input className="pm-finput" placeholder="e.g. VIVO V70" value={search} onChange={e => setSearch(e.target.value.toUpperCase())} />
          </div>
          <div className="col-6 col-md-2">
            <span className="pm-flabel">🎨 Color</span>
            <input className="pm-finput" placeholder="e.g. BLACK" value={color} onChange={e => setColor(e.target.value.toUpperCase())} />
          </div>
          <div className="col-6 col-md-2">
            <span className="pm-flabel">💾 RAM</span>
            <input className="pm-finput" placeholder="e.g. 8" value={ram} onChange={e => setRam(e.target.value)} />
          </div>
          <div className="col-6 col-md-2">
            <span className="pm-flabel">📦 Storage</span>
            <input className="pm-finput" placeholder="e.g. 128" value={storage} onChange={e => setStorage(e.target.value)} />
          </div>
          <div className="col-6 col-md-2">
            <span className="pm-flabel">🆔 IMEI</span>
            <input className="pm-finput" placeholder="Search IMEI" value={imei} onChange={e => setImei(e.target.value)} />
          </div>
          {hasFilters && (
            <div className="col-12 d-flex align-items-center gap-2 mt-2">
              <span className="text-muted small">
                Showing {filtered.length} of {rows.length} variants · {filteredTotal} of {total} pcs
              </span>
              <button className="pm-clear-btn" onClick={clearFilters}>✕ Clear Filters</button>
            </div>
          )}
        </div>
      </div>

      <div className="pm-table-wrap">
        <div className="table-responsive">
          <table className="pm-table">
            <thead>
              <tr>
                <th className="ps-4" style={{ width: '30%' }}>Company / Brand</th>
                <th style={{ width: '45%' }}>Model & Configuration</th>
                <th className="text-center" style={{ width: '25%' }}>Total Stock</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={3} className="text-center py-5"><div className="spinner-border text-primary" /></td></tr>
              ) : sortedCompanies.length === 0 ? (
                <tr><td colSpan={3} className="text-center py-5 text-muted fw-bold">📭 No stock on hand{hasFilters ? ' matching these filters' : ' as of this date'}</td></tr>
              ) : (
                <>
                  <tr style={{ background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)', borderBottom: '2px solid #e2e8f0' }}>
                    <td className="ps-4 text-uppercase" style={{ fontSize: '.8rem', fontWeight: 800, color: '#475569' }}>
                      📈 SUMMARY: {sortedCompanies.length} COMPANIES
                    </td>
                    <td className="text-uppercase" style={{ fontSize: '.8rem', fontWeight: 800, color: '#475569' }}>
                      {filtered.length} TOTAL VARIANTS
                    </td>
                    <td className="text-center">
                      <span className="pm-badge" style={{ background: '#1e293b', color: '#fff', fontSize: '.85rem', padding: '5px 12px' }}>
                        {hasFilters ? filteredTotal : total} PCS TOTAL
                      </span>
                    </td>
                  </tr>
                  {sortedCompanies.map(company => (
                    <Fragment key={company}>
                      <tr style={{ background: '#f8fafc', borderLeft: '4px solid #6366f1' }}>
                        <td className="ps-4 fw-800 text-primary" style={{ fontSize: '.85rem' }}>🏢 {company}</td>
                        <td className="text-muted small italic">{grouped[company].variants.length} Variants</td>
                        <td className="text-center">
                          <span className="pm-badge" style={{ background: '#e0e7ff', color: '#4338ca', border: '1px solid #c7d2fe', fontWeight: '800', fontSize: '.75rem' }}>
                            {grouped[company].total} PCS
                          </span>
                        </td>
                      </tr>
                      {grouped[company].variants.map((r, i) => (
                        <tr key={company + i}>
                          <td className="ps-5"></td>
                          <td>
                            <div style={{ fontWeight: '700', color: '#334155', fontSize: '.78rem' }}>
                              📱 {r.model} {[r.ram, r.storage].filter(Boolean).length ? `(${[r.ram, r.storage].filter(Boolean).join('/')})` : ''}
                            </div>
                            <div style={{ marginTop: 3, fontSize: '.68rem', color: '#64748b' }}>
                              {r.color && <span>🎨 {r.color}</span>}
                              {r.color && r.imeis?.length > 0 && <span> · </span>}
                              {r.imeis && r.imeis.length > 0 && (
                                <span className="font-monospace">🆔 {r.imeis.join(', ')}</span>
                              )}
                              {r.imeis && r.imeis.length > 0 && r.imeis.length < r.pcs && (
                                <span className="text-muted"> ({r.imeis.length} of {r.pcs} units tracked)</span>
                              )}
                            </div>
                          </td>
                          <td className="text-center">
                            <span className="pm-badge" style={{
                              background: r.pcs > 0 ? '#f0fdf4' : '#fee2e2',
                              color: r.pcs > 0 ? '#166534' : '#991b1b',
                              border: `1px solid ${r.pcs > 0 ? '#bbf7d0' : '#fecaca'}`,
                              minWidth: '60px',
                              fontSize: '.7rem'
                            }}>
                              {r.pcs} PCS
                            </span>
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
