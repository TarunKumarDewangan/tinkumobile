import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { toast } from 'react-toastify';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const ENTITY_TYPES = ['CUSTOMER', 'SHOP_CUSTOMER', 'SUPPLIER', 'AIRTEL_RETAILER', 'SHOP', 'OTHER'];
const BALANCE_TYPES = ['RECEIVABLE', 'PAYABLE'];

export default function GroupSummary() {
    const { isOwner } = useAuth();
    const [entities, setEntities] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('ALL');
    const [showOpeningStock, setShowOpeningStock] = useState(false);
    const [hideZeroBalances, setHideZeroBalances] = useState(true);
    const [showCategoryTotals, setShowCategoryTotals] = useState(false);

    // Edit Modal state
    const [editEntity, setEditEntity] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [saving, setSaving] = useState(false);

    // Delete state
    const [deleting, setDeleting] = useState(null);         // entity id being deleted
    const [deletingHistory, setDeletingHistory] = useState(null); // entity id — del with history

    const loadData = async (query = '', type = 'ALL') => {
        setLoading(true);
        try {
            const params = {};
            if (query) params.q = query;
            if (type !== 'ALL') params.type = type;
            const { data } = await api.get('/ledgers/entity-balances', { params });
            setEntities(data);
        } catch {
            toast.error('Failed to load group summary');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            loadData(searchTerm, typeFilter);
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm, typeFilter]);

    const filteredEntities = entities.filter(ent => {
        if (!showOpeningStock && ent.name === 'OPENING STOCK') return false;
        if (hideZeroBalances && Math.abs(Number(ent.net_balance)) < 0.01) return false;
        return true;
    }).sort((a, b) => {
        if (a.name === 'OPENING STOCK') return -1;
        if (b.name === 'OPENING STOCK') return 1;
        return 0;
    });

    const totalDebit  = filteredEntities.reduce((s, e) => s + (e.net_balance > 0 ? e.net_balance : 0), 0);
    const totalCredit = filteredEntities.reduce((s, e) => s + (e.net_balance < 0 ? Math.abs(e.net_balance) : 0), 0);

    /* ── Edit ── */
    const openEdit = (ent) => {
        setEditEntity(ent);
        setEditForm({
            name:            ent.name,
            type:            ent.type,
            phone:           ent.phone ?? '',
            opening_balance: ent.opening_balance ?? 0,
            balance_type:    ent.balance_type ?? 'RECEIVABLE',
        });
    };

    const handleEditSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.put(`/entities/${editEntity.id}`, editForm);
            toast.success(`${editForm.name} updated`);
            setEditEntity(null);
            loadData();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Update failed');
        } finally {
            setSaving(false);
        }
    };

    /* ── Delete (entity only) ── */
    const handleDelete = async (ent) => {
        if (!window.confirm(`Delete "${ent.name}" from accounts?\n\nThis removes the entity record but KEEPS transaction history.`)) return;
        setDeleting(ent.id);
        try {
            await api.delete(`/entities/${ent.id}`);
            toast.success(`"${ent.name}" deleted`);
            setEntities(prev => prev.filter(e => e.id !== ent.id));
        } catch (err) {
            toast.error(err.response?.data?.message || 'Delete failed');
        } finally {
            setDeleting(null);
        }
    };

    /* ── Delete with full history ── */
    const handleDeleteWithHistory = async (ent) => {
        const first = window.confirm(
            `⚠️ DELETE "${ent.name}" WITH ALL TRANSACTION HISTORY?\n\nThis will permanently erase:\n• The account record\n• ALL ledger transactions for this account\n• Balance history\n\nThis CANNOT be undone. Confirm?`
        );
        if (!first) return;
        const second = window.confirm(`FINAL WARNING: Completely erase "${ent.name}" and every transaction linked to it?`);
        if (!second) return;

        setDeletingHistory(ent.id);
        try {
            const { data } = await api.delete(`/entities/${ent.id}/with-history`);
            toast.success(data.message || `"${ent.name}" and its history deleted`);
            setEntities(prev => prev.filter(e => e.id !== ent.id));
        } catch (err) {
            toast.error(err.response?.data?.message || 'Delete with history failed');
        } finally {
            setDeletingHistory(null);
        }
    };

    return (
        <div className="container-fluid py-4 print-container">
            {/* Header */}
            <div className="d-flex justify-content-between align-items-center mb-4 no-print">
                <h4 className="fw-bold mb-0">🏛️ Group Summary</h4>
                <div className="d-flex gap-2">
                    <button 
                        className={`btn btn-sm rounded-pill d-inline-flex align-items-center gap-1 shadow-sm ${showCategoryTotals ? 'btn-secondary text-white' : 'btn-outline-secondary'}`} 
                        onClick={() => setShowCategoryTotals(!showCategoryTotals)}
                    >
                        <i className="bi bi-grid-3x3-gap"></i> Category Totals
                    </button>
                    <button className="btn btn-outline-secondary btn-sm rounded-pill d-inline-flex align-items-center gap-1 shadow-sm" onClick={() => loadData(searchTerm, typeFilter)}>
                        <i className="bi bi-arrow-clockwise"></i> Refresh
                    </button>
                    <button className="btn btn-outline-dark btn-sm rounded-pill d-inline-flex align-items-center gap-1 shadow-sm" onClick={() => window.print()}>
                        <i className="bi bi-printer"></i> Print
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="card shadow-sm border-0 mb-4 no-print">
                <div className="card-body p-3">
                    <div className="row g-3">
                        <div className="col-md-4">
                            <input
                                type="text"
                                className="form-control form-control-sm"
                                placeholder="Search by name or mobile..."
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
                        <div className="col-md-5 d-flex align-items-center justify-content-end gap-3">
                            <div className="form-check form-switch mb-0">
                                <input className="form-check-input" type="checkbox" role="switch" id="showZeroBalancesSwitch" style={{ cursor: 'pointer' }}
                                    checked={!hideZeroBalances} onChange={e => setHideZeroBalances(!e.target.checked)} />
                                <label className="form-check-label ms-2 small fw-bold text-muted" htmlFor="showZeroBalancesSwitch" style={{ cursor: 'pointer' }}>
                                    Show Zero Balance
                                </label>
                            </div>
                            <div className="form-check form-switch mb-0">
                                <input className="form-check-input" type="checkbox" role="switch" id="showOpeningStockSwitch" style={{ cursor: 'pointer' }}
                                    checked={showOpeningStock} onChange={e => setShowOpeningStock(e.target.checked)} />
                                <label className="form-check-label ms-2 small fw-bold text-muted" htmlFor="showOpeningStockSwitch" style={{ cursor: 'pointer' }}>
                                    Show Opening Stock
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Category-wise Totals Summary */}
            {showCategoryTotals && (() => {
                const categoryTotals = filteredEntities.reduce((acc, ent) => {
                    const type = ent.type || 'OTHER';
                    if (!acc[type]) acc[type] = { debit: 0, credit: 0, count: 0 };
                    if (ent.net_balance > 0) acc[type].debit += ent.net_balance;
                    if (ent.net_balance < 0) acc[type].credit += Math.abs(ent.net_balance);
                    acc[type].count += 1;
                    return acc;
                }, {});

                return (
                    <div className="card shadow-sm border-0 mb-4 tally-theme animate-fadeIn no-print">
                        <div className="card-header bg-light py-2 border-bottom fw-bold x-small text-uppercase text-muted">
                            Category-wise Totals
                        </div>
                        <div className="card-body p-3">
                            <div className="row g-2">
                                {Object.keys(categoryTotals).length === 0 ? (
                                    <div className="text-muted small px-3">No categories found.</div>
                                ) : (
                                    Object.entries(categoryTotals).map(([cat, val]) => (
                                        <div key={cat} className="col-md-4 col-sm-6">
                                            <div className="p-2 border rounded bg-light bg-opacity-50">
                                                <div className="fw-bold x-small text-secondary mb-1">{cat.replace(/_/g, ' ')} ({val.count})</div>
                                                <div className="d-flex justify-content-between small">
                                                    <span className="text-muted">Debit:</span>
                                                    <span className="fw-semibold text-dark">₹{val.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                                </div>
                                                <div className="d-flex justify-content-between small">
                                                    <span className="text-muted">Credit:</span>
                                                    <span className="fw-semibold text-dark">₹{val.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Table */}
            <div className="card shadow-sm border-0 overflow-hidden tally-theme">
                {/* Column Header */}
                <div className="card-header bg-light py-3 border-bottom no-print">
                    <div className="row fw-bold text-uppercase x-small text-muted align-items-center">
                        <div className="col-5">Particulars</div>
                        <div className="col-2 text-end">Debit (Receivable)</div>
                        <div className="col-2 text-end">Credit (Payable)</div>
                        <div className="col-3 text-end">Actions</div>
                    </div>
                </div>

                {/* Top Grand Total */}
                <div className="bg-light text-dark py-2 px-3 no-print border-bottom">
                    <div className="row fw-bold">
                        <div className="col-5 text-uppercase">Grand Total</div>
                        <div className="col-2 text-end text-dark">₹{totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                        <div className="col-2 text-end text-dark">₹{totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                        <div className="col-3"></div>
                    </div>
                </div>

                {/* Print Header */}
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
                            <div className="text-center py-5 text-muted italic">No accounts found.</div>
                        ) : (
                            filteredEntities.map((ent, idx) => (
                                <div key={ent.id} className={`tally-row border-bottom py-2 px-3 ${idx % 2 === 0 ? '' : 'bg-light bg-opacity-10'}`}>
                                    <div className="row align-items-center">
                                        {/* Name + Type */}
                                        <div className="col-5">
                                            <Link to={`/accounts/entity-ledger?id=${ent.id}&name=${encodeURIComponent(ent.name)}`}
                                                className="fw-bold text-dark text-decoration-none d-block">
                                                {ent.name}
                                            </Link>
                                            <div className="xx-small text-muted text-uppercase">{ent.type}</div>
                                        </div>

                                        {/* Debit */}
                                        <div className="col-2 text-end fw-bold">
                                            {ent.net_balance > 0
                                                ? `₹${ent.net_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                                                : '—'}
                                        </div>

                                        {/* Credit */}
                                        <div className="col-2 text-end fw-bold text-dark">
                                            {ent.net_balance < 0
                                                ? `₹${Math.abs(ent.net_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                                                : '—'}
                                        </div>

                                        {/* CRUD Buttons */}
                                        <div className="col-3 text-end no-print d-flex gap-1 justify-content-end flex-wrap">
                                            <button
                                                className="btn btn-outline-secondary btn-xs rounded-pill px-2 py-0 d-inline-flex align-items-center gap-1 shadow-sm"
                                                style={{ fontSize: '0.7rem' }}
                                                title="Edit account"
                                                onClick={() => openEdit(ent)}
                                            >
                                                <i className="bi bi-pencil"></i> Edit
                                            </button>
                                            {isOwner() && (<>
                                                <button
                                                    className="btn btn-outline-secondary btn-xs rounded-pill px-2 py-0 d-inline-flex align-items-center gap-1 shadow-sm"
                                                    style={{ fontSize: '0.7rem' }}
                                                    title="Delete account only (keeps transaction history)"
                                                    disabled={deleting === ent.id}
                                                    onClick={() => handleDelete(ent)}
                                                >
                                                    {deleting === ent.id
                                                        ? <span className="spinner-border spinner-border-sm"></span>
                                                        : <><i className="bi bi-trash"></i> Del</>}
                                                </button>
                                                <button
                                                    className="btn btn-outline-danger btn-xs rounded-pill px-2 py-0 d-inline-flex align-items-center gap-1 shadow-sm"
                                                    style={{ fontSize: '0.7rem' }}
                                                    title="Delete account AND all transaction history (irreversible)"
                                                    disabled={deletingHistory === ent.id}
                                                    onClick={() => handleDeleteWithHistory(ent)}
                                                >
                                                    {deletingHistory === ent.id
                                                        ? <span className="spinner-border spinner-border-sm"></span>
                                                        : <><i className="bi bi-trash-fill"></i> Del+History</>}
                                                </button>
                                            </>)}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Footer Totals */}
                <div className="card-footer bg-light text-dark py-3 border-0">
                    <div className="row fw-bold">
                        <div className="col-5 text-uppercase">Grand Total</div>
                        <div className="col-2 text-end text-dark">₹{totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                        <div className="col-2 text-end text-dark">₹{totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                        <div className="col-3"></div>
                    </div>
                </div>
            </div>

            {/* ── Edit Modal ── */}
            {editEntity && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1055 }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow-lg rounded-4">
                            <div className="modal-header border-0 bg-primary text-white rounded-top-4 px-4 pt-4 pb-3">
                                <div>
                                    <h5 className="modal-title fw-bold mb-0">✏️ Edit Account</h5>
                                    <div className="small opacity-75">{editEntity.name}</div>
                                </div>
                                <button className="btn-close btn-close-white" onClick={() => setEditEntity(null)} disabled={saving}></button>
                            </div>

                            <form onSubmit={handleEditSave}>
                                <div className="modal-body px-4 py-3">
                                    <div className="mb-3">
                                        <label className="form-label fw-bold x-small text-uppercase text-muted">Account Name</label>
                                        <input
                                            className="form-control"
                                            value={editForm.name}
                                            onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                                            required
                                        />
                                    </div>

                                    <div className="row g-3 mb-3">
                                        <div className="col-6">
                                            <label className="form-label fw-bold x-small text-uppercase text-muted">Account Type</label>
                                            <select
                                                className="form-select"
                                                value={editForm.type}
                                                onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))}
                                            >
                                                {ENTITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                        </div>
                                        <div className="col-6">
                                            <label className="form-label fw-bold x-small text-uppercase text-muted">Balance Direction</label>
                                            <select
                                                className="form-select"
                                                value={editForm.balance_type}
                                                onChange={e => setEditForm(f => ({ ...f, balance_type: e.target.value }))}
                                            >
                                                {BALANCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="row g-3 mb-3">
                                        <div className="col-6">
                                            <label className="form-label fw-bold x-small text-uppercase text-muted">Opening Balance (₹)</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                className="form-control"
                                                value={editForm.opening_balance}
                                                onChange={e => setEditForm(f => ({ ...f, opening_balance: e.target.value }))}
                                            />
                                        </div>
                                        <div className="col-6">
                                            <label className="form-label fw-bold x-small text-uppercase text-muted">Phone</label>
                                            <input
                                                className="form-control"
                                                value={editForm.phone}
                                                onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="modal-footer border-0 px-4 pb-4 pt-2 gap-2">
                                    <button type="button" className="btn btn-light fw-bold px-4" onClick={() => setEditEntity(null)} disabled={saving}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-primary fw-bold px-4" disabled={saving}>
                                        {saving ? <><span className="spinner-border spinner-border-sm me-2"></span>Saving...</> : '💾 Save Changes'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .tally-theme { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
                .tally-row:hover { background-color: #f1f5f9; }
                .x-small  { font-size: 0.75rem; }
                .xx-small { font-size: 0.65rem; }
                .btn-xs   { font-size: 0.7rem; padding: 2px 6px; }
                @media print {
                    .no-print  { display: none !important; }
                    .card      { border: none !important; box-shadow: none !important; }
                    .card-footer { background-color: #000 !important; color: #fff !important; }
                    body       { background: #fff !important; }
                }
            `}</style>
        </div>
    );
}
