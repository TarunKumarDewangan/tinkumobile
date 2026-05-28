import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import api from '../../api/axios';
import { toast } from 'react-toastify';
import { formatDate } from '../../utils/formatters';

export default function GroupDetails() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const type = searchParams.get('type') || 'CUSTOMER';

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      if (type === 'REPAIR') {
        const { data: repairs } = await api.get('/repairs');
        // Filter to repairs with outstanding balance
        const outstanding = repairs.filter(r => {
          const quoted = parseFloat(r.quoted_amount || 0);
          const advance = parseFloat(r.advance_amount || 0);
          const balanceReceived = parseFloat(r.balance_amount_received || 0);
          const balance = quoted - (advance + balanceReceived);
          return balance > 0.01;
        });
        setData(outstanding);
      } else {
        const params = { type };
        const { data: entities } = await api.get('/ledgers/entity-balances', { params });
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
    if (!searchTerm) return data;
    const lower = searchTerm.toLowerCase();
    if (type === 'REPAIR') {
      return data.filter(r => 
        (r.customer_name && r.customer_name.toLowerCase().includes(lower)) ||
        (r.customer_phone && r.customer_phone.includes(lower)) ||
        (r.device_model && r.device_model.toLowerCase().includes(lower)) ||
        String(r.id).includes(lower)
      );
    } else {
      return data.filter(e => 
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
        return acc;
      }, { debit: 0, credit: 0 });
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
        <div className="d-flex gap-2">
          <select
            className="form-select form-select-sm border-secondary-subtle"
            style={{ width: '220px' }}
            value={type}
            onChange={e => navigate(`/accounts/group-details?type=${e.target.value}`)}
          >
            <option value="CUSTOMER">Customers (Regular)</option>
            <option value="SHOP_CUSTOMER">Customers (Shop)</option>
            <option value="SUPPLIER">Suppliers</option>
            <option value="AIRTEL_RETAILER">Airtel Retailers</option>
            <option value="SHOP">Shops</option>
            <option value="REPAIR">Repairs (Outstanding)</option>
            <option value="STAFF">Staff Details</option>
            <option value="FINANCER">Finance Companies</option>
            <option value="OTHER">Other Accounts</option>
          </select>
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
                    <th>Opening Balance</th>
                    <th className="text-end">Debit (Receivable)</th>
                    <th className="text-end">Credit (Payable)</th>
                    <th className="text-end">Net Balance</th>
                    <th className="text-end pe-3" style={{ width: '180px' }}>Actions</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={type === 'REPAIR' ? 9 : 7} className="text-center py-5">
                    <div className="spinner-border text-primary opacity-50"></div>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={type === 'REPAIR' ? 9 : 7} className="text-center py-5 text-muted italic">
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
                      <td className="small text-muted">
                        ₹{Number(e.opening_balance).toLocaleString()} {e.balance_type === 'RECEIVABLE' ? 'Dr' : 'Cr'}
                      </td>
                      <td className="text-end fw-bold text-dark">
                        {bal > 0 ? `₹${bal.toLocaleString()}` : '—'}
                      </td>
                      <td className="text-end fw-bold text-dark">
                        {bal < 0 ? `₹${Math.abs(bal).toLocaleString()}` : '—'}
                      </td>
                      <td className={`text-end fw-bold ${bal >= 0 ? 'text-success' : 'text-danger'}`}>
                        ₹{Math.abs(bal).toLocaleString()} {bal >= 0 ? 'Dr' : 'Cr'}
                      </td>
                      <td className="text-end pe-3">
                        <Link to={`/accounts/entity-ledger?id=${e.id}&name=${encodeURIComponent(e.name)}`} className="btn btn-outline-info btn-xs rounded-pill px-3 fw-semibold">
                           View Ledger
                        </Link>
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
                    <td className="ps-3" colSpan="3">Totals</td>
                    <td className="text-end" style={{ fontSize: '0.95rem' }}>₹{totals.debit.toLocaleString()}</td>
                    <td className="text-end" style={{ fontSize: '0.95rem' }}>₹{totals.credit.toLocaleString()}</td>
                    <td className={`text-end ${(totals.debit - totals.credit) >= 0 ? 'text-success' : 'text-danger'}`} style={{ fontSize: '0.95rem' }}>
                      ₹{Math.abs(totals.debit - totals.credit).toLocaleString()} {(totals.debit - totals.credit) >= 0 ? 'Dr' : 'Cr'}
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
