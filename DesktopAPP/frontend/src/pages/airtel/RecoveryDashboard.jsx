import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../../api/axios';
import { toast } from 'react-toastify';
import Modal from '../../components/Modal';
// import { format } from 'date-fns'; // REMOVED dependency

export default function RecoveryDashboard() {
  const navigate = useNavigate();
  const [pendingDrops, setPendingDrops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState([]);
  const [customAmounts, setCustomAmounts] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [followUpForm, setFollowUpForm] = useState({ reason: '', next_date: '' });
  const [summary, setSummary] = useState({ total_dropped: 0, total_recovered: 0, pending_recovery: 0, grand_total_pending: 0 });

  // Filters
  const [retailerName, setRetailerName] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [status, setStatus] = useState('pending_only');
  const [followUpOnly, setFollowUpOnly] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [debouncedRetailerName, setDebouncedRetailerName] = useState(retailerName);
  const [useRange, setUseRange] = useState(false);

  // Debounce retailer search
  useEffect(() => {
    const handler = setTimeout(() => {
        setDebouncedRetailerName(retailerName);
    }, 500);
    return () => clearTimeout(handler);
  }, [retailerName]);

  useEffect(() => {
    fetchPending();
    fetchSummary();
  }, [debouncedRetailerName, minAmount, maxAmount, fromDate, toDate, useRange, followUpOnly, status]);

  const fetchPending = async () => {
    setLoading(true);
    try {
      let params = `?retailer_name=${debouncedRetailerName}&min_amount=${minAmount}&max_amount=${maxAmount}`;
      if (status !== 'all') params += `&status=${status}`;
      if (followUpOnly) params += `&follow_up=1`;
      if (useRange) {
        params += `&from_date=${fromDate}&to_date=${toDate}`;
      } else if (fromDate) {
        params += `&date=${fromDate}`;
      }
      const { data } = await axios.get(`/airtel-drops${params}`);
      setPendingDrops(data.data);
    } catch (error) {
      toast.error('Failed to fetch pending drops');
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      let params = `?retailer_name=${debouncedRetailerName}&min_amount=${minAmount}&max_amount=${maxAmount}`;
      if (status !== 'all') params += `&status=${status}`;
      if (followUpOnly) params += `&follow_up=1`;
      if (useRange) {
        params += `&from_date=${fromDate}&to_date=${toDate}`;
      } else if (fromDate) {
        params += `&date=${fromDate}`;
      }
      const { data } = await axios.get(`/airtel-drops/summary${params}`);
      setSummary(data);
    } catch (error) {
        console.error('Summary fetch failed');
    }
  };

  const toggleSelect = (id, amount) => {
    setSelected(prev => {
        if (prev.includes(id)) {
            const newSelected = prev.filter(x => x !== id);
            const newAmounts = {...customAmounts};
            delete newAmounts[id];
            setCustomAmounts(newAmounts);
            return newSelected;
        } else {
            setCustomAmounts({...customAmounts, [id]: amount});
            return [...prev, id];
        }
    });
  };

  const handleRecover = async () => {
    if (selected.length === 0) return;
    if (!window.confirm(`MARK ${selected.length} PAYMENTS AS RECOVERED?`)) return;

    setSubmitting(true);
    try {
      const recoveries = selected.map(id => ({ 
          id, 
          amount: parseFloat(customAmounts[id]) 
      }));
      await axios.post('/airtel-drops/mark-recovered', { recoveries });
      toast.success('Successfully recorded recovery');
      setSelected([]);
      setCustomAmounts({});
      fetchPending();
    } catch (error) {
      toast.error('Recovery failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFollowUp = async (e) => {
    e.preventDefault();
    if (selected.length === 0) return;
    setSubmitting(true);
    try {
        await axios.post('/airtel-drops/update-follow-up', {
            drop_ids: selected,
            reason: followUpForm.reason,
            next_recovery_date: followUpForm.next_date
        });
        toast.success('Follow-up recorded');
        setShowFollowUp(false);
        setFollowUpForm({ reason: '', next_date: '' });
        setSelected([]);
        setCustomAmounts({});
        fetchPending();
    } catch (error) {
        toast.error('Failed to record follow-up');
    } finally {
        setSubmitting(false);
    }
  };

  const totalSelected = selected.reduce((sum, id) => sum + (parseFloat(customAmounts[id]) || 0), 0);

  return (
    <div className="container py-3">
      <div className="d-flex justify-content-between align-items-center mb-4 sticky-top bg-light py-2 px-1 rounded shadow-sm">
        <h2 className="h5 mb-0 text-uppercase fw-bold">Recovery Task</h2>
        <div className="d-flex gap-2">
            {selected.length > 0 && (
            <>
                <button 
                    className="btn btn-warning btn-sm text-uppercase fw-bold shadow-sm" 
                    onClick={() => setShowFollowUp(true)}
                    disabled={submitting}
                >
                    Not Paid
                </button>
                <button 
                    className="btn btn-success btn-sm text-uppercase fw-bold shadow-sm" 
                    onClick={handleRecover}
                    disabled={submitting}
                >
                    Recover (₹{totalSelected.toLocaleString()})
                </button>
            </>
            )}
            <button className="btn btn-outline-secondary btn-sm" onClick={() => {
                setRetailerName(''); setMinAmount(''); setMaxAmount(''); setFromDate(''); setToDate(''); setUseRange(false); setFollowUpOnly(false); setStatus('all');
            }}>RESET</button>
        </div>
      </div>

      <div className="card shadow-sm border-0 mb-3 bg-danger text-white">
          <div className="card-body py-2 d-flex justify-content-between align-items-center">
              <span className="x-small text-uppercase fw-bold opacity-75">Global Pending</span>
              <span className="h5 mb-0 fw-bold">₹{parseFloat(summary.grand_total_pending).toLocaleString()}</span>
          </div>
      </div>

      <div className="card border-0 shadow-sm mb-4 bg-white">
          <div className="card-body p-2">
              <div className="row g-2 align-items-end">
                  <div className="col-12 col-md-4">
                      <label className="x-small text-uppercase fw-bold mb-1 d-block opacity-75">Retailer / MSISDN</label>
                      <input type="text" className="form-control form-control-sm" value={retailerName} onChange={e => setRetailerName(e.target.value)} placeholder="Search..." />
                  </div>
                  <div className="col-6 col-md-2">
                      <label className="x-small text-uppercase fw-bold mb-1 d-block opacity-75">Min ₹</label>
                      <input type="number" className="form-control form-control-sm" value={minAmount} onChange={e => setMinAmount(e.target.value)} />
                  </div>
                  <div className="col-6 col-md-2">
                      <label className="x-small text-uppercase fw-bold mb-1 d-block opacity-75">Max ₹</label>
                      <input type="number" className="form-control form-control-sm" value={maxAmount} onChange={e => setMaxAmount(e.target.value)} />
                  </div>
                  <div className="col-12 col-md-4">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                          <label className="x-small text-uppercase fw-bold d-block opacity-75">Refill date</label>
                          <div className="form-check form-switch p-0" style={{minHeight:0}}>
                                <input className="form-check-input ms-0 me-1" type="checkbox" checked={useRange} onChange={e => setUseRange(e.target.checked)} />
                                <label className="x-small text-uppercase fw-bold opacity-75">Range</label>
                          </div>
                      </div>
                      {useRange ? (
                          <div className="d-flex gap-1 align-items-center">
                              <input type="date" className="form-control form-control-sm" value={fromDate} onChange={e => setFromDate(e.target.value)} />
                              <span className="x-small">-</span>
                              <input type="date" className="form-control form-control-sm" value={toDate} onChange={e => setToDate(e.target.value)} />
                          </div>
                      ) : (
                          <div className="text-center x-small text-muted border rounded py-1 bg-light">Historical Pending</div>
                      )}
                  </div>
                  <div className="col-6">
                      <div className="form-check form-switch mt-2">
                          <input className="form-check-input" type="checkbox" id="followUpSwitch" checked={followUpOnly} onChange={e => setFollowUpOnly(e.target.checked)} />
                          <label className="form-check-label x-small text-uppercase fw-bold" htmlFor="followUpSwitch">Follow-up Only</label>
                      </div>
                  </div>
                  <div className="col-12 mt-2">
                        <div className="btn-group w-100 shadow-sm">
                           <button className={`btn btn-sm text-uppercase fw-bold ${status === 'all' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setStatus('all')}>All</button>
                           <button className={`btn btn-sm text-uppercase fw-bold ${status === 'pending_only' ? 'btn-warning' : 'btn-outline-warning'}`} onClick={() => setStatus('pending_only')}>Pending</button>
                           <button className={`btn btn-sm text-uppercase fw-bold ${status === 'partial_only' ? 'btn-info' : 'btn-outline-info'}`} onClick={() => setStatus('partial_only')}>Partial</button>
                           <button className={`btn btn-sm text-uppercase fw-bold ${status === 'recovered_only' ? 'btn-success' : 'btn-outline-success'}`} onClick={() => setStatus('recovered_only')}>Recovered</button>
                       </div>
                  </div>
              </div>
          </div>
      </div>

      {loading ? (
        <div className="text-center py-5"><div className="spinner-border text-primary"/></div>
      ) : pendingDrops.length === 0 ? (
        <div className="card border-0 shadow-sm text-center py-5">
          <div className="card-body">
            <h1 className="display-4 opacity-25">✅</h1>
            <p className="text-uppercase text-muted fw-bold">All payments recovered!<br/>Enjoy your day.</p>
          </div>
        </div>
      ) : (
        <div className="row g-3">
          {pendingDrops.map(d => (
            <div className="col-12 col-md-6" key={d.id}>
              <div 
                className={`card border-0 shadow-sm transition-all ${selected.includes(d.id) ? 'border-start border-4 border-success' : ''}`}
                style={{ cursor: 'pointer', opacity: submitting ? 0.6 : 1 }}
                onClick={(e) => {
                    if (e.target.tagName !== 'INPUT' && !submitting) {
                        toggleSelect(d.id, d.amount);
                    }
                }}
              >
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                        <h6 className="mb-1 text-uppercase fw-bold">{d.retailer?.name}</h6>
                        <div className="small text-muted">{d.retailer?.msisdn}</div>
                        <div className="x-small text-muted mt-1">Refill: {new Date(d.refill_date).toLocaleDateString('en-GB').replace(/\//g, ' ')}</div>
                        {d.next_recovery_date && (
                            <div className="x-small text-danger fw-bold mt-1">
                                🗓️ NEXT: {new Date(d.next_recovery_date).toLocaleDateString('en-GB').replace(/\//g, ' ')}
                            </div>
                        )}
                        {d.reason && (
                            <div className="x-small text-muted italic mt-1 bg-light p-1 rounded border-start border-2 border-warning">
                                "{d.reason}"
                            </div>
                        )}
                    </div>
                    <div className="text-end">
                        <div className={`h5 mb-0 fw-bold d-flex align-items-center gap-2 ${d.status === 'recovered' ? 'text-success' : 'text-primary'}`}>
                            ₹{parseFloat(d.amount).toLocaleString()}
                            {parseFloat(d.retailer_paid_today) > 0 ? (
                                parseFloat(d.retailer_pending_today) > 0 ? (
                                    <span className="badge rounded-pill bg-info-subtle text-info x-small text-uppercase">Partial</span>
                                ) : (
                                    <span className="badge rounded-pill bg-success-subtle text-success x-small text-uppercase">Fully Paid</span>
                                )
                            ) : (
                                <span className="badge rounded-pill bg-warning-subtle text-warning x-small text-uppercase">Pending</span>
                            )}
                        </div>
                        <div className="x-small text-muted mt-1 text-uppercase fw-bold">
                            Today: <span className="text-success">₹{(parseFloat(d.retailer_paid_today) || 0).toLocaleString()} Paid</span> 
                            {' '}<span className="text-secondary opacity-50">/</span>{' '}
                            <span className="text-primary">₹{(parseFloat(d.retailer_total_today) || 0).toLocaleString()} Total</span>
                        </div>
                        <div className="x-small text-muted mt-1 text-uppercase fw-bold">
                            Remaining: <span className="text-danger">₹{parseFloat(d.retailer_pending_total).toLocaleString()}</span>
                        </div>
                        {d.status === 'pending' && (
                            <div className="form-check d-inline-block p-0 mt-1">
                                <input 
                                    type="checkbox" 
                                    className="form-check-input ms-0" 
                                    checked={selected.includes(d.id)}
                                    onChange={() => !submitting && toggleSelect(d.id, d.amount)}
                                />
                            </div>
                        )}
                    </div>
                  </div>
                  
                  {selected.includes(d.id) && (
                      <div className="mt-3 pt-3 border-top">
                          <label className="x-small text-uppercase fw-bold opacity-75 d-block mb-1">Enter Recovery Amount</label>
                          <div className="input-group input-group-sm">
                              <span className="input-group-text bg-light border-0">₹</span>
                              <input 
                                type="number" 
                                className="form-control border-0 bg-light" 
                                value={customAmounts[d.id] || ''}
                                onChange={(e) => setCustomAmounts({...customAmounts, [d.id]: e.target.value})}
                                step="0.01"
                                min="0.01"
                                max={d.amount}
                              />
                              <button className="btn btn-outline-secondary border-0" onClick={() => setCustomAmounts({...customAmounts, [d.id]: d.amount})}>FULL</button>
                          </div>
                      </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected.length > 0 && (
        <div 
            className="fixed-bottom p-3 d-md-none bg-white border-top shadow-lg d-flex gap-2"
            style={{ bottom: '56px', zIndex: 1060 }}
        >
          <button 
            className="btn btn-warning w-50 text-uppercase fw-bold py-3 shadow" 
            onClick={() => setShowFollowUp(true)}
            disabled={submitting}
          >
            Not Paid
          </button>
          <button 
            className="btn btn-success w-50 text-uppercase fw-bold py-3 shadow" 
            onClick={handleRecover}
            disabled={submitting}
          >
            Recover (₹{totalSelected.toLocaleString()})
          </button>
        </div>
      )}

      <Modal show={showFollowUp} onClose={() => setShowFollowUp(false)} title="NOT PAID / FOLLOW-UP">
          <form onSubmit={handleFollowUp}>
              <div className="mb-3">
                  <label className="form-label x-small text-uppercase fw-bold">Reason for Non-payment</label>
                  <input 
                    type="text" 
                    className="form-control text-uppercase" 
                    placeholder="e.g. SHOP CLOSED, NO CASH, OWNER AWAY" 
                    required 
                    value={followUpForm.reason}
                    onChange={e => setFollowUpForm({...followUpForm, reason: e.target.value})}
                  />
              </div>
              <div className="mb-3">
                  <label className="form-label x-small text-uppercase fw-bold">Next Recovery Date</label>
                  <input 
                    type="date" 
                    className="form-control" 
                    required 
                    min={new Date().toISOString().split('T')[0]}
                    value={followUpForm.next_date}
                    onChange={e => setFollowUpForm({...followUpForm, next_date: e.target.value})}
                  />
              </div>
              <button type="submit" className="btn btn-primary w-100 text-uppercase fw-bold py-2" disabled={submitting}>
                  Save Follow-up
              </button>
          </form>
      </Modal>
      
      <div style={{ height: '80px' }} className="d-md-none" />
    </div>
  );
}
