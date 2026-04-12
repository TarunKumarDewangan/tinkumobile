import { useState, useEffect } from 'react';
import axios from '../../api/axios';
import { toast } from 'react-toastify';
import { useAuth } from '../../contexts/AuthContext';
import Modal from '../../components/Modal';

export default function QuickRecovery() {
    const { user } = useAuth();
    const [query, setQuery] = useState('');
    const [data, setData] = useState(null);
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [showRecoveryModal, setShowRecoveryModal] = useState(false);
    const [recoveryForm, setRecoveryForm] = useState({ 
        amount: '', 
        notes: '',
        recovered_at: new Date().toISOString().split('T')[0]
    });
    const [saving, setSaving] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);

    const formatTime = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        if (isNaN(date)) return '';
        return date.toLocaleTimeString('en-IN', { 
            hour: '2-digit', 
            minute: '2-digit', 
            hour12: true 
        }).toUpperCase();
    };

    // Auto-fetch when query is 10 digits, otherwise search by name
    useEffect(() => {
        const timer = setTimeout(() => {
            if (query.length === 10 && !isNaN(query)) {
                fetchDirectRetailer(query);
                setShowResults(false);
            } else if (query.length >= 3) {
                searchRetailers(query);
            } else {
                setResults([]);
                setShowResults(false);
                if (query.length === 0) setData(null);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [query]);

    const fetchDirectRetailer = async (num) => {
        setLoading(true);
        try {
            const { data } = await axios.get(`/public/retailer/${num}`);
            setData(data);
        } catch (error) {
            setData(null);
            toast.error('Retailer not found');
        } finally {
            setLoading(false);
        }
    };

    const searchRetailers = async (q) => {
        setLoading(true);
        try {
            const { data } = await axios.get(`/airtel-retailers?search=${q}&per_page=5`);
            setResults(data.data);
            setShowResults(true);
        } catch (error) {
            setResults([]);
        } finally {
            setLoading(false);
        }
    };

    const selectRetailer = (retailer) => {
        setQuery(retailer.msisdn);
        setShowResults(false);
        fetchDirectRetailer(retailer.msisdn);
    };

    const handleRecordRecovery = async (e) => {
        e.preventDefault();
        if (!data || !data.retailer) return;

        if (!isConfirming) {
            setIsConfirming(true);
            return;
        }

        setSaving(true);
        try {
            await axios.post(`/airtel-retailers/${data.retailer.id}/record-recovery`, {
                amount: recoveryForm.amount,
                notes: recoveryForm.notes?.toUpperCase(),
                recovered_at: recoveryForm.recovered_at
            });
            toast.success('Recovery recorded successfully!');
            setShowRecoveryModal(false);
            setIsConfirming(false);
            setRecoveryForm({ 
                amount: '', 
                notes: '',
                recovered_at: new Date().toISOString().split('T')[0]
            });
            fetchDirectRetailer(data.retailer.msisdn); // Refresh data
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to record recovery');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="container-fluid py-3 bg-light min-vh-100">
            {/* Search Section */}
            <div className="card shadow-sm border-0 rounded-4 mb-3 overflow-visible z-3">
                <div className="card-body p-4 bg-primary text-white text-center rounded-4">
                    <h5 className="text-uppercase fw-bold mb-3" style={{letterSpacing:'1px'}}>Airtel Quick Recovery</h5>
                    <div className="position-relative">
                        <input 
                            type="text" 
                            className="form-control form-control-lg text-center fw-bold fs-4 rounded-pill border-0 shadow"
                            placeholder="Type Name or MSISDN..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            autoFocus
                        />
                        {loading && <div className="spinner-border spinner-border-sm position-absolute" style={{right:'20px', top:'15px', color:'#000'}}></div>}
                        
                        {/* Results Dropdown */}
                        {showResults && results.length > 0 && (
                            <div className="position-absolute w-100 mt-2 shadow-lg rounded-4 overflow-hidden animate__animated animate__fadeInDown" style={{top:'100%', left:0, zIndex:1000}}>
                                <div className="list-group list-group-flush shadow">
                                    {results.map(r => (
                                        <button 
                                            key={r.id}
                                            className="list-group-item list-group-item-action p-3 text-start border-0"
                                            onClick={() => selectRetailer(r)}
                                        >
                                            <div className="d-flex justify-content-between align-items-center">
                                                <div>
                                                    <div className="fw-bold text-uppercase text-dark">{r.name}</div>
                                                    <div className="small text-muted">{r.msisdn}</div>
                                                </div>
                                                <div className="text-danger fw-bold">₹{parseFloat(r.pending_balance || 0).toLocaleString()}</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {data ? (
                <>
                    {/* Details Card */}
                    <div className="card shadow-sm border-0 rounded-4 mb-3 animate__animated animate__fadeInUp">
                        <div className="card-body p-4">
                            <div className="d-flex justify-content-between align-items-center mb-4">
                                <div>
                                    <h4 className="fw-bold mb-0 text-uppercase">{data.retailer.name}</h4>
                                    <div className="text-muted small fw-bold">MSISDN: {data.retailer.msisdn}</div>
                                </div>
                                <div className="text-end">
                                    <div className="x-small text-uppercase text-muted fw-bold">Pending</div>
                                    <div className="h2 fw-bold mb-0 text-danger">₹{parseFloat(data.stats.total_pending).toLocaleString()}</div>
                                </div>
                            </div>

                            <button 
                                className="btn btn-success btn-lg w-100 fw-bold rounded-pill shadow-sm mb-2"
                                onClick={() => {
                                    setRecoveryForm({ 
                                        ...recoveryForm, 
                                        amount: data.stats.total_pending,
                                        recovered_at: new Date().toISOString().split('T')[0]
                                    });
                                    setIsConfirming(false);
                                    setShowRecoveryModal(true);
                                }}
                            >
                                💸 RECORD RECOVERY
                            </button>
                        </div>
                    </div>

                    {/* Simple Stats Row */}
                    <div className="row g-2 mb-3">
                        <div className="col-6">
                            <div className="card border-0 shadow-sm p-3 rounded-4 text-center bg-white h-100">
                                <div className="x-small text-uppercase text-muted fw-bold">Dropped</div>
                                <div className="fw-bold fs-5">₹{parseFloat(data.stats.total_dropped).toLocaleString()}</div>
                            </div>
                        </div>
                        <div className="col-6">
                            <div className="card border-0 shadow-sm p-3 rounded-4 text-center bg-white h-100">
                                <div className="x-small text-uppercase text-muted fw-bold">Collected</div>
                                <div className="fw-bold fs-5 text-success">₹{parseFloat(data.stats.total_recovered).toLocaleString()}</div>
                            </div>
                        </div>
                    </div>

                    {/* History Section */}
                    <div className="card shadow-sm border-0 rounded-4 overflow-hidden">
                        <div className="card-header bg-white border-0 py-3 ps-4">
                            <h6 className="mb-0 fw-bold text-uppercase">Recent History</h6>
                        </div>
                        <div className="table-responsive">
                            <table className="table table-hover mb-0 align-middle">
                                <tbody>
                                    {[
                                        ...(data.drops || []).map(d => ({ ...d, entryType: 'DROP' })),
                                        ...(data.recoveries || []).map(r => ({ ...r, entryType: 'RECOVERY' }))
                                    ].sort((a,b) => {
                                        const dateA = new Date(a.entryType === 'DROP' ? a.refill_date : a.recovered_at);
                                        const dateB = new Date(b.entryType === 'DROP' ? b.refill_date : b.recovered_at);
                                        return dateB - dateA;
                                    }).slice(0, 10).map((item, idx) => (
                                        <tr key={idx} className={item.entryType === 'RECOVERY' ? 'bg-success-light' : ''}>
                                            <td className="ps-4">
                                                <div className="fw-bold small">
                                                    {new Date(item.entryType === 'DROP' ? item.refill_date : item.recovered_at).toLocaleDateString('en-GB', {day:'2-digit', month:'short'})}
                                                    <span className="ms-1 x-small text-muted font-monospace opacity-75">@{formatTime(item.entryType === 'DROP' ? item.refill_date : item.recovered_at)}</span>
                                                </div>
                                                <div className="x-small text-muted text-uppercase">{item.entryType}</div>
                                            </td>
                                            <td className={`fw-bold ${item.entryType === 'RECOVERY' ? 'text-success' : 'text-primary'}`}>
                                                ₹{parseFloat(item.amount).toLocaleString()}
                                            </td>
                                            <td className="text-end pe-4">
                                                <span className={`badge rounded-pill x-small ${item.entryType === 'RECOVERY' ? 'bg-success' : (item.status === 'recovered' ? 'bg-info' : 'bg-warning text-dark')}`}>
                                                    {item.entryType === 'RECOVERY' ? 'PAID' : item.status.toUpperCase()}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {(!data.drops?.length && !data.recoveries?.length) && (
                                        <tr><td className="text-center py-4 text-muted small">No recent activity</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : query.length > 0 && query.length < 10 && !isNaN(query) && !showResults && (
                <div className="text-center py-5 text-muted animate__animated animate__fadeIn">
                    <div className="fs-1 opacity-25 mb-2">🔍</div>
                    <div className="fw-bold text-uppercase x-small">Typing MSISDN...</div>
                </div>
            )}

            {/* Recovery Record Modal */}
            <Modal show={showRecoveryModal} onClose={() => { setShowRecoveryModal(false); setIsConfirming(false); }} title="RECORD RECOVERY">
                <form onSubmit={handleRecordRecovery}>
                    {isConfirming ? (
                        <div className="animate__animated animate__fadeIn">
                             <div className="text-center py-4 bg-success-light rounded-4 mb-4 border border-success-subtle">
                                <div className="x-small text-uppercase fw-bold text-success mb-2">Final Confirmation</div>
                                <div className="display-4 fw-bold text-success mb-1">₹{parseFloat(recoveryForm.amount).toLocaleString()}</div>
                                <div className="text-muted small fw-bold mb-1">Date: {new Date(recoveryForm.recovered_at).toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'})}</div>
                                <div className="fw-bold text-uppercase small text-muted">{recoveryForm.notes || 'No Notes'}</div>
                            </div>

                            <div className="alert alert-warning border-0 small text-center fw-bold text-uppercase mb-4">
                                Are you sure you want to final submit?
                            </div>

                            <div className="d-grid gap-2">
                                <button type="submit" className="btn btn-success btn-lg fw-bold text-uppercase shadow-sm py-3" disabled={saving}>
                                    {saving ? <div className="spinner-border spinner-border-sm me-2"></div> : 'Final Submit'}
                                </button>
                                <button type="button" className="btn btn-link text-muted fw-bold text-uppercase text-decoration-none" onClick={() => setIsConfirming(false)}>
                                    Back to Edit
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="mb-4">
                                <label className="form-label text-uppercase x-small fw-bold text-muted mb-1" style={{letterSpacing:'0.5px'}}>RETAILER</label>
                                <div className="fw-bold h5 text-uppercase mb-0">{data?.retailer?.name}</div>
                            </div>

                            <div className="mb-3">
                                <label className="form-label text-uppercase x-small fw-bold text-muted mb-1" style={{letterSpacing:'0.5px'}}>AMOUNT RECEIVED</label>
                                <div className="input-group">
                                    <span className="input-group-text bg-white border-end-0 fw-bold">₹</span>
                                    <input 
                                        type="number" 
                                        className="form-control border-start-0 fw-bold" 
                                        required 
                                        value={recoveryForm.amount} 
                                        onChange={e => setRecoveryForm({...recoveryForm, amount: e.target.value})} 
                                    />
                                    <button 
                                        type="button" 
                                        className="btn btn-outline-secondary text-uppercase fw-bold x-small px-3"
                                        onClick={() => setRecoveryForm({...recoveryForm, amount: data?.stats?.total_pending || 0})}
                                    >
                                        FULL PAY
                                    </button>
                                </div>
                                <div className="form-text x-small mt-1 text-muted">Current Pending: ₹{parseFloat(data?.stats?.total_pending || 0).toLocaleString()}</div>
                            </div>
                            
                            <div className="mb-3">
                                <label className="form-label text-uppercase x-small fw-bold text-muted mb-1" style={{letterSpacing:'0.5px'}}>RECOVERY DATE</label>
                                <input 
                                    type="date" 
                                    className="form-control fw-bold" 
                                    required 
                                    value={recoveryForm.recovered_at} 
                                    onChange={e => setRecoveryForm({...recoveryForm, recovered_at: e.target.value})} 
                                />
                                <div className="form-text x-small mt-1 text-muted">Date of money collection</div>
                            </div>

                            <div className="mb-4">
                                <label className="form-label text-uppercase x-small fw-bold text-muted mb-1" style={{letterSpacing:'0.5px'}}>PAYMENT MODE / NOTES</label>
                                <div className="input-group">
                                    <select 
                                        className="form-select border-end-0 fw-bold text-uppercase x-small" 
                                        style={{maxWidth:'120px'}}
                                        value={['CASH','GPAY','PHONE PE','PAYTM','DIGITAL','BANK'].includes(recoveryForm.notes?.split(' - ')[0]) ? recoveryForm.notes.split(' - ')[0] : (recoveryForm.notes ? 'OTHER' : 'CASH')}
                                        onChange={e => {
                                            if (e.target.value === 'OTHER') {
                                                setRecoveryForm({...recoveryForm, notes: ''});
                                            } else {
                                                const extra = recoveryForm.notes?.includes(' - ') ? recoveryForm.notes.split(' - ')[1] : '';
                                                setRecoveryForm({...recoveryForm, notes: e.target.value + (extra ? ' - ' + extra : '')});
                                            }
                                        }}
                                    >
                                        <option value="CASH">CASH</option>
                                        <option value="GPAY">GPAY</option>
                                        <option value="PHONE PE">PHONE PE</option>
                                        <option value="PAYTM">PAYTM</option>
                                        <option value="DIGITAL">DIGITAL</option>
                                        <option value="BANK">BANK</option>
                                        <option value="OTHER">OTHER</option>
                                    </select>
                                    <input 
                                        type="text" 
                                        className="form-control text-uppercase x-small" 
                                        placeholder={recoveryForm.notes?.split(' - ')[0] === 'OTHER' || !['CASH','GPAY','PHONE PE','PAYTM','DIGITAL','BANK'].includes(recoveryForm.notes?.split(' - ')[0]) ? "TYPE PAYMENT MODE..." : "ANY EXTRA DETAILS..."}
                                        value={
                                            ['CASH','GPAY','PHONE PE','PAYTM','DIGITAL','BANK'].includes(recoveryForm.notes?.split(' - ')[0]) 
                                            ? (recoveryForm.notes?.includes(' - ') ? recoveryForm.notes.split(' - ')[1] : '')
                                            : recoveryForm.notes
                                        }
                                        onChange={e => {
                                            const mode = ['CASH','GPAY','PHONE PE','PAYTM','DIGITAL','BANK'].includes(recoveryForm.notes?.split(' - ')[0]) ? recoveryForm.notes.split(' - ')[0] : 'OTHER';
                                            if (mode === 'OTHER') {
                                                setRecoveryForm({...recoveryForm, notes: e.target.value.toUpperCase()});
                                            } else {
                                                setRecoveryForm({...recoveryForm, notes: mode + (e.target.value ? ' - ' + e.target.value.toUpperCase() : '')});
                                            }
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="d-grid mt-4">
                                <button type="submit" className="btn btn-success btn-lg fw-bold text-uppercase shadow-sm py-3" disabled={saving}>
                                    RECORD PAYMENT
                                </button>
                            </div>
                        </>
                    )}
                </form>
            </Modal>

            <style>{`
                .bg-success-light { background-color: rgba(25, 135, 84, 0.05); }
                .x-small { font-size: 0.65rem; }
            `}</style>
        </div>
    );
}
