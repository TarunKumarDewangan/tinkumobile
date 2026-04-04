import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from '../../api/axios';
import { toast } from 'react-toastify';
import RetailerReceipt from './RetailerReceipt';

const PublicRetailerProfile = () => {
    const { msisdn } = useParams();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedRecovery, setSelectedRecovery] = useState(null);

    useEffect(() => {
        fetchProfile();
    }, [msisdn]);

    const fetchProfile = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`/public/retailer/${msisdn}`);
            setData(res.data);
        } catch (error) {
            toast.error('Retailer not found');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="text-center py-5"><div className="spinner-border text-primary"></div></div>;
    if (!data) return <div className="text-center py-5"><h4>Retailer not found</h4></div>;

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
                         <div className="col-md-4">
                             <div className="card border-0 shadow-sm p-3 text-center rounded-3 bg-white h-100">
                                 <div className="x-small text-uppercase text-muted fw-bold">Total Drops</div>
                                 <div className="h4 fw-bold mb-0">₹{parseFloat(stats.total_dropped + stats.opening_balance).toLocaleString()}</div>
                             </div>
                         </div>
                         <div className="col-md-4">
                             <div className="card border-0 shadow-sm p-3 text-center rounded-3 bg-white h-100">
                                 <div className="x-small text-uppercase text-muted fw-bold">Total Paid</div>
                                 <div className="h4 fw-bold mb-0 text-success">₹{parseFloat(stats.total_recovered).toLocaleString()}</div>
                             </div>
                         </div>
                         <div className="col-md-4">
                             <div className="card border-0 shadow-sm p-3 text-center rounded-3 bg-white h-100">
                                 <div className="x-small text-uppercase text-muted fw-bold">Current Pending</div>
                                 <div className="h4 fw-bold mb-0 text-danger">₹{parseFloat(stats.total_pending).toLocaleString()}</div>
                             </div>
                         </div>
                    </div>

                    <ul className="nav nav-pills mb-3 gap-2" id="pills-tab" role="tablist">
                      <li className="nav-item" role="presentation">
                        <button className="nav-link active rounded-pill px-4 fw-bold" id="pills-recoveries-tab" data-bs-toggle="pill" data-bs-target="#pills-recoveries" type="button" role="tab">Receipts</button>
                      </li>
                      <li className="nav-item" role="presentation">
                        <button className="nav-link rounded-pill px-4 fw-bold" id="pills-drops-tab" data-bs-toggle="pill" data-bs-target="#pills-drops" type="button" role="tab">Drop History</button>
                      </li>
                    </ul>

                    <div className="tab-content" id="pills-tabContent">
                      <div className="tab-pane fade show active" id="pills-recoveries" role="tabpanel">
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
                                                        onClick={() => setSelectedRecovery(r)}
                                                        className="btn btn-outline-primary btn-sm rounded-pill"
                                                        data-bs-toggle="modal"
                                                        data-bs-target="#receiptModal"
                                                      >
                                                          <i className="bi bi-file-earmark-text me-1"></i> Receipt
                                                      </button>
                                                  </td>
                                              </tr>
                                          ))}
                                          {recoveries.length === 0 && <tr><td colSpan="3" className="text-center py-4 text-muted">No payment history found</td></tr>}
                                      </tbody>
                                  </table>
                              </div>
                          </div>
                      </div>
                      <div className="tab-pane fade" id="pills-drops" role="tabpanel">
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
                                            {drops.length === 0 && <tr><td colSpan="3" className="text-center py-4 text-muted">No drop history found</td></tr>}
                                       </tbody>
                                   </table>
                               </div>
                          </div>
                      </div>
                    </div>
                </div>
            </div>

            {/* Receipt Modal */}
            <div className="modal fade" id="receiptModal" tabIndex="-1" aria-hidden="true">
                <div className="modal-dialog modal-dialog-centered">
                    <div className="modal-content border-0 rounded-4 shadow-lg">
                        <div className="modal-header border-0 pb-0">
                            <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div className="modal-body pt-0">
                            {selectedRecovery && <RetailerReceipt recovery={selectedRecovery} retailer={retailer} />}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PublicRetailerProfile;
