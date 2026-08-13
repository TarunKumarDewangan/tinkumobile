import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from '../../api/axios';
import { toast } from 'react-toastify';
import RetailerReceipt from './RetailerReceipt';

const PublicRetailerProfile = () => {
    const { msisdn } = useParams();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('recoveries');
    const [selectedRecovery, setSelectedRecovery] = useState(null);
    const [showReceipt, setShowReceipt] = useState(false);

    // This page shows a retailer's full balance and payment history — it
    // used to be reachable by anyone who just knew the phone number in the
    // URL. Now they have to prove they own that number via a WhatsApp code
    // first.
    const [otpSent, setOtpSent] = useState(false);
    const [otp, setOtp] = useState('');
    const [sendingOtp, setSendingOtp] = useState(false);

    const requestOtp = async () => {
        setSendingOtp(true);
        try {
            await axios.post(`/public/retailer/${msisdn}/request-otp`);
            toast.success('A code has been sent to your WhatsApp number.');
            setOtpSent(true);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not send code');
        } finally {
            setSendingOtp(false);
        }
    };

    const fetchProfile = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await axios.get(`/public/retailer/${msisdn}`, { params: { otp } });
            setData(res.data);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Invalid or expired code');
        } finally {
            setLoading(false);
        }
    };

    if (!data) {
        return (
            <div className="container-fluid py-4 bg-light min-vh-100 d-flex align-items-center justify-content-center">
                <div className="card shadow-lg border-0 rounded-4" style={{ maxWidth: 380, width: '100%' }}>
                    <div className="card-body p-4 text-center">
                        <h4 className="fw-bold mb-1">Verify your number</h4>
                        <p className="text-muted small mb-4">{msisdn}</p>
                        {!otpSent ? (
                            <button className="btn btn-primary w-100 fw-bold" disabled={sendingOtp} onClick={requestOtp}>
                                {sendingOtp ? 'Sending...' : 'Send code on WhatsApp'}
                            </button>
                        ) : (
                            <form onSubmit={fetchProfile}>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength="6"
                                    className="form-control form-control-lg text-center fw-bold mb-3"
                                    placeholder="••••••"
                                    required
                                    value={otp}
                                    onChange={e => setOtp(e.target.value)}
                                />
                                <button type="submit" className="btn btn-primary w-100 fw-bold" disabled={loading}>
                                    {loading ? 'Verifying...' : 'View my balance'}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    const { retailer, stats, drops, recoveries } = data;

    return (
        <div className="container-fluid py-4 bg-light min-vh-100">
            <div className="row justify-content-center">
                <div className="col-12 col-lg-8">
                    {/* Header Card */}
                    <div className="card shadow-sm border-0 mb-4 overflow-hidden rounded-4">
                        <div className="card-body bg-primary text-white p-4">
                            <div className="d-flex justify-content-between align-items-start">
                                <div>
                                    <h2 className="fw-bold mb-1">{retailer.name}</h2>
                                    <div className="opacity-75">{retailer.msisdn}</div>
                                    <div className="x-small opacity-50 mt-1">{retailer.address || 'No address provided'}</div>
                                </div>
                                <div className="text-end">
                                    <div className="x-small text-uppercase opacity-75">Your Pending Balance</div>
                                    <h1 className="fw-bold mb-0">₹{parseFloat(stats.total_pending).toLocaleString()}</h1>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="row g-3 mb-4">
                         <div className="col-md-3 col-6">
                             <div className="card border-0 shadow-sm p-3 text-center rounded-3 bg-white h-100">
                                 <div className="x-small text-uppercase text-muted fw-bold">Opening Bal.</div>
                                 <div className="h5 fw-bold mb-0">₹{parseFloat(stats.opening_balance || 0).toLocaleString()}</div>
                             </div>
                         </div>
                         <div className="col-md-3 col-6">
                             <div className="card border-0 shadow-sm p-3 text-center rounded-3 bg-white h-100">
                                 <div className="x-small text-uppercase text-muted fw-bold">Air Drops</div>
                                 <div className="h5 fw-bold mb-0">₹{parseFloat(stats.total_dropped || 0).toLocaleString()}</div>
                             </div>
                         </div>
                         <div className="col-md-3 col-6">
                             <div className="card border-0 shadow-sm p-3 text-center rounded-3 bg-white h-100">
                                 <div className="x-small text-uppercase text-muted fw-bold">Total Paid</div>
                                 <div className="h5 fw-bold mb-0 text-success">₹{parseFloat(stats.total_recovered).toLocaleString()}</div>
                             </div>
                         </div>
                         <div className="col-md-3 col-6">
                             <div className="card border-0 shadow-sm p-3 text-center rounded-3 bg-white h-100 border-bottom border-4 border-danger">
                                 <div className="x-small text-uppercase text-muted fw-bold">Pending</div>
                                 <div className="h5 fw-bold mb-0 text-danger">₹{parseFloat(stats.total_pending).toLocaleString()}</div>
                             </div>
                         </div>
                    </div>

                    <ul className="nav nav-pills mb-3 gap-2">
                      <li className="nav-item">
                        <button 
                            className={`nav-link rounded-pill px-4 fw-bold ${activeTab === 'recoveries' ? 'active' : ''}`} 
                            onClick={() => setActiveTab('recoveries')}
                        >Receipts</button>
                      </li>
                      <li className="nav-item">
                        <button 
                            className={`nav-link rounded-pill px-4 fw-bold ${activeTab === 'drops' ? 'active' : ''}`} 
                            onClick={() => setActiveTab('drops')}
                        >Drop History</button>
                      </li>
                    </ul>

                    <div className="tab-content">
                      {activeTab === 'recoveries' && (
                          <div className="card shadow-sm border-0 rounded-4 overflow-hidden">
                              <div className="table-responsive">
                                  <table className="table table-hover align-middle mb-0">
                                      <thead className="bg-light x-small text-uppercase fw-bold">
                                          <tr>
                                              <th className="ps-4">Date</th>
                                              <th className="text-end">Amount Paid</th>
                                              <th className="text-end pe-4">Receipt</th>
                                          </tr>
                                      </thead>
                                      <tbody>
                                          {recoveries.map(r => (
                                              <tr key={r.id}>
                                                  <td className="ps-4 small fw-bold">{new Date(r.recovered_at).toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'})}</td>
                                                  <td className="text-end fw-bold text-success">₹{parseFloat(r.amount).toLocaleString()}</td>
                                                  <td className="text-end pe-4">
                                                      <button 
                                                        onClick={() => { setSelectedRecovery(r); setShowReceipt(true); }}
                                                        className="btn btn-outline-primary btn-sm rounded-pill"
                                                      >
                                                          <i className="bi bi-file-earmark-text me-1"></i> Receipt
                                                      </button>
                                                  </td>
                                              </tr>
                                          ))}
                                          {recoveries.length === 0 && <tr><td colSpan="3" className="text-center py-4 text-muted small fw-bold">NO RECEIPTS FOUND</td></tr>}
                                      </tbody>
                                  </table>
                              </div>
                          </div>
                      )}
                      
                      {activeTab === 'drops' && (
                          <div className="card shadow-sm border-0 rounded-4 overflow-hidden">
                               <div className="table-responsive">
                                   <table className="table table-hover align-middle mb-0">
                                       <thead className="bg-light x-small text-uppercase fw-bold">
                                           <tr>
                                               <th className="ps-4">Date</th>
                                               <th className="text-end">Dropped</th>
                                               <th className="text-end pe-4">Status</th>
                                           </tr>
                                       </thead>
                                       <tbody>
                                           {drops.map(d => (
                                               <tr key={d.id}>
                                                   <td className="ps-4 small fw-bold">{new Date(d.refill_date).toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'})}</td>
                                                   <td className="text-end fw-bold">₹{parseFloat(d.amount).toLocaleString()}</td>
                                                   <td className="text-end pe-4">
                                                       <span className={`badge rounded-pill fw-bold x-small ${d.status === 'recovered' ? 'bg-success-subtle text-success' : 'bg-warning-subtle text-warning'}`}>
                                                           {d.status === 'recovered' ? 'PAID' : 'PENDING'}
                                                       </span>
                                                   </td>
                                               </tr>
                                           ))}
                                            {drops.length === 0 && <tr><td colSpan="3" className="text-center py-4 text-muted small fw-bold">NO DROP HISTORY FOUND</td></tr>}
                                       </tbody>
                                   </table>
                               </div>
                          </div>
                      )}
                    </div>
                </div>
            </div>

            {/* Receipt Modal (React Controlled) */}
            {showReceipt && (
                <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 rounded-4 shadow-lg">
                            <div className="modal-header border-0 pb-0">
                                <button type="button" className="btn-close" onClick={() => setShowReceipt(false)}></button>
                            </div>
                            <div className="modal-body pt-0 mb-4">
                                {selectedRecovery && <RetailerReceipt recovery={selectedRecovery} retailer={retailer} />}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PublicRetailerProfile;
