import { useState, useEffect, useCallback } from 'react';
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

  return (
    <div>
      <div className="page-header">
        <h2>🏪 Closing Stock — as of {fmtDate(date)}</h2>
        <button className="btn btn-outline-secondary btn-sm" onClick={() => navigate('/stock-entry')}>← Back to Stocks</button>
      </div>

      <div className="table-card">
        <div className="p-3 border-bottom">
          <div className="row g-2 align-items-end">
            <div className="col-6 col-md-2">
              <label className="form-label x-small fw-bold text-muted mb-1">AS OF DATE</label>
              <input type="date" className="form-control form-control-sm" value={date} onChange={e => setDate(e.target.value)} max={today} />
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label x-small fw-bold text-muted mb-1">SEARCH COMPANY/MODEL</label>
              <input className="form-control form-control-sm" placeholder="e.g. VIVO V70" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label x-small fw-bold text-muted mb-1">COLOR</label>
              <input className="form-control form-control-sm" placeholder="e.g. BLACK" value={color} onChange={e => setColor(e.target.value)} />
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label x-small fw-bold text-muted mb-1">RAM</label>
              <input className="form-control form-control-sm" placeholder="e.g. 8" value={ram} onChange={e => setRam(e.target.value)} />
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label x-small fw-bold text-muted mb-1">STORAGE</label>
              <input className="form-control form-control-sm" placeholder="e.g. 128" value={storage} onChange={e => setStorage(e.target.value)} />
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label x-small fw-bold text-muted mb-1">IMEI</label>
              <input className="form-control form-control-sm" placeholder="Search IMEI" value={imei} onChange={e => setImei(e.target.value)} />
            </div>
          </div>
          {hasFilters && (
            <div className="mt-2 d-flex align-items-center gap-2">
              <span className="text-muted small">
                Showing {filtered.length} of {rows.length} variants · {filteredTotal} of {total} pcs
              </span>
              <button className="btn btn-outline-secondary btn-sm" onClick={clearFilters}>✕ Clear Filters</button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-center py-5"><div className="spinner-border text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-5 text-muted fw-bold">📭 No stock on hand{hasFilters ? ' matching these filters' : ' as of this date'}</div>
        ) : (
          <table className="table table-hover align-middle mb-0" style={{ fontSize: '.82rem' }}>
            <thead className="table-light">
              <tr>
                <th className="ps-3">Company</th>
                <th>Model</th>
                <th>Configuration</th>
                <th>Color</th>
                <th>IMEI</th>
                <th className="text-center pe-3">PCS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={i}>
                  <td className="ps-3 fw-bold">{r.company}</td>
                  <td className="fw-bold">{r.model}</td>
                  <td>{[r.ram, r.storage].filter(Boolean).join(' / ') || '—'}</td>
                  <td>{r.color || '—'}</td>
                  <td>
                    {r.imeis && r.imeis.length > 0 ? (
                      <div className="d-flex flex-wrap gap-1">
                        {r.imeis.map((im, ii) => (
                          <span key={ii} className="badge bg-light text-dark border font-monospace" style={{ fontSize: '.7rem', fontWeight: 500 }}>{im}</span>
                        ))}
                      </div>
                    ) : '—'}
                    {r.imeis && r.imeis.length > 0 && r.imeis.length < r.pcs && (
                      <div className="text-muted x-small mt-1">({r.imeis.length} of {r.pcs} units have a tracked IMEI)</div>
                    )}
                  </td>
                  <td className="text-center pe-3">
                    <span className="badge bg-success" style={{ fontSize: '.78rem' }}>{r.pcs}</span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="fw-black bg-dark text-white">
                <td colSpan={5} className="ps-3 py-2">{hasFilters ? 'FILTERED TOTAL' : 'TOTAL'}</td>
                <td className="text-center pe-3">
                  <span className="badge bg-primary" style={{ fontSize: '.85rem' }}>{hasFilters ? filteredTotal : total}</span>
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
