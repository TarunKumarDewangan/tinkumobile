import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import pinGate from '../../utils/pinGate';
import api from '../../api/axios';
import { toast } from 'react-toastify';
import { formatDate } from '../../utils/formatters';
import { useAuth } from '../../contexts/AuthContext';

export default function GroupDetails() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const type = searchParams.get('type') || 'CUSTOMER';
  const { isOwner } = useAuth();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleting, setDeleting] = useState(null);
  const [deletingHistory, setDeletingHistory] = useState(null);
  // Simple view: show only Name / Contact / Net Balance / Actions, hiding the
  // breakdown columns (Trade Type, Opening, Sales/Repairs/Works Bal). On by default.
  const [simpleView, setSimpleView] = useState(true);

  const handleDelete = async (ent) => {
    if (!await pinGate.confirm()) return;
    setDeleting(ent.id);
    try {
      await api.delete(`/entities/${ent.id}`);
      toast.success(`"${ent.name}" deleted`);
      setData(prev => prev.filter(e => e.id !== ent.id));
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
      const { data: res } = await api.delete(`/entities/${ent.id}/with-history`);
      toast.success(res.message || `"${ent.name}" and its history deleted`);
      setData(prev => prev.filter(e => e.id !== ent.id));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete with history failed');
    } finally {
      setDeletingHistory(null);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      if (type === 'REPAIR') {
        const { data: res } = await api.get('/repairs', { params: { per_page: 10000 } });
        const repairsArray = Array.isArray(res) ? res : (res.data || []);
        // Filter to repairs with outstanding balance
        const outstanding = repairsArray.filter(r => {
          const quoted = parseFloat(r.quoted_amount || 0);
          const advance = parseFloat(r.advance_amount || 0);
          const balanceReceived = parseFloat(r.balance_amount_received || 0);
          const balance = quoted - (advance + balanceReceived);
          return balance > 0.01;
        });
        setData(outstanding);
      } else {
        const params = { type, _t: Date.now() };
        const { data: entities } = await api.get('/ledgers/entity-balances', { params });
        console.log('Entities from API:', entities);
        setData(entities);
      }
    } catch (e) {
      toast.error('Failed to load details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [type]);

  const filteredData = useMemo(() => {
    let result = data;
    if (type === 'CUSTOMER' || type === 'SHOP_CUSTOMER') {
      // Use the backend's real net_balance (sales + purchases + repairs +
      // works, matching the Entity Ledger exactly) — not just sales+works,
      // which silently dropped any purchase activity recorded against a
      // customer/shop-customer (e.g. buying stock back from a dealer).
      result = data.filter(e => Math.abs(parseFloat(e.net_balance || 0)) >= 0.01);
    }

    if (!searchTerm) return result;
    const lower = searchTerm.toLowerCase();
    if (type === 'REPAIR') {
      return result.filter(r => 
        (r.customer_name && r.customer_name.toLowerCase().includes(lower)) ||
        (r.customer_phone && r.customer_phone.includes(lower)) ||
        (r.device_model && r.device_model.toLowerCase().includes(lower)) ||
        String(r.id).includes(lower)
      );
    } else {
      return result.filter(e => 
        (e.name && e.name.toLowerCase().includes(lower)) ||
        (e.phone && e.phone.includes(lower))
      );
    }
  }, [data, searchTerm, type]);

  // Calculations for Totals
  const totals = useMemo(() => {
    if (type === 'REPAIR') {
      return filteredData.reduce((acc, r) => {
        const quoted = parseFloat(r.quoted_amount || 0);
        const advance = parseFloat(r.advance_amount || 0);
        const received = parseFloat(r.balance_amount_received || 0);
        const balance = quoted - (advance + received);
        acc.debit += balance; // Outstanding balance is a receivable (debit)
        return acc;
      }, { debit: 0, credit: 0 });
    } else {
      return filteredData.reduce((acc, e) => {
        const bal = parseFloat(e.net_balance || 0);

        if (bal > 0) acc.debit += bal;
        else if (bal < 0) acc.credit += Math.abs(bal);
        
        acc.opening += parseFloat(e.opening_balance || 0) * (e.balance_type === 'RECEIVABLE' ? 1 : -1);
        acc.sales += parseFloat(e.sales_balance || 0);
        acc.repairs += parseFloat(e.repairs_balance || 0);
        acc.works += parseFloat(e.works_balance || 0);
        acc.net += bal;
        return acc;
      }, { debit: 0, credit: 0, opening: 0, sales: 0, repairs: 0, works: 0, net: 0 });
    }
  }, [filteredData, type]);

  const getPageTitle = () => {
    switch (type) {
      case 'CUSTOMER': return 'Regular Customers';
      case 'SHOP_CUSTOMER': return 'Shop Customers';
      case 'SUPPLIER': return 'Suppliers';
      case 'AIRTEL_RETAILER': return 'Airtel Retailers';
      case 'RETAILER': return 'Airtel Retailers';
      case 'SHOP': return 'Shops';
      case 'STAFF': return 'Staff Details';
      case 'FINANCER': return 'Finance Companies';
      case 'REPAIR': return 'Outstanding Repairs';
      default: return `${type.replace(/_/g, ' ')} Accounts`;
    }
  };

  const renderTradeTypeBadges = (e) => {
    const sb = e.sub_balances || {};
    const badges = [];

    // 1. Check Recharge
    if (Math.abs(sb.RECHARGE_SALE || 0) > 0.01) {
      badges.push({ label: 'RECHARGE SALES', bg: 'success' });
    }
    if (Math.abs(sb.RECHARGE_PURCHASE || 0) > 0.01) {
      badges.push({ label: 'RECHARGE PURCHASE', bg: 'primary' });
    }

    // 2. Check Accessory
    if (Math.abs(sb.ACCESSORY_SALE || 0) > 0.01) {
      badges.push({ label: 'ACCESSORY SALES', bg: 'success' });
    }
    if (Math.abs(sb.ACCESSORY_PURCHASE || 0) > 0.01) {
      badges.push({ label: 'ACCESSORY PURCHASE', bg: 'primary' });
    }

    // 3. Check SIM
    if (Math.abs(sb.SIM_SALE || 0) > 0.01) {
      badges.push({ label: 'SIM SALES', bg: 'success' });
    }
    if (Math.abs(sb.SIM_PURCHASE || 0) > 0.01) {
      badges.push({ label: 'SIM PURCHASE', bg: 'primary' });
    }

    // 4. Check Repair
    if (Math.abs(sb.REPAIR || 0) > 0.01) {
      badges.push({ label: 'REPAIR', bg: 'warning text-dark' });
    }

    // 5. Check New / Old Mobile Sales / Purchases
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
      const salesBal = parseFloat(e.sales_balance || 0);
      const purchaseBal = parseFloat(e.purchase_balance || 0);
      const netBal = parseFloat(e.net_balance || 0);
      const isSupplier = e.type === 'SUPPLIER' || e.type === 'DISTRIBUTOR';

      if (salesBal !== 0) {
        badges.push({ label: 'SALES', bg: 'success' });
      } else if (purchaseBal !== 0) {
        badges.push({ label: 'PURCHASE', bg: 'primary' });
      } else if (isSupplier) {
        badges.push({ label: 'PURCHASE', bg: 'primary' });
      } else if (e.type === 'CUSTOMER' || e.type === 'SHOP_CUSTOMER') {
        badges.push({ label: 'SALES', bg: 'success' });
      } else if (netBal !== 0) {
        badges.push({ label: 'WORKS', bg: 'secondary' });
      } else {
        badges.push({ label: 'NONE', bg: 'light text-dark' });
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

  return (
    <div className="container-fluid py-4 tally-theme">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <button className="btn btn-outline-secondary btn-sm rounded-pill mb-2 px-3" onClick={() => navigate('/accounts/group-summary')}>
             ← Back to Summary
          </button>
          <h2 className="h4 mb-0 fw-bold text-primary text-uppercase">{getPageTitle()} Details</h2>
          <p className="text-muted small mb-0">Detailed view and management for {getPageTitle()}</p>
        </div>
        <div className="d-flex gap-2 align-items-center">
          {type !== 'REPAIR' && (
            <div className="form-check form-switch d-flex align-items-center gap-2 mb-0 bg-white border rounded-pill px-3 py-1">
              <input
                className="form-check-input mt-0"
                type="checkbox"
                role="switch"
                id="simpleViewToggle"
                checked={simpleView}
                onChange={e => setSimpleView(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <label className="form-check-label small fw-semibold text-muted mb-0" htmlFor="simpleViewToggle" style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                Simple View
              </label>
            </div>
          )}
          <input
            type="text"
            className="form-control form-control-sm"
            style={{ width: '250px' }}
            placeholder={type === 'REPAIR' ? 'Search Model, Name, Phone...' : 'Search Name or Phone...'}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          <button className="btn btn-outline-secondary btn-sm rounded-pill px-3" onClick={loadData}>
             Refresh
          </button>
        </div>
      </div>

      {/* Toggle Filters Row */}
      <div className="d-flex flex-wrap gap-2 mb-4 bg-light p-2 rounded-3 border no-print">
        {[
          { id: 'ALL', label: '📋 All Groups', color: 'dark' },
          { id: 'CUSTOMER', label: '👤 Regular Customers', color: 'primary' },
          { id: 'SHOP_CUSTOMER', label: '👥 Shop Customers', color: 'info' },
          { id: 'SUPPLIER', label: '🏭 Suppliers', color: 'success' },
          { id: 'AIRTEL_RETAILER', label: '🏪 Airtel Retailers', color: 'danger' },
          { id: 'SHOP', label: '🏬 Shops', color: 'warning' },
          { id: 'REPAIR', label: '🔧 Repairs (Outstanding)', color: 'secondary' },
          { id: 'STAFF', label: '👷 Staff Details', color: 'dark' },
          { id: 'FINANCER', label: '💳 Finance Companies', color: 'primary' },
          { id: 'OTHER', label: '📁 Other Accounts', color: 'secondary' }
        ].map(t => {
          const isActive = type === t.id;
          return (
            <button
              key={t.id}
              type="button"
              className={`btn btn-sm rounded-pill px-3 fw-bold transition-all ${isActive ? `btn-${t.color}` : 'btn-outline-secondary'}`}
              onClick={() => {
                  if (t.id === 'ALL') {
                      navigate('/accounts/group-summary');
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

      <div className="card shadow-sm border-0 overflow-hidden">
        <div className="table-responsive">
          <table className="table custom-tally-table mb-0">
            <thead>
              <tr className="bg-light text-uppercase x-small text-muted fw-bold">
                {type === 'REPAIR' ? (
                  <>
                    <th className="ps-3" style={{ width: '80px' }}>Job ID</th>
                    <th>Customer Name</th>
                    <th>Device Model</th>
                    <th>Submitted Date</th>
                    <th className="text-end">Quoted</th>
                    <th className="text-end">Received</th>
                    <th className="text-end">Balance (Dr)</th>
                    <th className="text-center">Status</th>
                    <th className="text-end pe-3" style={{ width: '150px' }}>Actions</th>
                  </>
                ) : (
                  <>
                    <th className="ps-3">Name</th>
                    <th>Contact Info</th>
                    {!simpleView && (
                      <>
                        <th>Trade Type</th>
                        <th className="text-end">Opening Balance</th>
                        <th className="text-end">Sales Bal</th>
                        <th className="text-end">Repairs Bal</th>
                        <th className="text-end">Works Bal</th>
                      </>
                    )}
                    <th className="text-end">Net Balance</th>
                    <th className="text-end pe-3" style={{ width: '280px' }}>Actions</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={type === 'REPAIR' ? 9 : (simpleView ? 4 : 9)} className="text-center py-5">
                    <div className="spinner-border text-primary opacity-50"></div>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={type === 'REPAIR' ? 9 : (simpleView ? 4 : 9)} className="text-center py-5 text-muted italic">
                    No accounts found matching this criteria.
                  </td>
                </tr>
              ) : type === 'REPAIR' ? (
                filteredData.map(r => {
                  const quoted = parseFloat(r.quoted_amount || 0);
                  const advance = parseFloat(r.advance_amount || 0);
                  const received = parseFloat(r.balance_amount_received || 0);
                  const balance = quoted - (advance + received);
                  return (
                    <tr key={r.id} className="tally-row">
                      <td className="ps-3 fw-bold small text-muted">#{r.id}</td>
                      <td>
                        <div className="fw-bold">{r.customer_name}</div>
                        <div className="small text-muted">{r.customer_phone || '—'}</div>
                      </td>
                      <td className="fw-semibold text-dark">{r.device_model}</td>
                      <td className="small text-muted">{formatDate(r.submitted_date)}</td>
                      <td className="text-end fw-semibold text-dark">₹{quoted.toLocaleString()}</td>
                      <td className="text-end text-success fw-semibold">₹{(advance + received).toLocaleString()}</td>
                      <td className="text-end text-danger fw-bold">₹{balance.toLocaleString()}</td>
                      <td className="text-center">
                        <span className="badge bg-warning rounded-pill x-small px-2 text-dark text-uppercase">{r.status}</span>
                      </td>
                      <td className="text-end pe-3">
                        <Link to={`/repairs/${r.id}/edit`} className="btn btn-outline-primary btn-xs rounded-pill px-3 fw-semibold">
                           ✏️ View / Edit
                        </Link>
                      </td>
                    </tr>
                  );
                })
              ) : (
                filteredData.map(e => {
                  const salesBal = parseFloat(e.sales_balance || 0);
                  const repairsBal = parseFloat(e.repairs_balance || 0);
                  const worksBal = parseFloat(e.works_balance || 0);
                  const bal = parseFloat(e.net_balance || 0);
                  return (
                    <tr key={e.id} className="tally-row">
                      <td className="ps-3">
                        <Link to={`/accounts/entity-ledger?id=${e.id}&name=${encodeURIComponent(e.name)}`}
                          className="fw-bold text-dark text-decoration-none d-block">
                          {e.name}
                        </Link>
                        <div className="xx-small text-muted text-uppercase">{e.type}</div>
                      </td>
                      <td className="small">
                        <div>{e.phone || '—'}</div>
                        <div className="opacity-50">{e.email || ''}</div>
                      </td>
                      {!simpleView && (
                        <>
                          <td>
                            {renderTradeTypeBadges(e)}
                          </td>
                          <td className="small text-muted text-end">
                            ₹{Number(e.opening_balance).toLocaleString()} {e.balance_type === 'RECEIVABLE' ? 'Dr' : 'Cr'}
                          </td>
                          <td className={`text-end fw-semibold ${salesBal > 0 ? 'text-success' : salesBal < 0 ? 'text-danger' : 'text-muted'}`}>
                            {salesBal !== 0 ? `₹${Math.abs(salesBal).toLocaleString()} ${salesBal >= 0 ? 'Dr' : 'Cr'}` : '—'}
                          </td>
                          <td className={`text-end fw-semibold ${repairsBal > 0 ? 'text-success' : repairsBal < 0 ? 'text-danger' : 'text-muted'}`}>
                            {repairsBal !== 0 ? `₹${Math.abs(repairsBal).toLocaleString()} ${repairsBal >= 0 ? 'Dr' : 'Cr'}` : '—'}
                          </td>
                          <td className={`text-end fw-semibold ${worksBal > 0 ? 'text-success' : worksBal < 0 ? 'text-danger' : 'text-muted'}`}>
                            {worksBal !== 0 ? `₹${Math.abs(worksBal).toLocaleString()} ${worksBal >= 0 ? 'Dr' : 'Cr'}` : '—'}
                          </td>
                        </>
                      )}
                      <td className={`text-end fw-bold ${bal >= 0 ? 'text-success' : 'text-danger'}`}>
                        ₹{Math.abs(bal).toLocaleString()} {bal >= 0 ? 'Dr' : 'Cr'}
                      </td>
                      <td className="text-end pe-3">
                        <div className="d-flex gap-1 justify-content-end align-items-center">
                          <Link to={`/accounts/entity-ledger?id=${e.id}&name=${encodeURIComponent(e.name)}`} className="btn btn-outline-info btn-xs rounded-pill px-2 fw-semibold">
                             View Ledger
                          </Link>
                          {isOwner() && (
                            <>
                              <button
                                className="btn btn-outline-secondary btn-xs rounded-pill px-2 py-0 d-inline-flex align-items-center gap-1 shadow-sm"
                                style={{ fontSize: '0.7rem' }}
                                title="Delete account only (keeps transaction history)"
                                disabled={deleting === e.id}
                                onClick={(evt) => {
                                  evt.stopPropagation();
                                  handleDelete(e);
                                }}
                              >
                                {deleting === e.id ? (
                                  <span className="spinner-border spinner-border-sm" style={{ width: '0.7rem', height: '0.7rem' }}></span>
                                ) : (
                                  <><i className="bi bi-trash"></i> Del</>
                                )}
                              </button>
                              <button
                                className="btn btn-outline-danger btn-xs rounded-pill px-2 py-0 d-inline-flex align-items-center gap-1 shadow-sm"
                                style={{ fontSize: '0.7rem' }}
                                title="Delete account AND all transaction history (irreversible)"
                                disabled={deletingHistory === e.id}
                                onClick={(evt) => {
                                  evt.stopPropagation();
                                  handleDeleteWithHistory(e);
                                }}
                              >
                                {deletingHistory === e.id ? (
                                  <span className="spinner-border spinner-border-sm" style={{ width: '0.7rem', height: '0.7rem' }}></span>
                                ) : (
                                  <><i className="bi bi-trash-fill"></i> Del+History</>
                                )}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr className="fw-bold bg-light">
                {type === 'REPAIR' ? (
                  <>
                    <td className="ps-3" colSpan="6">Total Outstanding Balance</td>
                    <td className="text-end text-danger" style={{ fontSize: '0.95rem' }}>₹{totals.debit.toLocaleString()}</td>
                    <td colSpan="2"></td>
                  </>
                ) : (
                  <>
                    <td className="ps-3" colSpan="2">Totals</td>
                    {!simpleView && (
                      <>
                        <td></td>
                        <td className={`text-end ${(totals.opening) >= 0 ? 'text-success' : 'text-danger'}`} style={{ fontSize: '0.9rem' }}>
                          ₹{Math.abs(totals.opening).toLocaleString()} {totals.opening >= 0 ? 'Dr' : 'Cr'}
                        </td>
                        <td className={`text-end ${(totals.sales) >= 0 ? 'text-success' : 'text-danger'}`} style={{ fontSize: '0.9rem' }}>
                          ₹{Math.abs(totals.sales).toLocaleString()} {totals.sales >= 0 ? 'Dr' : 'Cr'}
                        </td>
                        <td className={`text-end ${(totals.repairs) >= 0 ? 'text-success' : 'text-danger'}`} style={{ fontSize: '0.9rem' }}>
                          ₹{Math.abs(totals.repairs).toLocaleString()} {totals.repairs >= 0 ? 'Dr' : 'Cr'}
                        </td>
                        <td className={`text-end ${(totals.works) >= 0 ? 'text-success' : 'text-danger'}`} style={{ fontSize: '0.9rem' }}>
                          ₹{Math.abs(totals.works).toLocaleString()} {totals.works >= 0 ? 'Dr' : 'Cr'}
                        </td>
                      </>
                    )}
                    <td className={`text-end ${totals.net >= 0 ? 'text-success' : 'text-danger'}`} style={{ fontSize: '0.95rem' }}>
                      ₹{Math.abs(totals.net).toLocaleString()} {totals.net >= 0 ? 'Dr' : 'Cr'}
                    </td>
                    <td></td>
                  </>
                )}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <style>{`
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
        .custom-tally-table tbody tr td a:hover {
          text-decoration: underline !important;
          color: var(--bs-primary) !important;
        }
        .btn-xs { font-size: 0.7rem; padding: 2px 8px; }
        .x-small { font-size: 0.7rem; }
        .xx-small { font-size: 0.6rem; }
      `}</style>
    </div>
  );
}
