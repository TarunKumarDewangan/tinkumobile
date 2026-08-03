import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import { toast } from 'react-toastify';

const TYPE_ICON = { BANK: '🏦', CARD: '💳', UPI: '📱' };

export default function BankBalances() {
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const results = await Promise.all(
                ['BANK', 'CARD', 'UPI'].map(type =>
                    api.get('/ledgers/entity-balances', { params: { type } }).then(r => r.data)
                )
            );
            setAccounts(results.flat());
        } catch {
            toast.error('Failed to load bank balances');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    const grandTotal = accounts.reduce((s, a) => s + parseFloat(a.net_balance || 0), 0);

    return (
        <div className="container-fluid py-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h4 className="fw-bold mb-0">🏦 Bank Balances</h4>
                    <div className="small text-muted">Live balance of every Bank / Card / UPI account</div>
                </div>
                <button className="btn btn-outline-secondary btn-sm rounded-pill d-inline-flex align-items-center gap-1 shadow-sm" onClick={loadData}>
                    <i className="bi bi-arrow-clockwise"></i> Refresh
                </button>
            </div>

            {/* Grand Total Banner */}
            <div className="card shadow-sm border-0 mb-4" style={{ background: 'linear-gradient(135deg,#0f172a,#1e293b)' }}>
                <div className="card-body p-4 d-flex justify-content-between align-items-center flex-wrap gap-2">
                    <div className="text-white-50 text-uppercase small fw-bold">Total Across All Accounts</div>
                    <div className="fw-bold text-white" style={{ fontSize: '1.6rem' }}>
                        ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-5">
                    <div className="spinner-border text-primary opacity-50"></div>
                </div>
            ) : accounts.length === 0 ? (
                <div className="card shadow-sm border-0">
                    <div className="card-body text-center py-5 text-muted">
                        No Bank / Card / UPI accounts yet. Add one from <Link to="/accounts/entity-manager">Entity Manager</Link> (type = BANK, CARD, or UPI).
                    </div>
                </div>
            ) : (
                <div className="row g-3">
                    {accounts
                        .sort((a, b) => b.net_balance - a.net_balance)
                        .map(acc => (
                        <div key={acc.id} className="col-12 col-sm-6 col-lg-4">
                            <Link
                                to={`/accounts/entity-ledger?id=${acc.id}&name=${encodeURIComponent(acc.name)}`}
                                className="card shadow-sm border-0 h-100 text-decoration-none text-dark"
                                style={{ transition: 'transform .15s' }}
                                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                            >
                                <div className="card-body p-4">
                                    <div className="d-flex justify-content-between align-items-start mb-3">
                                        <div>
                                            <div className="fw-bold">{TYPE_ICON[acc.type] || '🏦'} {acc.name}</div>
                                            <span className="badge bg-light text-muted fw-normal rounded-pill x-small mt-1">{acc.type}</span>
                                        </div>
                                    </div>
                                    <div className={`fw-bold ${acc.net_balance >= 0 ? 'text-success' : 'text-danger'}`} style={{ fontSize: '1.4rem' }}>
                                        ₹{Math.abs(acc.net_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </div>
                                    {acc.net_balance < 0 && (
                                        <div className="x-small text-danger fw-bold text-uppercase mt-1">Overdrawn</div>
                                    )}
                                </div>
                            </Link>
                        </div>
                    ))}
                </div>
            )}

            <style>{`.x-small { font-size: 0.72rem; }`}</style>
        </div>
    );
}
