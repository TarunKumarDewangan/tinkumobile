import { useState, useEffect, Fragment } from 'react';
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
    const [expandedCategories, setExpandedCategories] = useState({});

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

    // Group and sort logic for category totals inside table
    const categoryGroups = filteredEntities.reduce((acc, ent) => {
        const type = ent.type || 'OTHER';
        if (!acc[type]) {
            acc[type] = {
                name: type,
                entities: [],
                totalDebit: 0,
                totalCredit: 0
            };
        }
        acc[type].entities.push(ent);
        if (ent.net_balance > 0) {
            acc[type].totalDebit += ent.net_balance;
        } else if (ent.net_balance < 0) {
            acc[type].totalCredit += Math.abs(ent.net_balance);
        }
        return acc;
    }, {});

    const sortedCategoryNames = Object.keys(categoryGroups).sort((a, b) => {
        const idxA = ENTITY_TYPES.indexOf(a);
        const idxB = ENTITY_TYPES.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b);
    });

    const toggleCategory = (cat) => {
        setExpandedCategories(prev => ({
            ...prev,
            [cat]: !prev[cat]
        }));
    };

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


            {/* Table */}
            <div className="card shadow-sm border-0 overflow-hidden tally-theme">
                {/* Print Header */}
                <div className="d-none d-print-block text-center mb-4 mt-3">
                    <h2 className="fw-bold mb-1">Tinku Mobiles</h2>
                    <h5 className="text-muted">Group Summary Report</h5>
                    <div className="small">Generated on: {new Date().toLocaleString()}</div>
                    <hr />
                </div>

                <div className="card-body p-0">
                    <div className="table-responsive">
                        <table className="table custom-tally-table mb-0">
                            <thead>
                                <tr className="bg-light text-uppercase x-small text-muted fw-bold">
                                    <th style={{ width: '40%' }} className="ps-3">Particulars</th>
                                    <th className="text-end pe-3" style={{ width: '20%' }}>Debit (Receivable)</th>
                                    <th className="text-end pe-3" style={{ width: '20%' }}>Credit (Payable)</th>
                                    <th className="text-end pe-3 no-print" style={{ width: '20%' }}>Actions</th>
                                </tr>
                                {/* Top Grand Total */}
                                <tr className="bg-light text-dark fw-bold no-print" style={{ borderBottom: '2px solid #cbd5e1' }}>
                                    <td className="text-uppercase py-2 ps-3">Grand Total</td>
                                    <td className="text-end py-2 pe-3">₹{totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                    <td className="text-end py-2 pe-3">₹{totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                    <td className="no-print py-2"></td>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan="4" className="text-center py-5">
                                            <div className="spinner-border text-primary opacity-50"></div>
                                        </td>
                                    </tr>
                                ) : filteredEntities.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" className="text-center py-5 text-muted italic">
                                            No accounts found.
                                        </td>
                                    </tr>
                                ) : showCategoryTotals ? (
                                    sortedCategoryNames.map(catName => (
                                        <Fragment key={`cat-group-${catName}`}>
                                            <tr 
                                                className="category-row"
                                                onClick={() => toggleCategory(catName)}
                                            >
                                                <td className="ps-3 py-2">
                                                    <span className="d-flex align-items-center gap-2">
                                                        <i className={`bi ${expandedCategories[catName] ? 'bi-chevron-down' : 'bi-chevron-right'} text-muted`}></i>
                                                        <span className="fw-bold">{catName.replace(/_/g, ' ')}</span>
                                                        <span className="badge bg-secondary text-white rounded-pill font-normal" style={{ fontSize: '0.7rem' }}>
                                                            {categoryGroups[catName].entities.length}
                                                        </span>
                                                    </span>
                                                </td>
                                                <td className="text-end fw-bold py-2 pe-3">
                                                    {categoryGroups[catName].totalDebit > 0
                                                        ? `₹${categoryGroups[catName].totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                                                        : '—'}
                                                </td>
                                                <td className="text-end fw-bold py-2 pe-3">
                                                    {categoryGroups[catName].totalCredit > 0
                                                        ? `₹${categoryGroups[catName].totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                                                        : '—'}
                                                </td>
                                                <td className="no-print py-2"></td>
                                            </tr>
                                            {expandedCategories[catName] && categoryGroups[catName].entities.map((ent) => (
                                                <tr key={ent.id} className="tally-row">
                                                    <td className="ps-5 py-2">
                                                        <Link to={`/accounts/entity-ledger?id=${ent.id}&name=${encodeURIComponent(ent.name)}`}
                                                            className="fw-bold text-dark text-decoration-none d-block">
                                                            {ent.name}
                                                        </Link>
                                                        <div className="xx-small text-muted text-uppercase">{ent.type}</div>
                                                    </td>
                                                    <td className="text-end fw-bold py-2 pe-3">
                                                        {ent.net_balance > 0
                                                            ? `₹${ent.net_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                                                            : '—'}
                                                    </td>
                                                    <td className="text-end fw-bold text-dark py-2 pe-3">
                                                        {ent.net_balance < 0
                                                            ? `₹${Math.abs(ent.net_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                                                            : '—'}
                                                    </td>
                                                    <td className="text-end no-print py-2 pe-3">
                                                        <div className="d-flex gap-1 justify-content-end flex-wrap">
                                                            <button
                                                                className="btn btn-outline-secondary btn-xs rounded-pill px-2 py-0 d-inline-flex align-items-center gap-1 shadow-sm"
                                                                style={{ fontSize: '0.7rem' }}
                                                                title="Edit account"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    openEdit(ent);
                                                                }}
                                                            >
                                                                <i className="bi bi-pencil"></i> Edit
                                                            </button>
                                                            {isOwner() && (<>
                                                                <button
                                                                    className="btn btn-outline-secondary btn-xs rounded-pill px-2 py-0 d-inline-flex align-items-center gap-1 shadow-sm"
                                                                    style={{ fontSize: '0.7rem' }}
                                                                    title="Delete account only (keeps transaction history)"
                                                                    disabled={deleting === ent.id}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleDelete(ent);
                                                                    }}
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
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleDeleteWithHistory(ent);
                                                                    }}
                                                                >
                                                                    {deletingHistory === ent.id
                                                                        ? <span className="spinner-border spinner-border-sm"></span>
                                                                        : <><i className="bi bi-trash-fill"></i> Del+History</>}
                                                                </button>
                                                            </>)}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </Fragment>
                                    ))
                                ) : (
                                    filteredEntities.map((ent) => (
                                        <tr key={ent.id} className="tally-row">
                                            <td className="ps-3 py-2">
                                                <Link to={`/accounts/entity-ledger?id=${ent.id}&name=${encodeURIComponent(ent.name)}`}
                                                    className="fw-bold text-dark text-decoration-none d-block">
                                                    {ent.name}
                                                </Link>
                                                <div className="xx-small text-muted text-uppercase">{ent.type}</div>
                                            </td>
                                            <td className="text-end fw-bold py-2 pe-3">
                                                {ent.net_balance > 0
                                                    ? `₹${ent.net_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                                                    : '—'}
                                            </td>
                                            <td className="text-end fw-bold text-dark py-2 pe-3">
                                                {ent.net_balance < 0
                                                    ? `₹${Math.abs(ent.net_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                                                    : '—'}
                                            </td>
                                            <td className="text-end no-print py-2 pe-3">
                                                <div className="d-flex gap-1 justify-content-end flex-wrap">
                                                    <button
                                                        className="btn btn-outline-secondary btn-xs rounded-pill px-2 py-0 d-inline-flex align-items-center gap-1 shadow-sm"
                                                        style={{ fontSize: '0.7rem' }}
                                                        title="Edit account"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            openEdit(ent);
                                                        }}
                                                    >
                                                        <i className="bi bi-pencil"></i> Edit
                                                    </button>
                                                    {isOwner() && (<>
                                                        <button
                                                            className="btn btn-outline-secondary btn-xs rounded-pill px-2 py-0 d-inline-flex align-items-center gap-1 shadow-sm"
                                                            style={{ fontSize: '0.7rem' }}
                                                            title="Delete account only (keeps transaction history)"
                                                            disabled={deleting === ent.id}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDelete(ent);
                                                            }}
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
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteWithHistory(ent);
                                                            }}
                                                        >
                                                            {deletingHistory === ent.id
                                                                ? <span className="spinner-border spinner-border-sm"></span>
                                                                : <><i className="bi bi-trash-fill"></i> Del+History</>}
                                                        </button>
                                                    </>)}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            <tfoot>
                                <tr className="fw-bold bg-light">
                                    <td className="text-uppercase ps-3 py-2">Grand Total</td>
                                    <td className="text-end py-2 pe-3">₹{totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                    <td className="text-end py-2 pe-3">₹{totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                    <td className="no-print py-2"></td>
                                </tr>
                            </tfoot>
                        </table>
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
                .x-small  { font-size: 0.75rem; }
                .xx-small { font-size: 0.65rem; }
                .btn-xs   { font-size: 0.7rem; padding: 2px 6px; }

                .custom-tally-table {
                    width: 100%;
                    border-collapse: collapse !important;
                    border: 1px solid #cbd5e1 !important;
                }
                .custom-tally-table thead th {
                    position: sticky;
                    top: 0;
                    z-index: 10;
                    background: #f8fafc;
                    color: #475569;
                    font-size: 0.72rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    padding: 0.65rem 0.5rem;
                    border-bottom: 2px solid #cbd5e1 !important;
                    border-right: 1px solid #cbd5e1 !important;
                }
                .custom-tally-table thead th:last-child {
                    border-right: none !important;
                }
                .custom-tally-table tbody tr td {
                    padding: 0.6rem 0.5rem;
                    border-bottom: 1px solid #cbd5e1 !important;
                    border-right: 1px solid #cbd5e1 !important;
                    vertical-align: middle;
                }
                .custom-tally-table tbody tr td:last-child {
                    border-right: none !important;
                }
                .custom-tally-table tfoot tr td {
                    padding: 0.65rem 0.5rem;
                    background: #f8fafc;
                    border-bottom: 2px solid #cbd5e1 !important;
                    border-top: 2px solid #cbd5e1 !important;
                    border-right: 1px solid #cbd5e1 !important;
                    font-weight: bold;
                }
                .custom-tally-table tfoot tr td:last-child {
                    border-right: none !important;
                }
                .custom-tally-table tbody tr.tally-row:hover {
                    background-color: #f1f5f9 !important;
                }
                .category-row {
                    background-color: #f8fafc !important;
                    cursor: pointer;
                    user-select: none;
                }
                .category-row:hover {
                    background-color: #e2e8f0 !important;
                }

                @media print {
                    .no-print  { display: none !important; }
                    .card      { border: none !important; box-shadow: none !important; }
                    body       { background: #fff !important; }
                    .custom-tally-table { border: 1px solid #000 !important; }
                    .custom-tally-table th, .custom-tally-table td { border: 1px solid #000 !important; }
                }
            `}</style>
        </div>
    );
}
