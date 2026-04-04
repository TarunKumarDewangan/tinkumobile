import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from '../../api/axios';
import { toast } from 'react-toastify';
import Modal from '../../components/Modal';

export default function RetailerProfile() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    // Recovery / Follow-up States
    const [showRecovery, setShowRecovery] = useState(false);
    const [showFollowUp, setShowFollowUp] = useState(false);
    const [selectedDrop, setSelectedDrop] = useState(null);
    const [recoveryAmount, setRecoveryAmount] = useState('');
    const [followUpReason, setFollowUpReason] = useState('');
    const [followUpDate, setFollowUpDate] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchProfile();
    }, [id]);

    const fetchProfile = async () => {
        setLoading(true);
        try {
            const { data } = await axios.get(`/airtel-retailers/${id}`);
            setData(data);
        } catch (err) {
            toast.error('Failed to load profile');
            navigate('/airtel/retailers');
        } finally {
            setLoading(false);
        }
    };

    const handleRecordRecovery = async (e) => {
        e.preventDefault();
        if (!recoveryAmount) return;
        setSubmitting(true);
        try {
            await axios.post(`/airtel-retailers/${id}/record-recovery`, {
                amount: parseFloat(recoveryAmount),
                notes: followUpReason // reuse this for notes if needed, or add new state
            });
            toast.success('Recovery recorded');
            setShowRecovery(false);
            setRecoveryAmount('');
            fetchProfile();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Recovery failed');
        } finally {
            setSubmitting(false);
        }
    };

    const handleRecordFollowUp = async (e) => {
        e.preventDefault();
        if (!selectedDrop || !followUpReason || !followUpDate) return;
        setSubmitting(true);
        try {
            await axios.post('/airtel-drops/update-follow-up', {
                drop_ids: [selectedDrop.id],
                reason: followUpReason,
                next_recovery_date: followUpDate
            });
            toast.success('Follow-up recorded');
            setShowFollowUp(false);
            fetchProfile();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Follow-up failed');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteRecovery = async (recoveryId) => {
        if (!window.confirm('DELETE THIS PAYMENT RECORD? This will increase the pending balance.')) return;
        try {
            await axios.delete(`/airtel-recoveries/${recoveryId}`);
            toast.success('Recovery deleted');
            fetchRetailer();
        } catch (err) {
            toast.error('Failed to delete recovery');
        }
    };

    if (loading) return <div className="text-center py-5"><div className="spinner-border text-primary"/></div>;
    if (!data) return <div className="text-center py-5 text-muted">Retailer not found</div>;

    const { retailer, stats } = data;

    return (
        <div className="container-fluid py-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <button className="btn btn-link p-0 text-decoration-none text-muted mb-1 small" onClick={() => navigate('/airtel/retailers')}>
                        &larr; Back to Retailers
                    </button>
                    <div className="d-flex align-items-center gap-2">
                        <h2 className="h3 mb-0 text-uppercase fw-bold text-primary">{retailer.name}</h2>
                        <span className={`badge text-uppercase small ${
                            retailer.status === 'FULL RECOVERED' ? 'bg-success' : 
                            retailer.status === 'FOLLOW UP' ? 'bg-info' : 'bg-warning text-dark'
                        }`}>
                            {retailer.status}
                        </span>
                    </div>
                    <div className="text-muted fw-bold small text-uppercase">MSISDN: {retailer.msisdn}</div>
                </div>
                <div className="text-end">
                    <div className="x-small text-uppercase text-muted fw-bold">Current Pending</div>
                    <div className="h3 mb-0 fw-bold text-danger">₹{(parseFloat(stats.total_pending) || 0).toLocaleString()}</div>
                    <button 
                        className="btn btn-success btn-sm text-uppercase fw-bold mt-2 px-3 shadow-sm"
                        onClick={() => {
                            setRecoveryAmount(stats.total_pending > 0 ? stats.total_pending : '');
                            setShowRecovery(true);
                        }}
                    >
                        + Record Recovery
                    </button>
                </div>
            </div>

            <div className="row g-3 mb-4">
                <div className="col-md-4">
                    <div className="card border-0 shadow-sm bg-white h-100">
                        <div className="card-body">
                            <div className="x-small text-uppercase text-muted mb-1 fw-bold">Total Dropped</div>
                            <div className="h4 mb-0 fw-bold">₹{(parseFloat(stats.total_dropped) || 0).toLocaleString()}</div>
                        </div>
                    </div>
                </div>
                <div className="col-md-4">
                    <div className="card border-0 shadow-sm bg-success text-white h-100">
                        <div className="card-body">
                            <div className="x-small text-uppercase opacity-75 mb-1 fw-bold">Total Recovered</div>
                            <div className="h4 mb-0 fw-bold">₹{(parseFloat(stats.total_recovered) || 0).toLocaleString()}</div>
                        </div>
                    </div>
                </div>
                <div className="col-md-4">
                    <div className="card border-0 shadow-sm bg-danger text-white h-100">
                        <div className="card-body">
                            <div className="x-small text-uppercase opacity-75 mb-1 fw-bold">Remaining Debt</div>
                            <div className="h4 mb-0 fw-bold">₹{(parseFloat(stats.total_pending) || 0).toLocaleString()}</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="card border-0 shadow-sm mb-4">
                <div className="card-header bg-white py-3 border-bottom-0">
                    <h5 className="mb-0 text-uppercase fw-bold small">Retailer Information</h5>
                </div>
                <div className="card-body pt-0">
                    <div className="row">
                        <div className="col-md-6">
                            <table className="table table-sm table-borderless mb-0">
                                <tbody>
                                    <tr>
                                        <td className="text-muted x-small text-uppercase fw-bold" style={{width:'150px'}}>Address</td>
                                        <td className="small text-uppercase">{retailer.address || 'Not Provided'}</td>
                                    </tr>
                                    <tr>
                                        <td className="text-muted x-small text-uppercase fw-bold">Shop ID</td>
                                        <td className="small">{retailer.shop_id}</td>
                                    </tr>
                                    <tr>
                                        <td className="text-muted x-small text-uppercase fw-bold text-danger">Opening Balance (Old)</td>
                                        <td className="small fw-bold text-danger">₹{(parseFloat(retailer.balance) || 0).toLocaleString()}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <div className="card border-0 shadow-sm">
                <div className="card-header bg-white py-3 border-bottom d-flex justify-content-between align-items-center">
                    <h5 className="mb-0 text-uppercase fw-bold small">Transaction & Follow-up History</h5>
                </div>
                <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                        <thead className="table-light">
                            <tr className="x-small text-uppercase text-muted">
                                <th className="ps-4">Air Drop Date</th>
                                <th>Type</th>
                                <th>Amount</th>
                                <th>Reason / Notes</th>
                                <th>Follow-up</th>
                                <th>Status</th>
                                <th>Recovery Date</th>
                                <th className="text-end pe-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {parseFloat(retailer.balance) > 0 && (
                                <tr className="border-bottom bg-danger-light">
                                    <td className="ps-4 py-3">
                                        <div className="fw-bold small text-danger text-uppercase">Opening</div>
                                    </td>
                                    <td className="small text-uppercase fw-bold text-danger">Brought Forward</td>
                                    <td className="fw-bold text-danger">₹{parseFloat(retailer.balance).toLocaleString()}</td>
                                    <td className="small text-muted italic">Initial Debt Balance</td>
                                    <td className="small">-</td>
                                    <td><span className="badge bg-danger x-small">PENDING</span></td>
                                    <td className="small">-</td>
                                    <td className="text-end pe-4">-</td>
                                </tr>
                            )}
                            {[
                                ...(retailer.drops || []).map(d => ({ ...d, entryType: 'DROP' })),
                                ...(retailer.recoveries || []).map(r => ({ ...r, entryType: 'RECOVERY' }))
                            ].sort((a, b) => {
                                const dateA = new Date(a.entryType === 'DROP' ? a.refill_date : a.recovered_at);
                                const dateB = new Date(b.entryType === 'DROP' ? b.refill_date : b.recovered_at);
                                if (dateB - dateA !== 0) return dateB - dateA;
                                return new Date(b.created_at) - new Date(a.created_at);
                            }).map((item, idx) => (
                                <tr key={`${item.entryType}-${item.id}`} className={`border-bottom ${item.entryType === 'RECOVERY' ? 'bg-success-light' : ''}`}>
                                    <td className="ps-4 py-3">
                                        {item.entryType === 'DROP' ? (
                                            <>
                                                <div className="fw-bold small">
                                                    {new Date(item.refill_date).toLocaleDateString('en-GB').replace(/\//g, ' ')}
                                                </div>
                                                <div className="x-small text-muted">{new Date(item.created_at).toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'})}</div>
                                            </>
                                        ) : (
                                            <span className="text-muted small">-</span>
                                        )}
                                    </td>
                                    <td>
                                        <span className={`badge x-small ${item.entryType === 'RECOVERY' ? 'bg-success' : 'bg-primary'}`}>
                                            {item.entryType}
                                        </span>
                                    </td>
                                    <td className={`fw-bold ${item.entryType === 'RECOVERY' ? 'text-success' : 'text-primary'}`}>
                                        {item.entryType === 'RECOVERY' ? '-' : '+'}₹{parseFloat(item.amount).toLocaleString()}
                                    </td>
                                    <td className="small">
                                        {item.reason || item.notes ? <span className="badge bg-light text-dark text-uppercase x-small border">{item.reason || item.notes}</span> : '-'}
                                    </td>
                                    <td className="small fw-bold">
                                        {item.next_recovery_date ? new Date(item.next_recovery_date).toLocaleDateString('en-GB').replace(/\//g, ' ') : '-'}
                                    </td>
                                    <td>
                                        <span className={`badge rounded-pill text-uppercase x-small ${item.status === 'recovered' || item.entryType === 'RECOVERY' ? 'bg-success-subtle text-success' : 'bg-warning-subtle text-warning'}`}>
                                            {item.entryType === 'RECOVERY' ? 'PAID' : item.status}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="small font-monospace fw-bold">
                                            {item.entryType === 'RECOVERY' || item.status === 'recovered' ? (
                                                <>
                                                    <div className="text-success">{new Date(item.entryType === 'RECOVERY' ? item.recovered_at : item.recovered_at).toLocaleDateString('en-GB').replace(/\//g, ' ')}</div>
                                                    <div className="x-small text-muted">{item.recovery_user?.name || 'Staff'}</div>
                                                </>
                                            ) : '-'}
                                        </div>
                                    </td>
                                    <td className="text-end pe-4">
                                        {item.entryType === 'DROP' && item.status === 'pending' && (
                                            <button 
                                                className="btn btn-warning btn-sm text-uppercase fw-bold p-1 px-2 me-1" 
                                                style={{fontSize:'0.65rem'}}
                                                onClick={() => {
                                                    setSelectedDrop(item);
                                                    setFollowUpReason(item.reason || '');
                                                    setFollowUpDate(item.next_recovery_date || '');
                                                    setShowFollowUp(true);
                                                }}
                                            >
                                                Not Paid
                                            </button>
                                        )}
                                        {item.entryType === 'RECOVERY' && (
                                             <button 
                                                className="btn btn-link text-danger p-0 text-decoration-none x-small fw-bold text-uppercase"
                                                onClick={() => handleDeleteRecovery(item.id)}
                                            >
                                                Delete
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal show={showRecovery} onClose={() => setShowRecovery(false)} title="RECORD RECOVERY">
                <form onSubmit={handleRecordRecovery}>
                    <div className="mb-3">
                        <label className="form-label x-small text-uppercase fw-bold">Retailer</label>
                        <div className="fw-bold text-uppercase">{retailer.name}</div>
                    </div>
                    <div className="mb-3">
                        <label className="form-label x-small text-uppercase fw-bold">Amount Recieved</label>
                        <div className="input-group">
                            <span className="input-group-text">₹</span>
                            <input 
                                type="number" 
                                className="form-control" 
                                step="0.01"
                                value={recoveryAmount}
                                onChange={e => setRecoveryAmount(e.target.value)}
                                required
                            />
                            <button type="button" className="btn btn-outline-secondary" onClick={() => setRecoveryAmount(stats.total_pending)}>FULL PAY</button>
                        </div>
                        <div className="form-text x-small">Current Pending: ₹{stats.total_pending.toLocaleString()}</div>
                    </div>
                    <button type="submit" className="btn btn-success w-100 text-uppercase fw-bold py-2" disabled={submitting}>
                        {submitting ? 'Saving...' : 'Record Payment'}
                    </button>
                </form>
            </Modal>

            <Modal show={showFollowUp} onClose={() => setShowFollowUp(false)} title="NOT PAID / FOLLOW-UP">
                <form onSubmit={handleRecordFollowUp}>
                    <div className="mb-3">
                        <label className="form-label x-small text-uppercase fw-bold">Reason for Non-payment</label>
                        <input 
                            type="text" 
                            className="form-control text-uppercase" 
                            placeholder="e.g. SHOP CLOSED, NO CASH, OWNER AWAY" 
                            required 
                            value={followUpReason}
                            onChange={e => setFollowUpReason(e.target.value)}
                        />
                    </div>
                    <div className="mb-3">
                        <label className="form-label x-small text-uppercase fw-bold">Next Recovery Date</label>
                        <input 
                            type="date" 
                            className="form-control" 
                            required 
                            min={new Date().toISOString().split('T')[0]}
                            value={followUpDate}
                            onChange={e => setFollowUpDate(e.target.value)}
                        />
                    </div>
                    <button type="submit" className="btn btn-primary w-100 text-uppercase fw-bold py-2" disabled={submitting}>
                        {submitting ? 'Saving...' : 'Save Follow-up'}
                    </button>
                </form>
            </Modal>
        </div>
    );
}
