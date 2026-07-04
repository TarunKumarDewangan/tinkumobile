import { useState, useEffect, Fragment } from 'react';
import pinGate from '../../utils/pinGate';
import api from '../../api/axios';
import { toast } from 'react-toastify';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const ENTITY_TYPES = ['CUSTOMER', 'SHOP_CUSTOMER', 'SUPPLIER'];
const BALANCE_TYPES = ['RECEIVABLE', 'PAYABLE'];

export default function TradeGroupSummary() {
    const { isOwner } = useAuth();
    const navigate = useNavigate();
    const [entities, setEntities] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('ALL');
    const [showOpeningStock, setShowOpeningStock] = useState(false);
    const [hideZeroBalances, setHideZeroBalances] = useState(false);
    const [showCategoryTotals, setShowCategoryTotals] = useState(false);

    // Edit Modal state
    const [editEntity, setEditEntity] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [saving, setSaving] = useState(false);

    // Delete state
    const [deleting, setDeleting] = useState(null);
    const [deletingHistory, setDeletingHistory] = useState(null);

    const loadData = async (query = '', type = 'ALL') => {
        setLoading(true);
        try {
            const params = {};
            if (query) params.q = query;
            
            // If specific type filter chosen, only fetch that type, otherwise fetch all trade types
            if (type !== 'ALL') {
                params.type = type;
            }

            const { data } = await api.get('/ledgers/entity-balances', { params });
            
            // Filter to include only Customer, Shop Customer, and Supplier types
            const filtered = data.filter(e => ENTITY_TYPES.includes(e.type));
            setEntities(filtered);
        } catch {
            toast.error('Failed to load Sales & Purchase summary');
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
        
        // Filter out entities with no mobile transactions
        if (!ent.has_mobile) return false;

        // Get the relevant trade balance for zero-balance checks
        const bal = (ent.type === 'CUSTOMER' || ent.type === 'SHOP_CUSTOMER')
            ? parseFloat(ent.sales_balance || 0)
            : parseFloat(ent.purchase_balance || 0);

        if (hideZeroBalances && Math.abs(bal) < 0.01) return false;
        return true;
    }).sort((a, b) => {
        if (a.name === 'OPENING STOCK') return -1;
        if (b.name === 'OPENING STOCK') return 1;
        return 0;
    });

    // Group and sort logic for category totals inside table
    const categoryGroups = filteredEntities.reduce((acc, ent) => {
        const type = ent.type || 'OTHER';
        
        const adjustedBalance = (type === 'CUSTOMER' || type === 'SHOP_CUSTOMER')
            ? parseFloat(ent.sales_balance || 0)
            : parseFloat(ent.purchase_balance || 0);

        // If adjusted balance is zero, do not count this entity under this category summary
        if (Math.abs(adjustedBalance) < 0.01) {
            return acc;
        }

        if (!acc[type]) {
            acc[type] = {
                name: type,
                entities: [],
                totalDebit: 0,
                totalCredit: 0
            };
        }
        acc[type].entities.push(ent);

        if (adjustedBalance > 0) {
            acc[type].totalDebit += adjustedBalance;
        } else if (adjustedBalance < 0) {
            acc[type].totalCredit += Math.abs(adjustedBalance);
        }
        return acc;
    }, {});

    const totalDebit = showCategoryTotals
        ? Object.values(categoryGroups).reduce((s, g) => s + g.totalDebit, 0)
        : filteredEntities.reduce((s, e) => {
            const bal = (e.type === 'CUSTOMER' || e.type === 'SHOP_CUSTOMER')
                ? parseFloat(e.sales_balance || 0)
                : parseFloat(e.purchase_balance || 0);
            return s + (bal > 0 ? bal : 0);
          }, 0);

    const totalCredit = showCategoryTotals
        ? Object.values(categoryGroups).reduce((s, g) => s + g.totalCredit, 0)
        : filteredEntities.reduce((s, e) => {
            const bal = (e.type === 'CUSTOMER' || e.type === 'SHOP_CUSTOMER')
                ? parseFloat(e.sales_balance || 0)
                : parseFloat(e.purchase_balance || 0);
            return s + (bal < 0 ? Math.abs(bal) : 0);
          }, 0);

    const sortedCategoryNames = Object.keys(categoryGroups).sort((a, b) => {
        const idxA = ENTITY_TYPES.indexOf(a);
        const idxB = ENTITY_TYPES.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b);
    });

    const renderTradeTypeBadges = (e) => {
        const sb = e.sub_balances || {};
        const badges = [];

        // Only show mobile sales and purchases
        const hasMobileSale = Math.abs(sb.NEW_MOBILE_SALE || 0) > 0.01 || Math.abs(sb.OLD_MOBILE_SALE || 0) > 0.01;
        const hasMobilePurchase = Math.abs(sb.NEW_MOBILE_PURCHASE || 0) > 0.01 || Math.abs(sb.OLD_MOBILE_PURCHASE || 0) > 0.01;

        if (hasMobileSale) {
            badges.push({ label: 'SALES', bg: 'success' });
        }
        if (hasMobilePurchase) {
            badges.push({ label: 'PURCHASE', bg: 'primary' });
        }

        // Fallback if no badges are generated but we have overall balances
        if (badges.length === 0) {
            if (e.type === 'CUSTOMER' || e.type === 'SHOP_CUSTOMER') {
                badges.push({ label: 'SALES', bg: 'success' });
            } else {
                badges.push({ label: 'PURCHASE', bg: 'primary' });
            }
        }

        return (
            <div className="d-flex flex-wrap gap-1">
                {badges.map((b, idx) => (
                    <span key={idx} className={`badge bg-${b.bg} rounded-pill x-small px-2 text-uppercase fw-semibold`}>
                        {b.label}
                    </span>
                ))}
            </div>
        );
    };

    const renderCategoryTradeTypeBadges = (catName) => {
        if (catName === 'CUSTOMER' || catName === 'SHOP_CUSTOMER') {
            return (
                <div className="d-flex flex-wrap gap-1">
                    <span className="badge bg-success rounded-pill x-small px-2 text-uppercase fw-semibold">SALES</span>
                </div>
            );
        } else {
            return (
                <div className="d-flex flex-wrap gap-1">
                    <span className="badge bg-primary rounded-pill x-small px-2 text-uppercase fw-semibold">PURCHASE</span>
                </div>
            );
        }
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

    /* ── Delete ── */
    const handleDelete = async (ent) => {
        if (!await pinGate.confirm()) return;
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

    const handleDeleteWithHistory = async (ent) => {
        if (!await pinGate.confirm()) return;

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
                <div>
                    <h4 className="fw-bold mb-1">⚖️ Sales & Purchase Account Summary</h4>
                    <p className="text-muted small mb-0">Filtered balances for regular sales, shop customers, and suppliers/distributors.</p>
                </div>
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

            {/* Toggle Filters Row */}
            <div className="d-flex flex-wrap gap-2 mb-3 bg-light p-2 rounded-3 border no-print">
              {[
                { id: 'ALL', label: '📋 All Trade Groups', color: 'dark' },
                { id: 'CUSTOMER', label: '👤 Regular Customers (Sales)', color: 'primary' },
                { id: 'SHOP_CUSTOMER', label: '👥 Shop Customers (Sales)', color: 'info' },
                { id: 'SUPPLIER', label: '🏭 Suppliers / Distributors (Purchase)', color: 'success' },
              ].map(t => {
                const isActive = typeFilter === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={`btn btn-sm rounded-pill px-3 fw-bold transition-all ${isActive ? `btn-${t.color}` : 'btn-outline-secondary'}`}
                    onClick={() => {
                        if (t.id === 'ALL') {
                            setTypeFilter('ALL');
                        } else {
                            navigate(`/accounts/group-details?type=${t.id}`);
                        }
                    }}
                    style={{
                      fontSize: '0.78rem',
                      borderWidth: '1.5px',
                      transform: isActive ? 'scale(1.03)' : 'scale(1)',
                      boxShadow: isActive ? '0 4px 10px rgba(0,0,0,0.1)' : 'none'
                    }}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* Filters */}
            <div className="card shadow-sm border-0 mb-4 no-print">
                <div className="card-body p-3">
                    <div className="row g-3">
                        <div className="col-md-7">
                            <input
                                type="text"
                                className="form-control form-control-sm"
                                placeholder="Search by name or mobile..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
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
                    <h5 className="text-muted">Sales & Purchase Account Summary</h5>
                    <div className="small">Generated on: {new Date().toLocaleString()}</div>
                    <hr />
                </div>

                <div className="card-body p-0">
                    <div className="table-responsive">
                        <table className="table custom-tally-table mb-0">
                            <thead>
                                <tr className="bg-light text-uppercase x-small text-muted fw-bold">
                                    <th style={{ width: '35%' }} className="ps-3">Particulars</th>
                                    <th style={{ width: '15%' }}>Trade Type</th>
                                    <th className="text-end pe-3" style={{ width: '15%' }}>Debit (Receivable)</th>
                                    <th className="text-end pe-3" style={{ width: '15%' }}>Credit (Payable)</th>
                                    <th className="text-end pe-3 no-print" style={{ width: '20%' }}>Actions</th>
                                </tr>
                                {/* Top Grand Total */}
                                <tr className="bg-light text-dark fw-bold no-print" style={{ borderBottom: '2px solid #cbd5e1' }}>
                                    <td className="text-uppercase py-2 ps-3">Grand Total</td>
                                    <td></td>
                                    <td className="text-end py-2 pe-3">₹{totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                    <td className="text-end py-2 pe-3">₹{totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                    <td className="no-print py-2"></td>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan="5" className="text-center py-5">
                                            <div className="spinner-border text-primary opacity-50"></div>
                                        </td>
                                    </tr>
                                ) : filteredEntities.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="text-center py-5 text-muted italic">
                                            No accounts found.
                                        </td>
                                    </tr>
                                ) : showCategoryTotals ? (
                                    sortedCategoryNames.map(catName => (
                                        <tr 
                                            key={`cat-group-${catName}`}
                                            className="category-row"
                                            onClick={() => navigate(`/accounts/group-details?type=${catName}`)}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <td className="ps-3 py-2">
                                                <span className="d-flex align-items-center gap-2">
                                                    <i className="bi bi-chevron-right text-muted" style={{ fontSize: '0.8rem' }}></i>
                                                    <span className="fw-bold">
                                                        {catName === 'SUPPLIER' ? 'SUPPLIER / DISTRIBUTOR' : catName.replace(/_/g, ' ')}
                                                    </span>
                                                    <span className="badge bg-secondary text-white rounded-pill font-normal" style={{ fontSize: '0.7rem' }}>
                                                        {categoryGroups[catName].entities.length}
                                                    </span>
                                                </span>
                                            </td>
                                            <td>
                                                {renderCategoryTradeTypeBadges(catName)}
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
                                            <td className="no-print py-2 text-end pe-3">
                                                <Link 
                                                    to={`/accounts/group-details?type=${catName}`}
                                                    className="btn btn-outline-primary btn-xs rounded-pill px-3 fw-bold"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    👁️ View Group
                                                </Link>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    filteredEntities.map((ent) => (
                                        <tr key={ent.id} className="tally-row">
                                            <td className="ps-3 py-2">
                                                <Link to={`/accounts/entity-ledger?id=${ent.id}&name=${encodeURIComponent(ent.name)}`}
                                                    className="fw-bold text-dark text-decoration-none d-block">
                                                    {ent.name}
                                                </Link>
                                                <div className="xx-small text-muted text-uppercase">
                                                    {ent.type === 'SUPPLIER' ? 'SUPPLIER / DISTRIBUTOR' : ent.type}
                                                </div>
                                            </td>
                                            <td>
                                                {renderTradeTypeBadges(ent)}
                                            </td>
                                            <td className="text-end fw-bold py-2 pe-3">
                                                {(() => {
                                                    const isCustomer = ent.type === 'CUSTOMER' || ent.type === 'SHOP_CUSTOMER';
                                                    const bal = isCustomer ? parseFloat(ent.sales_balance || 0) : parseFloat(ent.purchase_balance || 0);
                                                    return bal > 0 ? `₹${bal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—';
                                                })()}
                                            </td>
                                            <td className="text-end fw-bold text-dark py-2 pe-3">
                                                {(() => {
                                                    const isCustomer = ent.type === 'CUSTOMER' || ent.type === 'SHOP_CUSTOMER';
                                                    const bal = isCustomer ? parseFloat(ent.sales_balance || 0) : parseFloat(ent.purchase_balance || 0);
                                                    return bal < 0 ? `₹${Math.abs(bal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—';
                                                })()}
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
                                                    {isOwner() && (
                                                        <>
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
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            <tfoot>
                                <tr className="fw-bold bg-light">
                                    <td className="text-uppercase ps-3 py-2">Grand Total</td>
                                    <td></td>
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

                                    <div className="mb-3">
                                        <label className="form-label fw-bold x-small text-uppercase text-muted">Phone Number</label>
                                        <input
                                            className="form-control"
                                            value={editForm.phone}
                                            onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                                        />
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label fw-bold x-small text-uppercase text-muted">Opening Balance (₹)</label>
                                        <input
                                            type="number"
                                            className="form-control"
                                            value={editForm.opening_balance}
                                            onChange={e => setEditForm(f => ({ ...f, opening_balance: e.target.value }))}
                                        />
                                    </div>
                                </div>

                                <div className="modal-footer border-0 px-4 pb-4 pt-0">
                                    <button type="button" className="btn btn-light rounded-pill px-4" onClick={() => setEditEntity(null)} disabled={saving}>Cancel</button>
                                    <button type="submit" className="btn btn-primary rounded-pill px-4" disabled={saving}>
                                        {saving ? <span className="spinner-border spinner-border-sm me-2"></span> : 'Save Changes'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
