import { useState, useEffect } from 'react';
import axios from '../../api/axios';
import { toast } from 'react-toastify';

export default function AirtelReports() {
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchReport();
  }, [fromDate, toDate]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`/airtel-drops/report?from_date=${fromDate}&to_date=${toDate}`);
      setReportData(data);
    } catch (error) {
      toast.error('Failed to fetch report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="h4 mb-0 text-uppercase fw-bold">Airtel Recovery Reports</h2>
        <div className="d-flex gap-2">
            <input type="date" className="form-control form-control-sm" value={fromDate} onChange={e => setFromDate(e.target.value)} />
            <input type="date" className="form-control form-control-sm" value={toDate} onChange={e => setToDate(e.target.value)} />
        </div>
      </div>

      {loading ? (
          <div className="text-center py-5"><div className="spinner-border text-primary"/></div>
      ) : reportData ? (
          <div className="row g-4">
              {/* Daily Performance (Drop-Centric) */}
              <div className="col-12 col-xl-7">
                  <div className="card shadow-sm border-0 border-top border-4 border-primary h-100">
                      <div className="card-header bg-white border-0 py-3">
                          <h6 className="mb-0 text-uppercase fw-bold opacity-75">Daily Performance <small className="text-muted">(By Drop Date)</small></h6>
                      </div>
                      <div className="table-responsive" style={{maxHeight:'600px'}}>
                          <table className="table table-hover align-middle mb-0">
                              <thead className="table-light text-uppercase shadow-sm sticky-top">
                                  <tr className="x-small">
                                      <th className="ps-4">Air Drop Date</th>
                                      <th>Dropped Amt</th>
                                      <th>Recovered from these</th>
                                      <th className="text-end pe-4">Collection %</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  {reportData.daily_report.map(r => {
                                      const percent = r.total_dropped > 0 ? (r.total_recovered / r.total_dropped) * 100 : 0;
                                      return (
                                          <tr key={r.date}>
                                              <td className="ps-4 fw-bold small">{new Date(r.date).toLocaleDateString('en-GB').replace(/\//g, ' ')}</td>
                                              <td className="small text-muted">₹{parseFloat(r.total_dropped).toLocaleString()}</td>
                                              <td className="small text-success fw-bold">₹{parseFloat(r.total_recovered).toLocaleString()}</td>
                                              <td className="text-end pe-4">
                                                  <div className="d-flex align-items-center justify-content-end gap-2">
                                                      <div className="progress flex-grow-1" style={{height:'4px', maxWidth:'60px'}}>
                                                          <div className="progress-bar bg-success" style={{width: `${Math.min(percent, 100)}%`}} />
                                                      </div>
                                                      <span className="x-small fw-bold">{percent.toFixed(0)}%</span>
                                                  </div>
                                              </td>
                                          </tr>
                                      );
                                  })}
                              </tbody>
                          </table>
                      </div>
                  </div>
              </div>

              {/* Retailer-wise Pending (Aging) */}
              <div className="col-12 col-xl-5">
                  <div className="card shadow-sm border-0 border-top border-4 border-danger h-100">
                      <div className="card-header bg-white border-0 py-3">
                          <h6 className="mb-0 text-uppercase fw-bold text-danger opacity-75">Retailer Pending Summary</h6>
                      </div>
                      <div className="table-responsive" style={{maxHeight:'600px'}}>
                          <table className="table table-hover align-middle mb-0">
                              <thead className="table-light text-uppercase shadow-sm sticky-top">
                                   <tr className="x-small">
                                       <th className="ps-3" style={{minWidth:'140px'}}>Retailer</th>
                                       <th className="text-end">OB</th>
                                       <th className="text-end">Drops</th>
                                       <th className="text-end">Rec.</th>
                                       <th className="text-end pe-3">Pending</th>
                                   </tr>
                               </thead>
                               <tbody>
                                   {reportData.retailer_summary.map(r => (
                                       <tr key={r.id}>
                                           <td className="ps-3 py-2">
                                               <div className="fw-bold x-small text-uppercase">{r.name || 'Unknown'}</div>
                                               <div className="x-small text-muted" style={{fontSize:'0.65rem'}}>{r.msisdn}</div>
                                           </td>
                                           <td className="text-end x-small text-muted">₹{parseFloat(r.opening_bal || 0).toLocaleString()}</td>
                                           <td className="text-end x-small text-muted">₹{parseFloat(r.airdrop_total || 0).toLocaleString()}</td>
                                           <td className="text-end x-small text-success fw-bold">₹{parseFloat(r.received_total || 0).toLocaleString()}</td>
                                           <td className="text-end pe-3 x-small">
                                               <span className="fw-bold text-danger">₹{parseFloat(r.pending_total).toLocaleString()}</span>
                                           </td>
                                       </tr>
                                   ))}
                               </tbody>
                          </table>
                      </div>
                  </div>
              </div>

              {/* Collections Received (Cash-Flow) */}
              <div className="col-12">
                  <div className="card shadow-sm border-0 border-top border-4 border-success">
                      <div className="card-header bg-white border-0 py-3 d-flex justify-content-between align-items-center">
                          <h6 className="mb-0 text-uppercase fw-bold text-success opacity-75">Daily Cash Collection <small className="text-muted">(Received on specific date)</small></h6>
                          <div className="badge bg-success-subtle text-success text-uppercase py-2 px-3">
                              Total Received: ₹{reportData.collections_received?.reduce((acc, curr) => acc + parseFloat(curr.amount_collected), 0).toLocaleString()}
                          </div>
                      </div>
                      <div className="row g-0 p-3">
                        {reportData.collections_received?.map(c => (
                            <div key={c.collection_date} className="col-6 col-md-4 col-lg-3 p-2">
                                <div className="bg-light rounded p-3 text-center border-bottom border-3 border-success">
                                    <div className="x-small text-uppercase text-muted fw-bold mb-1">{new Date(c.collection_date).toLocaleDateString('en-GB').replace(/\//g, ' ')}</div>
                                    <div className="h5 mb-0 fw-bold text-success">₹{parseFloat(c.amount_collected).toLocaleString()}</div>
                                </div>
                            </div>
                        ))}
                        {(!reportData.collections_received || reportData.collections_received.length === 0) && (
                            <div className="col-12 py-4 text-center text-muted text-uppercase small">No collections received for this period</div>
                        )}
                      </div>
                  </div>
              </div>
          </div>
      ) : null}
    </div>
  );
}
