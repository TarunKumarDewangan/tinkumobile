import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { toast } from 'react-toastify';
import { useAuth } from '../../contexts/AuthContext';

export default function Cashbook() {
    const { hasFullAccess } = useAuth();
    const [transactions, setTransactions] = useState([]);
    const [summary, setSummary] = useState({ total_in: 0, total_out: 0, balance: 0 });
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        from: new Date().toISOString().split('T')[0],
        to: new Date().toISOString().split('T')[0],
        type: '',
        category: '',
        shop_id: ''
    });
    const [shops, setShops] = useState([]);
    const [categories, setCategories] = useState([]);

    useEffect(() => {
        fetchData();
        if (hasFullAccess()) fetchShops();
        fetchCategories();
    }, [filters]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await api.get('/transactions', { params: filters });
            setTransactions(res.data.transactions.data);
            setSummary(res.data.summary);
        } catch (err) {
            toast.error('Failed to fetch transactions');
        } finally {
            setLoading(false);
        }
    };

    const fetchShops = async () => {
        try {
            const res = await api.get('/shops');
            setShops(res.data);
        } catch (err) {}
    };

    const fetchCategories = async () => {
        try {
            const res = await api.get('/transactions/categories');
            setCategories(res.data);
        } catch (err) {}
    };

    const deleteTransaction = async (id) => {
        if (!window.confirm('Delete this transaction? This will not affect the source record (Sale/Purchase).')) return;
        try {
            await api.delete(`/transactions/${id}`);
            toast.success('Deleted');
            fetchData();
        } catch (err) {
            toast.error('Failed to delete');
        }
    };

    return (
        <div className="container-fluid">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h4 className="fw-bold m-0">📖 Cashbook (Ledger)</h4>
                <div className="d-flex gap-2">
                    <button className="btn btn-outline-primary" onClick={fetchData}>🔄 Refresh</button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="row g-3 mb-4">
                <div className="col-md-4">
                    <div className="card border-0 shadow-sm bg-success text-white">
                        <div className="card-body">
                            <div className="text-white-50 small mb-1">Total Cash In</div>
                            <h3 className="mb-0">₹{summary.total_in.toLocaleString()}</h3>
                        </div>
                    </div>
                </div>
                <div className="col-md-4">
                    <div className="card border-0 shadow-sm bg-danger text-white">
                        <div className="card-body">
                            <div className="text-white-50 small mb-1">Total Cash Out</div>
                            <h3 className="mb-0">₹{summary.total_out.toLocaleString()}</h3>
                        </div>
                    </div>
                </div>
                <div className="col-md-4">
                    <div className="card border-0 shadow-sm bg-primary text-white">
                        <div className="card-body">
                            <div className="text-white-50 small mb-1">Net Balance</div>
                            <h3 className="mb-0">₹{summary.balance.toLocaleString()}</h3>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="card border-0 shadow-sm mb-4">
                <div className="card-body">
                    <div className="row g-3">
                        <div className="col-md-2">
                            <label className="form-label small fw-bold">From</label>
                            <input type="date" className="form-control" 
                                value={filters.from} onChange={e => setFilters({...filters, from: e.target.value})} />
                        </div>
                        <div className="col-md-2">
                            <label className="form-label small fw-bold">To</label>
                            <input type="date" className="form-control" 
                                value={filters.to} onChange={e => setFilters({...filters, to: e.target.value})} />
                        </div>
                        <div className="col-md-2">
                            <label className="form-label small fw-bold">Type</label>
                            <select className="form-select" value={filters.type} onChange={e => setFilters({...filters, type: e.target.value})}>
                                <option value="">All</option>
                                <option value="IN">Income (IN)</option>
                                <option value="OUT">Expense (OUT)</option>
                            </select>
                        </div>
                        <div className="col-md-2">
                            <label className="form-label small fw-bold">Category</label>
                            <select className="form-select" value={filters.category} onChange={e => setFilters({...filters, category: e.target.value})}>
                                <option value="">All</option>
                                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        {hasFullAccess() && (
                            <div className="col-md-2">
                                <label className="form-label small fw-bold">Shop</label>
                                <select className="form-select" value={filters.shop_id} onChange={e => setFilters({...filters, shop_id: e.target.value})}>
                                    <option value="">All Shops</option>
                                    {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                        )}
                        <div className="col-md-2 d-flex align-items-end">
                            <button className="btn btn-secondary w-100" onClick={() => setFilters({
                                from: new Date().toISOString().split('T')[0],
                                to: new Date().toISOString().split('T')[0],
                                type: '', category: '', shop_id: ''
                            })}>Clear</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Transactions Table */}
            <div className="card border-0 shadow-sm">
                <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                        <thead className="bg-light">
                            <tr>
                                <th>Date</th>
                                <th>Category</th>
                                <th>Description</th>
                                <th>Entity</th>
                                <th className="text-end">Cash In (₹)</th>
                                <th className="text-end">Cash Out (₹)</th>
                                <th className="text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="7" className="text-center py-5"><div className="spinner-border text-primary"/></td></tr>
                            ) : transactions.length === 0 ? (
                                <tr><td colSpan="7" className="text-center py-5 text-muted">No transactions found for this period.</td></tr>
                            ) : transactions.map(t => (
                                <tr key={t.id}>
                                    <td className="small text-nowrap">{t.transaction_date}</td>
                                    <td>
                                        <span className={`badge rounded-pill ${
                                            t.category === 'SALE' ? 'bg-success' : 
                                            t.category === 'PURCHASE' ? 'bg-danger' : 
                                            t.category === 'AIRTEL_RECOVERY' ? 'bg-info' : 'bg-secondary'
                                        }`}>
                                            {t.category}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="small fw-bold">{t.description}</div>
                                        <div className="text-muted" style={{fontSize:'0.7rem'}}>Mode: {t.payment_mode}</div>
                                    </td>
                                    <td className="small">
                                        {t.entity ? (
                                            <div>{t.entity.name || t.entity.invoice_no || 'Entity'}</div>
                                        ) : '—'}
                                    </td>
                                    <td className="text-end fw-bold text-success">
                                        {t.type === 'IN' ? `₹${t.amount.toLocaleString()}` : '—'}
                                    </td>
                                    <td className="text-end fw-bold text-danger">
                                        {t.type === 'OUT' ? `₹${t.amount.toLocaleString()}` : '—'}
                                    </td>
                                    <td className="text-center">
                                        {hasFullAccess() && (
                                            <button className="btn btn-sm btn-outline-danger p-1 line-height-1" onClick={() => deleteTransaction(t.id)}>
                                                🗑️
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
