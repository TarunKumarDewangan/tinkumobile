import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { toast } from 'react-toastify';
import { useAuth } from '../../contexts/AuthContext';

export default function Overheads() {
    const { hasFullAccess, user } = useAuth();
    const [transactions, setTransactions] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [shops, setShops] = useState([]);
    
    const initialForm = {
        type: 'OUT',
        category: 'EXPENSE',
        amount: '',
        payment_mode: 'CASH',
        entity_type: 'ExpenseCategory',
        entity_id: '',
        description: '',
        transaction_date: new Date().toISOString().split('T')[0],
        shop_id: user?.shop_id || ''
    };
    const [form, setForm] = useState(initialForm);

    useEffect(() => {
        fetchData();
        fetchCategories();
        if (hasFullAccess()) fetchShops();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch only EXPENSE and manual INCOME categories
            const res = await api.get('/transactions', { params: { category: 'EXPENSE,OTHER_INCOME' } });
            setTransactions(res.data.transactions.data);
        } catch (err) {
            toast.error('Failed to fetch overheads');
        } finally {
            setLoading(false);
        }
    };

    const fetchCategories = async () => {
        try {
            const res = await api.get('/expense-categories');
            setCategories(res.data);
        } catch (err) {}
    };

    const fetchShops = async () => {
        try {
            const res = await api.get('/shops');
            setShops(res.data);
        } catch (err) {}
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/transactions', form);
            toast.success('Record saved');
            setShowModal(false);
            setForm(initialForm);
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save');
        }
    };

    const deleteTransaction = async (id) => {
        if (!window.confirm('Delete this record?')) return;
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
                <h4 className="fw-bold m-0">💸 Business Overheads (Expenses)</h4>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>➕ Add New Expense</button>
            </div>

            <div className="card border-0 shadow-sm">
                <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                        <thead className="bg-light text-nowrap">
                            <tr>
                                <th>Date</th>
                                <th>Category</th>
                                <th>Description</th>
                                <th className="text-end">Amount (₹)</th>
                                <th className="text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="5" className="text-center py-5"><div className="spinner-border text-primary"/></td></tr>
                            ) : transactions.length === 0 ? (
                                <tr><td colSpan="5" className="text-center py-5 text-muted">No manual overheads recorded yet.</td></tr>
                            ) : transactions.map(t => (
                                <tr key={t.id}>
                                    <td>{t.transaction_date}</td>
                                    <td>{t.entity?.name || 'General Expense'}</td>
                                    <td>{t.description}</td>
                                    <td className="text-end fw-bold">₹{t.amount.toLocaleString()}</td>
                                    <td className="text-center">
                                        <button className="btn btn-sm btn-outline-danger p-1" onClick={() => deleteTransaction(t.id)}>🗑️</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Expense Modal */}
            {showModal && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow">
                            <div className="modal-header bg-primary text-white">
                                <h5 className="modal-title">Record Overhead/Income</h5>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setShowModal(false)}></button>
                            </div>
                            <form onSubmit={handleSubmit}>
                                <div className="modal-body p-4">
                                    <div className="row g-3">
                                        <div className="col-12">
                                            <div className="btn-group w-100 mb-2">
                                                <input type="radio" className="btn-check" name="type" id="typeOut" value="OUT" 
                                                    checked={form.type === 'OUT'} onChange={e => setForm({...form, type: e.target.value})} />
                                                <label className="btn btn-outline-danger" htmlFor="typeOut">Expense (OUT)</label>
                                                
                                                <input type="radio" className="btn-check" name="type" id="typeIn" value="IN" 
                                                    checked={form.type === 'IN'} onChange={e => setForm({...form, type: e.target.value})} />
                                                <label className="btn btn-outline-success" htmlFor="typeIn">Income (IN)</label>
                                            </div>
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label small fw-bold">Amount</label>
                                            <div className="input-group">
                                                <span className="input-group-text">₹</span>
                                                <input type="number" className="form-control" required placeholder="0.00"
                                                    value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} />
                                            </div>
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label small fw-bold">Date</label>
                                            <input type="date" className="form-control" required
                                                value={form.transaction_date} onChange={e => setForm({...form, transaction_date: e.target.value})} />
                                        </div>
                                        <div className="col-12">
                                            <label className="form-label small fw-bold">Category</label>
                                            <select className="form-select" required value={form.entity_id} 
                                                onChange={e => setForm({...form, entity_id: e.target.value})}>
                                                <option value="">Select Category...</option>
                                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="col-12">
                                            <label className="form-label small fw-bold">Payment Mode</label>
                                            <select className="form-select" value={form.payment_mode} onChange={e => setForm({...form, payment_mode: e.target.value})}>
                                                <option value="CASH">Cash</option>
                                                <option value="PHONEPE">PhonePe</option>
                                                <option value="GPAY">GPay</option>
                                                <option value="BANK_TRANSFER">Bank Transfer</option>
                                            </select>
                                        </div>
                                        {hasFullAccess() && (
                                            <div className="col-12">
                                                <label className="form-label small fw-bold">Shop</label>
                                                <select className="form-select" required value={form.shop_id} 
                                                    onChange={e => setForm({...form, shop_id: e.target.value})}>
                                                    <option value="">Select Shop...</option>
                                                    {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                </select>
                                            </div>
                                        )}
                                        <div className="col-12">
                                            <label className="form-label small fw-bold">Description</label>
                                            <textarea className="form-control" rows="2" placeholder="e.g. Paid rent for April, Purchased Office supplies..."
                                                value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-footer bg-light p-3 border-0">
                                    <button type="button" className="btn btn-outline-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary px-4">Save Transaction</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
