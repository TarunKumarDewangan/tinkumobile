import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../../api/axios';
import { toast } from 'react-toastify';
import Modal from '../../components/Modal';
// import { format } from 'date-fns'; // REMOVED dependency

import { useAuth } from '../../contexts/AuthContext';
export default function AirtelDrops() {
  const { can, isManager, hasFullAccess } = useAuth();
  const navigate = useNavigate();
  const [drops, setDrops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [fromDate, setFromDate] = useState('2025-01-01');
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [retailerName, setRetailerName] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('');
  const [status, setStatus] = useState('all');
  const [followUpOnly, setFollowUpOnly] = useState(false);
  const [useRange, setUseRange] = useState(true);
  const [sortBy, setSortBy] = useState('name');
  const [order, setOrder] = useState('asc');

   const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  
  const [submitting, setSubmitting] = useState(false);

  const [summary, setSummary] = useState({ total_dropped: 0, total_recovered: 0, pending_recovery: 0, grand_total_pending: 0 });
  const [failedMsisdns, setFailedMsisdns] = useState([]);
  
  const [showHistory, setShowHistory] = useState(false);
  const [selectedRetailer, setSelectedRetailer] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    fetchDrops();
    fetchSummary();
  }, [date, fromDate, toDate, useRange, retailerName, minAmount, maxAmount, status, followUpOnly, paymentMode, sortBy, order]);

  const getParams = () => {
    let params = `?retailer_name=${retailerName}&min_amount=${minAmount}&max_amount=${maxAmount}&payment_mode=${paymentMode}&sort_by=${sortBy}&order=${order}`;
    if (status !== 'all') params += `&status=${status}`;
    if (followUpOnly) params += `&follow_up=1`;
    if (useRange) {
      params += `&from_date=${fromDate}&to_date=${toDate}`;
    } else {
      params += `&date=${date}`;
    }
    return params;
  };

  const fetchDrops = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`/airtel-drops${getParams()}`);
      setDrops(data.data);
    } catch (error) {
      toast.error('Failed to fetch drops');
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const { data } = await axios.get(`/airtel-drops/summary${getParams()}`);
      setSummary(data);
    } catch (error) {
      console.error('Summary fetch failed');
    }
  };

  const handleImport = async (e) => {
    e.preventDefault();
    const lines = importText.split('\n');
    const parsedDrops = lines.map(line => {
      const trimmed = line.trim();
      if (!trimmed) return null;
      
      // Split by TAB first (standard Excel behavior), then falling back to multiple spaces
      let parts = trimmed.split('\t');
      if (parts.length < 2) parts = trimmed.split(/\s{2,}/);
      if (parts.length < 2) parts = trimmed.split(/[\s_]+/); // Fallback to single spaces or underscores
      
      if (parts.length < 2) return null;
      
      const msisdn = parts[0].trim();
      if (/[a-zA-Z]/.test(msisdn)) return null; // Skip header rows
      
      let amount = 0;
      let refill_date = new Date().toISOString().split('T')[0]; // Default to today if nothing found

      // Robust parsing
      if (parts.length >= 4 && parts[1].includes('-') && parts[2].includes(':')) {
          // Case 1: MSISDN YYYY-MM-DD HH:MM:SS.SSS AMOUNT
          // Truncate milliseconds (.SSS) to match DB dateTime precision
          refill_date = `${parts[1].trim()} ${parts[2].trim()}`.split('.')[0];
          amount = parseFloat(parts[3].trim());
      } else if (parts.length >= 3) {
          // Case 2: MSISDN TIMESTAMP AMOUNT (timestamp is one part, e.g. from TAB)
          if (parts[1].includes('-') || parts[1].includes(':')) {
              refill_date = parts[1].trim().split('.')[0];
              amount = parseFloat(parts[2].trim());
          } else {
              // Maybe MSISDN AMOUNT TIMESTAMP
              amount = parseFloat(parts[1].trim());
              refill_date = parts[2].trim().split('.')[0];
          }
      } else {
          // Case 3: MSISDN AMOUNT (fallback to manual date)
          amount = parseFloat(parts[1].trim());
      }
      
      if (!msisdn || isNaN(amount)) return null;
      
      return { msisdn, amount, refill_date };
    }).filter(d => d !== null);

    console.log('Importing Drops:', parsedDrops);

    if (parsedDrops.length === 0) {
      toast.error('No valid data found to import');
      return;
    }

    try {
      const { data } = await axios.post('/airtel-drops/import', { drops: parsedDrops });
      
      const failures = data.errors ? data.errors.map(err => {
          const match = err.match(/MSISDN: (\d+)/);
          return match ? match[1] : err;
      }) : [];
      
      setFailedMsisdns(failures);

      if (failures.length > 0) {
          toast.warning(`Imported ${data.success}, skipped ${data.duplicates || 0} duplicates, but ${data.failed} failed.`);
      } else {
          let msg = `Imported ${data.success} new drops.`;
          if (data.duplicates > 0) msg += ` (Skipped ${data.duplicates} duplicates)`;
          toast.success(msg);
          setShowImport(false);
          setImportText('');
      }
      
      fetchDrops();
      fetchSummary();
    } catch (error) {
      console.error('Import Error:', error.response?.data);
      toast.error(error.response?.data?.message || 'Import failed');
    }
  };


  const handleDelete = async (id) => {
    if (!window.confirm('DELETE THIS DROP?')) return;
    try {
      await axios.delete(`/airtel-drops/${id}`);
      toast.success('Deleted');
      fetchDrops();
      fetchSummary();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Delete failed');
    }
  };

  const openHistory = async (r) => {
    setSelectedRetailer(r);
    setShowHistory(true);
    setLoadingHistory(true);
    try {
        const { data } = await axios.get(`/airtel-retailers/${r.id}`);
        setHistoryData(data);
    } catch (err) {
        toast.error('Failed to load history');
    } finally {
        setLoadingHistory(false);
    }
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setOrder(order === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setOrder('asc');
    }
  };

  return (
    <div className="container-fluid py-4">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <h2 className="h4 mb-0 text-uppercase fw-bold">Airtel Daily Drops</h2>
        <div className="d-flex gap-2 align-items-center">
            <div className="form-check form-switch me-2">
                <input className="form-check-input" type="checkbox" id="rangeSwitch" checked={useRange} onChange={e => setUseRange(e.target.checked)} />
                <label className="form-check-label small text-uppercase fw-bold" htmlFor="rangeSwitch">Range</label>
            </div>
          {!useRange ? (
              <input type="date" className="form-control form-control-sm" value={date} onChange={e => setDate(e.target.value)} />
          ) : (
              <div className="d-flex gap-1 align-items-center">
                  <input type="date" className="form-control form-control-sm" value={fromDate} onChange={e => setFromDate(e.target.value)} />
                  <span className="small">to</span>
                  <input type="date" className="form-control form-control-sm" value={toDate} onChange={e => setToDate(e.target.value)} />
              </div>
          )}

          {can('manage_airtel_recovery') && (
            <>
              {hasFullAccess() && (
                <>
                  <button 
                    className="btn btn-outline-danger btn-sm text-uppercase px-3" 
                    onClick={async () => {
                      const confirmDate = useRange ? `${fromDate} to ${toDate}` : date;
                      if (window.confirm(`DELETE ALL DROPS FOR ${confirmDate}?`)) {
                        try {
                          const params = useRange ? { from_date: fromDate, to_date: toDate } : { date };
                          await axios.post('/airtel-drops/bulk-delete', params);
                          toast.success('Cleared drops for the selected period');
                          fetchDrops();
                          fetchSummary();
                        } catch (err) {
                          toast.error('Clear failed');
                        }
                      }
                    }}
                  >
                    Clear Drops
                  </button>
                  <button 
                    className="btn btn-danger btn-sm text-uppercase px-3" 
                    onClick={async () => {
                      if (window.confirm('WARNING: DELETE ALL RECOVERY PAYMENTS FROM THE ENTIRE SYSTEM? This cannot be undone.')) {
                        try {
                          await axios.post('/airtel-recoveries/bulk-delete');
                          toast.success('All system recoveries have been cleared');
                          fetchDrops();
                          fetchSummary();
                        } catch (err) {
                          toast.error('Clear failed');
                        }
                      }
                    }}
                  >
                    Clear All Payments
                  </button>
                </>
              )}
              <button className="btn btn-primary btn-sm text-uppercase px-4" onClick={() => {
                  setShowImport(true);
              }}>
                Import
              </button>
            </>
          )}
        </div>
      </div>

      <div className="card shadow-sm border-0 mb-4 bg-light">
          <div className="card-body py-3">
              <div className="row g-2 align-items-end">
                  <div className="col-md-3">
                      <label className="x-small text-uppercase fw-bold mb-1 d-block">Search Retailer Name / MSISDN</label>
                      <input 
                        type="text" 
                        className="form-control form-control-sm" 
                        placeholder="Search..." 
                        value={retailerName} 
                        onChange={e => setRetailerName(e.target.value)} 
                      />
                  </div>
                  <div className="col-md-2">
                      <label className="x-small text-uppercase fw-bold mb-1 d-block">Min Amount</label>
                      <input 
                        type="number" 
                        className="form-control form-control-sm" 
                        placeholder="0" 
                        value={minAmount} 
                        onChange={e => setMinAmount(e.target.value)} 
                      />
                  </div>
                  <div className="col-md-2">
                      <label className="x-small text-uppercase fw-bold mb-1 d-block">Max Amount</label>
                      <input 
                        type="number" 
                        className="form-control form-control-sm" 
                        placeholder="Any" 
                        value={maxAmount} 
                        onChange={e => setMaxAmount(e.target.value)} 
                      />
                  </div>
                  <div className="col-md-2">
                      <label className="x-small text-uppercase fw-bold mb-1 d-block">Payment Mode</label>
                      <select className="form-select form-select-sm" value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
                          <option value="">ALL MODES</option>
                          <option value="CASH">CASH</option>
                          <option value="PHONE PE">PHONE PE</option>
                          <option value="GPAY">GPAY</option>
                          <option value="DIGITAL">DIGITAL</option>
                          <option value="OTHER">OTHER</option>
                      </select>
                  </div>
                  <div className="col-md-2">
                      <div className="form-check form-switch mt-2">
                          <input className="form-check-input" type="checkbox" id="followUpSwitch" checked={followUpOnly} onChange={e => setFollowUpOnly(e.target.checked)} />
                          <label className="form-check-label x-small text-uppercase fw-bold" htmlFor="followUpSwitch">Follow-up Only</label>
                      </div>
                  </div>
                  <div className="col text-end">
                      <button 
                        className="btn btn-link btn-sm text-decoration-none text-muted p-0" 
                        onClick={() => {
                            setRetailerName(''); setMinAmount(''); setMaxAmount(''); setStatus('all'); setPaymentMode(''); setFollowUpOnly(false); setUseRange(true);
                            setFromDate('2025-01-01'); setToDate(new Date().toISOString().split('T')[0]);
                        }}
                      >
                          RESET FILTERS
                      </button>
                  </div>
              </div>
              <div className="row mt-2 g-2">
                  <div className="col-md-12">
                      <div className="btn-group w-100 shadow-sm text-uppercase fw-bold">
                          <button className={`btn btn-sm ${status === 'all' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setStatus('all')}>All Accounts</button>
                          <button className={`btn btn-sm ${status === 'pending_only' ? 'btn-warning text-dark' : 'btn-outline-warning'}`} onClick={() => setStatus('pending_only')}>Pending</button>
                          <button className={`btn btn-sm ${status === 'recovered_only' ? 'btn-success' : 'btn-outline-success'}`} onClick={() => setStatus('recovered_only')}>Full Recovered</button>
                      </div>
                  </div>
              </div>
          </div>
      </div>

      <div className="row g-2 mb-4 text-center">
        <div className="col-md col-6">
          <div className="card border-0 shadow-sm bg-white h-100 border-start border-4 border-primary">
            <div className="card-body py-3">
              <div className="x-small text-uppercase mb-1 text-muted fw-bold">Opening Balance</div>
              <div className="h5 mb-0 fw-bold">₹{parseFloat(summary.opening_balance || 0).toLocaleString()}</div>
            </div>
          </div>
        </div>
        <div className="col-md col-6">
          <div className="card border-0 shadow-sm bg-primary text-white h-100">
            <div className="card-body py-3">
              <div className="x-small text-uppercase mb-1 opacity-75">{useRange || retailerName ? 'Filtered Total' : 'Dropped Today'}</div>
              <div className="h5 mb-0 fw-bold">₹{parseFloat(summary.total_dropped).toLocaleString()}</div>
            </div>
          </div>
        </div>
        <div className="col-md col-6">
          <div className="card border-0 shadow-sm bg-success text-white h-100">
            <div className="card-body py-3">
              <div className="x-small text-uppercase mb-1 opacity-75">{useRange || retailerName ? 'Total Receivable' : 'Total Receivable'}</div>
              <div className="h5 mb-0 fw-bold">₹{parseFloat(summary.total_receivable || 0).toLocaleString()}</div>
            </div>
          </div>
        </div>
        <div className="col-md col-6">
          <div className="card border-0 shadow-sm bg-warning text-dark h-100">
            <div className="card-body py-3">
              <div className="x-small text-uppercase mb-1 opacity-75">{useRange || retailerName ? 'Total Recovered' : 'Total Recovered'}</div>
              <div className="h5 mb-0 fw-bold">₹{parseFloat(summary.total_recovered || 0).toLocaleString()}</div>
            </div>
          </div>
        </div>
        <div className="col-md col-12">
          <div className="card border-0 shadow-sm bg-danger text-white h-100">
            <div className="card-body py-3">
              <div className="x-small text-uppercase mb-1 opacity-75">Grand Pending Total</div>
              <div className="h5 mb-0 fw-bold">₹{parseFloat(summary.grand_total_pending).toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Data Row Rendering */}
      {(() => {
          return (
            <div className="card shadow-sm border-0">
                <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                    <thead className="table-light text-uppercase">
                    <tr>
                        <th className="ps-4 cursor-pointer" onClick={() => handleSort('name')}>
                          Retailer {sortBy === 'name' && (order === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="cursor-pointer" onClick={() => handleSort('pending')}>
                          Amount Information {sortBy === 'pending' && (order === 'asc' ? '↑' : '↓')}
                        </th>
                        <th>Refill Dates</th>
                        <th>Reason</th>
                        <th>Follow-up Date</th>
                        <th>Status</th>
                        <th className="text-end pe-4">Actions</th>
                    </tr>
                    </thead>
                    <tbody>
                    {loading ? (
                        <tr><td colSpan="7" className="text-center py-5"><div className="spinner-border text-primary"/></td></tr>
                    ) : drops.length === 0 ? (
                        <tr><td colSpan="7" className="text-center py-5 text-muted text-uppercase small">No records found for this period</td></tr>
                    ) : drops.map(g => (
                        <tr key={g.retailer_id} className="align-middle border-bottom">
                        <td className="ps-4 py-3">
                            <h6 className="mb-0 text-uppercase fw-bold" style={{fontSize:'0.85rem'}}>{g.retailer_name}</h6>
                            <div className="x-small text-muted">{g.msisdn}</div>
                        </td>
                        <td>
                            <div className="fw-bold">
                                ₹{(g.filtered_drops || 0).toLocaleString()} 
                                {g.opening_balance > 0 && <span className="text-muted small"> + ₹{g.opening_balance.toLocaleString()}</span>}
                            </div>
                            <div className="x-small text-muted mt-1 opacity-75 fw-bold text-uppercase">
                                <span className="text-success">₹{(g.paid_sum || 0).toLocaleString()} Paid</span> / <span className="text-danger">₹{(g.grand_pending || 0).toLocaleString()} Pending</span>
                            </div>
                        </td>
                        <td className="small fw-bold text-muted">
                            {g.dates || <span className="text-primary x-small">OPENING BALANCE</span>}
                        </td>
                        <td className="small">
                            {g.latest_reason && <div className="badge bg-danger-subtle text-danger text-uppercase x-small mb-1 d-block">{g.latest_reason}</div>}
                            {g.recovery_breakdown && <div className="badge bg-success-subtle text-success text-uppercase x-small d-block border-success-subtle">{g.recovery_breakdown}</div>}
                            {!g.latest_reason && !g.recovery_breakdown && '-'}
                        </td>
                        <td className="small fw-bold">
                            {g.latest_follow_up ? new Date(g.latest_follow_up).toLocaleDateString('en-GB').replace(/\//g, ' ') : '-'}
                        </td>
                        <td>
                            <span className={`badge rounded-pill text-uppercase x-small ${
                                !g.has_pending ? 'bg-success' : 
                                (g.latest_follow_up ? 'bg-info' : 'bg-warning text-dark')
                            }`}>
                                {!g.has_pending ? 'Full Recovered' : (g.latest_follow_up ? 'Follow Up' : 'Pending')}
                            </span>
                        </td>
                        <td className="text-end pe-4">
                            <div className="d-flex gap-2 justify-content-end">
                                <button 
                                    className="btn btn-outline-primary btn-sm text-uppercase fw-bold px-3"
                                    onClick={() => navigate(`/airtel/retailers/${g.retailer_id}`)}
                                >
                                    Profile/History
                                </button>
                                {can('manage_airtel_recovery') && hasFullAccess() && !g.paid_sum && (
                                    <button className="btn btn-link btn-sm text-danger text-decoration-none text-uppercase fw-bold px-1" onClick={() => handleDelete(g.id)}>Delete</button>
                                )}
                            </div>
                        </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
                </div>
            </div>
          );
      })()}

      <Modal show={showImport} onClose={() => setShowImport(false)} title="IMPORT AIRTEL DROPS">
        <form onSubmit={handleImport}>
          <div className="mb-3">
            <label className="form-label text-uppercase small fw-bold">Paste Data (MSISDN AMOUNT)</label>
            <textarea 
              className="form-control font-monospace" 
              rows="10" 
              placeholder="9109566944 500&#10;9752970291 1000..." 
              value={importText} 
              onChange={e => setImportText(e.target.value)}
            />
            <div className="form-text text-uppercase x-small mt-2">
              Supports Space or Underscore separation (9109566944 500 or 9109566944_500)
            </div>
          </div>
          <div className="d-grid mt-4">
            <button type="submit" className="btn btn-primary text-uppercase fw-bold py-2">
              Process Import
            </button>
          </div>

          {failedMsisdns.length > 0 && (
            <div className="mt-4 p-3 bg-danger-subtle rounded border border-danger">
              <h6 className="text-danger fw-bold text-uppercase small mb-2">Failed: Retailers Not Found ({failedMsisdns.length})</h6>
              <div className="d-flex flex-wrap gap-2">
                {failedMsisdns.map((m, i) => (
                  <span key={i} className="badge bg-danger text-white font-monospace">{m}</span>
                ))}
              </div>
              <div className="x-small text-danger mt-2 text-uppercase">PLEASE ADD THESE MSISDNS IN THE RETAILERS TAB FIRST.</div>
              <button 
                type="button" 
                className="btn btn-sm btn-link text-danger text-uppercase fw-bold mt-2 p-0"
                onClick={() => { setFailedMsisdns([]); setShowImport(false); }}
              >
                Close & Done
              </button>
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}
