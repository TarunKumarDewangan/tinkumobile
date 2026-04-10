import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from '../../api/axios';
import { toast } from 'react-toastify';
import Modal from '../../components/Modal';
import { useAuth } from '../../contexts/AuthContext';

export default function RetailerProfile() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { hasFullAccess } = useAuth();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    const [showEdit, setShowEdit] = useState(false);
    const [editData, setEditData] = useState({ name: '', msisdn: '', address: '', balance: '', shop_id: 1 });

    // Recovery / Follow-up States
    const [showRecovery, setShowRecovery] = useState(false);
    const [showFollowUp, setShowFollowUp] = useState(false);
    const [selectedDrop, setSelectedDrop] = useState(null);
    const [recoveryAmount, setRecoveryAmount] = useState('');
    const [recoveryNotes, setRecoveryNotes] = useState('');
    const [followUpReason, setFollowUpReason] = useState('');
    const [followUpDate, setFollowUpDate] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [isConfirmingRecovery, setIsConfirmingRecovery] = useState(false);

    const formatSystemDate = (dateStr) => {
        if (!dateStr) return '-';
        const d = dateStr.split(/[T ]/)[0].split('-');
        if (d.length < 3) return dateStr;
        return `${d[2]} ${d[1]} ${d[0]}`;
    };

    const formatSystemTime = (dateStr) => {
        if (!dateStr) return '';
        const parts = dateStr.split(/[T ]/);
        if (parts.length < 2) return '';
        return parts[1].substring(0, 5);
    };

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

        if (!isConfirmingRecovery) {
            setIsConfirmingRecovery(true);
            return;
        }

        setSubmitting(true);
        try {
            await axios.post(`/airtel-retailers/${id}/record-recovery`, {
                amount: parseFloat(recoveryAmount),
                notes: recoveryNotes
            });
            toast.success('Recovery recorded');
            setShowRecovery(false);
            setIsConfirmingRecovery(false);
            setRecoveryAmount('');
            setRecoveryNotes('');
            fetchProfile();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Recovery failed');
        } finally {
            setSubmitting(false);
        }
    };

    const handleRecordFollowUp = async (e) => {
        // ... (existing code)
    };

    const handleUpdateRetailer = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await axios.put(`/airtel-retailers/${id}`, editData);
            toast.success('Retailer updated');
            setShowEdit(false);
            fetchProfile();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Update failed');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteRetailer = async () => {
        if (!window.confirm(`DELETE RETAILER "${retailer.name}"? This will hide all their records.`)) return;
        try {
            await axios.delete(`/airtel-retailers/${id}`);
            toast.success('Retailer deleted');
            navigate('/airtel/retailers');
        } catch (error) {
            toast.error('Delete failed');
        }
    };

    const handleDeleteRecovery = async (recoveryId) => {
        if (!window.confirm('DELETE THIS PAYMENT RECORD? This will increase the pending balance.')) return;
        try {
            await axios.delete(`/airtel-recoveries/${recoveryId}`);
            toast.success('Recovery deleted');
            fetchProfile();
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
                    <div className="d-flex gap-2 justify-content-end mt-2 text-uppercase fw-bold">
                        <button 
                            className="btn btn-outline-secondary btn-sm px-3 shadow-sm"
                            onClick={() => {
                                setEditData({
                                    name: retailer.name,
                                    msisdn: retailer.msisdn,
                                    address: retailer.address || '',
                                    balance: retailer.balance,
                                    shop_id: retailer.shop_id || 1
                                });
                                setShowEdit(true);
                            }}
                        >
                            Edit
                        </button>
                        <button 
                            className="btn btn-warning btn-sm px-3 shadow-sm"
                            onClick={() => {
                                setSelectedDrop(null); // General follow-up
                                setFollowUpReason('');
                                setFollowUpDate('');
                                setShowFollowUp(true);
                            }}
                        >
                            Not Paid
                        </button>
                        <button 
                            className="btn btn-success btn-sm px-3 shadow-sm"
                            onClick={() => {
                                setRecoveryAmount(stats.total_pending > 0 ? stats.total_pending : '');
                                setIsConfirmingRecovery(false);
                                setShowRecovery(true);
                            }}
                        >
                            + Record Recovery
                        </button>
                    </div>
                </div>
            </div>

            <div className="row g-3 mb-4">
                <div className="col-md-3">
                    <div className="card border-0 shadow-sm bg-white h-100 border-start border-4 border-primary">
                        <div className="card-body">
                            <div className="x-small text-uppercase text-muted mb-1 fw-bold">Opening Balance</div>
                            <div className="h4 mb-0 fw-bold">₹{(parseFloat(retailer.balance) || 0).toLocaleString()}</div>
                        </div>
                    </div>
                </div>
                <div className="col-md-3">
                    <div className="card border-0 shadow-sm bg-white h-100">
                        <div className="card-body">
                            <div className="x-small text-uppercase text-muted mb-1 fw-bold">Total Dropped</div>
                            <div className="h4 mb-0 fw-bold">₹{(parseFloat(stats.total_dropped) || 0).toLocaleString()}</div>
                        </div>
                    </div>
                </div>
                <div className="col-md-3">
                    <div className="card border-0 shadow-sm bg-success text-white h-100">
                        <div className="card-body">
                            <div className="x-small text-uppercase opacity-75 mb-1 fw-bold">Total Recovered</div>
                            <div className="h4 mb-0 fw-bold">₹{(parseFloat(stats.total_recovered) || 0).toLocaleString()}</div>
                        </div>
                    </div>
                </div>
                <div className="col-md-3">
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
                                                    {formatSystemDate(item.refill_date)}
                                                </div>
                                                <div className="x-small text-muted">{formatSystemTime(item.refill_date)}</div>
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
                                        {formatSystemDate(item.next_recovery_date)}
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
                                                    <div className="text-success">{formatSystemDate(item.entryType === 'RECOVERY' ? item.recovered_at : item.recovered_at)}</div>
                                                    <div className="x-small text-muted">{item.recovery_user?.name || 'Staff'}</div>
                                                </>
                                            ) : '-'}
                                        </div>
                                    </td>
                                    <td className="text-end pe-4">
                                        {item.entryType === 'DROP' && item.status === 'pending' && (
                                            <span className="text-muted small">-</span>
                                        )}
                                        {item.entryType === 'RECOVERY' && hasFullAccess() && (
                                             <button 
                                                className="btn btn-link text-danger p-0 text-decoration-none x-small fw-bold text-uppercase"
                                                onClick={() => handleDeleteRecovery(item.id)}
                                             >
                                                 DEL
                                             </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal show={showRecovery} onClose={() => { setShowRecovery(false); setIsConfirmingRecovery(false); }} title="RECORD RECOVERY">
                <form onSubmit={handleRecordRecovery}>
                    {isConfirmingRecovery ? (
                        <div className="animate__animated animate__fadeIn">
                            <div className="text-center py-4 bg-success-light rounded-4 mb-4 border border-success-subtle">
                                <div className="x-small text-uppercase fw-bold text-success mb-2">Final Confirmation</div>
                                <div className="display-5 fw-bold text-success mb-1">₹{parseFloat(recoveryAmount).toLocaleString()}</div>
                                <div className="fw-bold text-uppercase small text-muted">{recoveryNotes || 'No Notes'}</div>
                            </div>
                            
                            <div className="alert alert-warning border-0 small text-center fw-bold text-uppercase mb-4">
                                Are you sure you want to final submit?
                            </div>

                            <div className="d-flex gap-2">
                                <button type="button" className="btn btn-outline-secondary flex-grow-1 text-uppercase fw-bold py-2" onClick={() => setIsConfirmingRecovery(false)}>
                                    Back
                                </button>
                                <button type="submit" className="btn btn-success flex-grow-1 text-uppercase fw-bold py-2 shadow" disabled={submitting}>
                                    {submitting ? 'Saving...' : 'Final Submit'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
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
                                        className="form-control fw-bold" 
                                        step="0.01"
                                        value={recoveryAmount}
                                        onChange={e => setRecoveryAmount(e.target.value)}
                                        required
                                    />
                                    <button type="button" className="btn btn-outline-secondary px-3 fw-bold small" onClick={() => setRecoveryAmount(stats.total_pending)}>FULL PAY</button>
                                </div>
                                <div className="form-text x-small">Current Pending: ₹{stats.total_pending.toLocaleString()}</div>
                            </div>
                            <div className="mb-4">
                                <label className="form-label x-small text-uppercase fw-bold">Payment Mode / Notes</label>
                                <div className="input-group">
                                    <select 
                                        className="form-select form-select-sm text-uppercase fw-bold" 
                                        style={{maxWidth:'120px'}}
                                        value={recoveryNotes.split(' - ')[0]}
                                        onChange={e => {
                                            const mode = e.target.value;
                                            const currentNote = recoveryNotes.includes(' - ') ? recoveryNotes.split(' - ')[1] : '';
                                            setRecoveryNotes(mode + (currentNote ? ` - ${currentNote}` : ''));
                                        }}
                                    >
                                        <option value="">SELECT</option>
                                        <option value="CASH">CASH</option>
                                        <option value="PHONE PE">PHONE PE</option>
                                        <option value="GPAY">GPAY</option>
                                        <option value="DIGITAL">DIGITAL</option>
                                        <option value="OTHER">OTHER</option>
                                    </select>
                                    <input 
                                        type="text" 
                                        className="form-control form-control-sm text-uppercase" 
                                        placeholder="ANY EXTRA DETAILS..." 
                                        value={recoveryNotes.includes(' - ') ? recoveryNotes.split(' - ')[1] : (['CASH','PHONE PE','GPAY','DIGITAL','OTHER'].includes(recoveryNotes) ? '' : recoveryNotes)}
                                        onChange={e => {
                                            const details = e.target.value;
                                            const mode = ['CASH','PHONE PE','GPAY','DIGITAL','OTHER'].find(m => recoveryNotes.startsWith(m)) || '';
                                            setRecoveryNotes(mode ? `${mode} - ${details}` : details);
                                        }}
                                    />
                                </div>
                            </div>
                            <button type="submit" className="btn btn-success w-100 text-uppercase fw-bold py-3 shadow-sm" disabled={submitting}>
                                Record Payment
                            </button>
                        </>
                    )}
                </form>
            </Modal>

            <Modal show={showFollowUp} onClose={() => setShowFollowUp(false)} title="NOT PAID / FOLLOW-UP">
                {/* ... (existing follow-up form) */}
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

            <Modal show={showEdit} onClose={() => setShowEdit(false)} title="EDIT RETAILER DETAILS">
                <form onSubmit={handleUpdateRetailer}>
                    <div className="row g-3 mb-4">
                        <div className="col-md-6">
                            <label className="form-label x-small text-uppercase fw-bold">Retailer Name</label>
                            <input type="text" className="form-control text-uppercase" value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} required />
                        </div>
                        <div className="col-md-6">
                            <label className="form-label x-small text-uppercase fw-bold">MSISDN (Airtel Number)</label>
                            <input type="text" className="form-control" value={editData.msisdn} onChange={e => setEditData({...editData, msisdn: e.target.value})} required />
                        </div>
                        <div className="col-md-12">
                            <label className="form-label x-small text-uppercase fw-bold">Shop Address (Optional)</label>
                            <textarea className="form-control text-uppercase" rows="2" value={editData.address} onChange={e => setEditData({...editData, address: e.target.value})} />
                        </div>
                        <div className="col-md-6">
                            <label className="form-label x-small text-uppercase fw-bold text-danger">Opening balance</label>
                            <input type="number" step="0.01" className="form-control fw-bold border-danger" value={editData.balance} onChange={e => setEditData({...editData, balance: e.target.value})} required />
                            <div className="form-text x-small text-danger fw-bold">!! Use this to adjust the initial debt !!</div>
                        </div>
                        <div className="col-md-6">
                            <label className="form-label x-small text-uppercase fw-bold">Shop ID</label>
                            <input type="number" className="form-control" value={editData.shop_id} onChange={e => setEditData({...editData, shop_id: e.target.value})} required />
                        </div>
                    </div>
                    
                    <div className="d-flex gap-2">
                        <button type="submit" className="btn btn-primary flex-grow-1 text-uppercase fw-bold py-2" disabled={submitting}>
                            {submitting ? 'Updating...' : 'Update Retailer'}
                        </button>
                        {hasFullAccess() && (
                            <button type="button" className="btn btn-outline-danger px-4 text-uppercase fw-bold" onClick={handleDeleteRetailer}>
                                Delete
                            </button>
                        )}
                    </div>
                </form>
            </Modal>
        </div>
    );
}
