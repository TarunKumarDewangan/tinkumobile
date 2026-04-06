import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { toast } from 'react-toastify';
import { useAuth } from '../../contexts/AuthContext';

export default function ExpenseCategories() {
    const { hasFullAccess, user } = useAuth();
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [shops, setShops] = useState([]);
    
    const initialForm = {
        name: '',
        description: '',
        shop_id: user?.shop_id || ''
    };
    const [form, setForm] = useState(initialForm);
    const [editing, setEditing] = useState(null);

    useEffect(() => {
        fetchData();
        if (hasFullAccess()) fetchShops();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await api.get('/expense-categories');
            setCategories(res.data);
        } catch (err) {
            toast.error('Failed to fetch categories');
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editing) {
                await api.put(`/expense-categories/${editing}`, form);
                toast.success('Category updated');
            } else {
                await api.post('/expense-categories', form);
                toast.success('Category created');
            }
            setShowModal(false);
            setForm(initialForm);
            setEditing(null);
            fetchData();
        } catch (err) {
            toast.error('Failed to save category');
        }
    };

    const startEdit = (cat) => {
        setForm({
            name: cat.name,
            description: cat.description || '',
            shop_id: cat.shop_id || ''
        });
        setEditing(cat.id);
        setShowModal(true);
    };

    const deleteCategory = async (id) => {
        if (!window.confirm('Delete this category? Transactions in this category will remain but reference will be broken.')) return;
        try {
            await api.delete(`/expense-categories/${id}`);
            toast.success('Deleted');
            fetchData();
        } catch (err) {
            toast.error('Failed to delete');
        }
    };

    return (
        <div className="container-fluid">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h4 className="fw-bold m-0">📁 Expense Categories</h4>
                <button className="btn btn-primary" onClick={() => { setForm(initialForm); setEditing(null); setShowModal(true); }}>➕ New Category</button>
            </div>

            <div className="row g-4">
                <div className="col-md-8">
                    <div className="card border-0 shadow-sm">
                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0">
                                <thead className="bg-light">
                                    <tr>
                                        <th>Name</th>
                                        <th>Description</th>
                                        {hasFullAccess() && <th>Shop</th>}
                                        <th className="text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan="4" className="text-center py-5"><div className="spinner-border text-primary"/></td></tr>
                                    ) : categories.length === 0 ? (
                                        <tr><td colSpan="4" className="text-center py-5 text-muted">No categories defined yet.</td></tr>
                                    ) : categories.map(c => (
                                        <tr key={c.id}>
                                            <td className="fw-bold text-primary">{c.name}</td>
                                            <td className="text-muted small">{c.description || '—'}</td>
                                            {hasFullAccess() && <td className="small">{c.shop_id ? 'Local' : 'Global'}</td>}
                                            <td className="text-center">
                                                <div className="d-flex justify-content-center gap-1">
                                                    <button className="btn btn-sm btn-outline-primary" onClick={() => startEdit(c)}>✏️</button>
                                                    <button className="btn btn-sm btn-outline-danger" onClick={() => deleteCategory(c.id)}>🗑️</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                <div className="col-md-4">
                    <div className="card border-0 shadow-sm bg-light">
                        <div className="card-body">
                            <h6 className="fw-bold mb-3">💡 Categories Tip</h6>
                            <div className="small text-muted">
                                Create categories for different overheads like:
                                <ul className="mt-2 text-start">
                                    <li><b>Rent</b> - Monthly shop rent</li>
                                    <li><b>Electricity</b> - Monthly bills</li>
                                    <li><b>Furniture</b> - Interior work</li>
                                    <li><b>Stationary</b> - Paper, pens, bills</li>
                                    <li><b>Refreshment</b> - Tea/Coffee/Meals</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow">
                            <div className="modal-header bg-primary text-white">
                                <h5 className="modal-title">{editing ? 'Edit Category' : 'New Category'}</h5>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setShowModal(false)}></button>
                            </div>
                            <form onSubmit={handleSubmit}>
                                <div className="modal-body p-4">
                                    <div className="mb-3">
                                        <label className="form-label small fw-bold">Category Name</label>
                                        <input type="text" className="form-control" required placeholder="e.g. Furniture, Rent..."
                                            value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label small fw-bold">Description (Optional)</label>
                                        <textarea className="form-control" rows="2" placeholder="Tell us more about this category"
                                            value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
                                    </div>
                                    {hasFullAccess() && !editing && (
                                        <div className="mb-3">
                                            <label className="form-label small fw-bold">Assign to Shop (Optional)</label>
                                            <select className="form-select" value={form.shop_id} onChange={e => setForm({...form, shop_id: e.target.value})}>
                                                <option value="">Global / Shared</option>
                                                {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                            </select>
                                            <div className="form-text small">Global categories are visible to all shops.</div>
                                        </div>
                                    )}
                                </div>
                                <div className="modal-footer bg-light p-3 border-0">
                                    <button type="button" className="btn btn-outline-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary px-4">Save Category</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
