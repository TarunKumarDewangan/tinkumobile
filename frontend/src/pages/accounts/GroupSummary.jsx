import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { toast } from 'react-toastify';
import { Link } from 'react-router-dom';

export default function GroupSummary() {
    const [entities, setEntities] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('ALL');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            // Reusing entity-balances endpoint
            const { data } = await api.get('/ledgers/entity-balances');
            setEntities(data);
        } catch (error) {
            toast.error('Failed to load group summary');
        } finally {
            setLoading(false);
        }
    };

    const filteredEntities = entities.filter(ent => {
        const matchesSearch = ent.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = typeFilter === 'ALL' || ent.type === typeFilter;
        return matchesSearch && matchesType;
    });

    const totalDebit = filteredEntities.reduce((sum, ent) => sum + (ent.net_balance > 0 ? ent.net_balance : 0), 0);
    const totalCredit = filteredEntities.reduce((sum, ent) => sum + (ent.net_balance < 0 ? Math.abs(ent.net_balance) : 0), 0);

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="container-fluid py-4 print-container">
            <div className="d-flex justify-content-between align-items-center mb-4 no-print">
                <h4 className="fw-bold mb-0">🏛️ Group Summary</h4>
                <div className="d-flex gap-2">
                    <button className="btn btn-outline-secondary btn-sm" onClick={loadData}>
                        <i className="bi bi-arrow-clockwise"></i> Refresh
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={handlePrint}>
                        <i className="bi bi-printer"></i> Print Report
                    </button>
                </div>
            </div>

            <div className="card shadow-sm border-0 mb-4 no-print">
                <div className="card-body p-3">
                    <div className="row g-3">
                        <div className="col-md-4">
                            <input 
                                type="text" 
                                className="form-control form-control-sm" 
                                placeholder="Search by name..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="col-md-3">
                            <select 
                                className="form-select form-select-sm" 
                                value={typeFilter}
                                onChange={e => setTypeFilter(e.target.value)}
                            >
                                <option value="ALL">All Account Types</option>
                                <option value="CUSTOMER">Customers (Regular)</option>
                                <option value="SHOP_CUSTOMER">Customers (Shop)</option>
                                <option value="SUPPLIER">Suppliers</option>
                                <option value="AIRTEL_RETAILER">Airtel Retailers</option>
                                <option value="SHOP">Shops</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <div className="card shadow-sm border-0 overflow-hidden tally-theme">
                <div className="card-header bg-light py-3 border-bottom no-print">
                    <div className="row fw-bold text-uppercase x-small text-muted">
                        <div className="col-6">Particulars</div>
                        <div className="col-3 text-end">Debit (Receivable)</div>
                        <div className="col-3 text-end">Credit (Payable)</div>
                    </div>
                </div>
                
                {/* Print Header (Visible only when printing) */}
                <div className="d-none d-print-block text-center mb-4">
                    <h2 className="fw-bold mb-1">Tinku Mobiles</h2>
                    <h5 className="text-muted">Group Summary Report</h5>
                    <div className="small">Generated on: {new Date().toLocaleString()}</div>
                    <hr />
                </div>

                <div className="card-body p-0">
                    <div className="tally-rows" style={{ minHeight: '400px' }}>
                        {loading ? (
                            <div className="text-center py-5">
                                <div className="spinner-border text-primary opacity-50"></div>
                            </div>
                        ) : filteredEntities.length === 0 ? (
                            <div className="text-center py-5 text-muted italic">No accounts with outstanding balances found.</div>
                        ) : (
                            filteredEntities.map((ent, idx) => (
                                <div key={ent.id} className={`tally-row border-bottom py-2 px-3 ${idx % 2 === 0 ? '' : 'bg-light bg-opacity-10'}`}>
                                    <div className="row align-items-center">
                                        <div className="col-6">
                                            <Link to={`/accounts/entity-ledger?id=${ent.id}&name=${encodeURIComponent(ent.name)}`} className="fw-bold text-primary text-decoration-none d-block">
                                                {ent.name}
                                            </Link>
                                            <div className="xx-small text-muted text-uppercase">{ent.type}</div>
                                        </div>
                                        <div className="col-3 text-end fw-bold">
                                            {ent.net_balance > 0 ? `₹${ent.net_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                                        </div>
                                        <div className="col-3 text-end fw-bold text-danger">
                                            {ent.net_balance < 0 ? `₹${Math.abs(ent.net_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
                
                <div className="card-footer bg-dark text-white py-3 border-0">
                    <div className="row fw-bold">
                        <div className="col-6 text-uppercase">Grand Total</div>
                        <div className="col-3 text-end">₹{totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                        <div className="col-3 text-end">₹{totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                    </div>
                </div>
            </div>

            <style>{`
                .tally-theme {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                }
                .tally-row:hover {
                    background-color: #f8f9fa;
                }
                .x-small { font-size: 0.75rem; }
                .xx-small { font-size: 0.65rem; }
                
                @media print {
                    .no-print { display: none !important; }
                    .card { border: none !important; box-shadow: none !important; }
                    .card-footer { background-color: #000 !important; color: #fff !important; }
                    body { background: #fff !important; }
                }
            `}</style>
        </div>
    );
}
