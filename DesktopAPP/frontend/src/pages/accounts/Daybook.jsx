import { useState, useEffect, useMemo } from 'react';
import api from '../../api/axios';
import { toast } from 'react-toastify';
import { Link } from 'react-router-dom';

export default function Daybook() {
  const [entries, setEntries] = useState([]);
  const [totals, setTotals] = useState({ debit: 0, credit: 0 });
  const [loading, setLoading] = useState(false);
  const [dates, setDates] = useState({
      start: new Date().toISOString().split('T')[0],
      end: new Date().toISOString().split('T')[0]
  });
  const [filterType, setFilterType] = useState('ALL');

  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      if (filterType === 'ALL') return true;
      if (filterType === 'SALE') return entry.voucher_type === 'SALE';
      if (filterType === 'REPAIR') return entry.voucher_type === 'REPAIR';
      if (filterType === 'RECHARGE') {
          return (entry.particulars || '').toUpperCase().includes('RECHARGE');
      }
      if (filterType === 'PURCHASE') return entry.voucher_type === 'PURCHASE';
      if (filterType === 'PAYMENT_RECEIPT') return ['PAYMENT', 'RECEIPT'].includes(entry.voucher_type) && !(entry.particulars || '').toUpperCase().includes('RECHARGE');
      if (filterType === 'AIRTEL') return entry.voucher_type === 'AIRTEL_RECOVERY';
      return true;
    });
  }, [entries, filterType]);

  const getCount = (id) => {
    return entries.filter(entry => {
      if (id === 'ALL') return true;
      if (id === 'SALE') return entry.voucher_type === 'SALE';
      if (id === 'REPAIR') return entry.voucher_type === 'REPAIR';
      if (id === 'RECHARGE') {
          return (entry.particulars || '').toUpperCase().includes('RECHARGE');
      }
      if (id === 'PURCHASE') return entry.voucher_type === 'PURCHASE';
      if (id === 'PAYMENT_RECEIPT') return ['PAYMENT', 'RECEIPT'].includes(entry.voucher_type) && !(entry.particulars || '').toUpperCase().includes('RECHARGE');
      if (id === 'AIRTEL') return entry.voucher_type === 'AIRTEL_RECOVERY';
      return true;
    }).length;
  };

  const filteredDebit = useMemo(() => {
    return filteredEntries.reduce((sum, entry) => sum + parseFloat(entry.debit || 0), 0);
  }, [filteredEntries]);

  const filteredCredit = useMemo(() => {
    return filteredEntries.reduce((sum, entry) => sum + parseFloat(entry.credit || 0), 0);
  }, [filteredEntries]);

  const fetchDaybook = async () => {
      setLoading(true);
      try {
          const { data } = await api.get('/ledgers/daybook', {
              params: { start_date: dates.start, end_date: dates.end }
          });
          setEntries(data.entries);
          setTotals(data.totals);
      } catch (e) {
          toast.error("Failed to load Daybook");
      } finally {
          setLoading(false);
      }
  };

  useEffect(() => {
      fetchDaybook();
  }, [dates]);

  return (
    <div className="container-fluid py-4 animate-fadeIn">
        <div className="d-flex justify-content-between align-items-center mb-4">
            <div>
                <h2 className="h4 mb-0 text-uppercase fw-bold text-dark">Daybook</h2>
                <p className="text-muted small mb-0">View all unified ledger entries for the given date range</p>
            </div>
            <div className="d-flex gap-2 align-items-center bg-white p-2 rounded-2 border border-secondary border-opacity-25 shadow-none">
                <input type="date" className="form-control form-control-sm border-0 shadow-none bg-light" value={dates.start} onChange={e => setDates({...dates, start: e.target.value})} />
                <span className="text-muted small">to</span>
                <input type="date" className="form-control form-control-sm border-0 shadow-none bg-light" value={dates.end} onChange={e => setDates({...dates, end: e.target.value})} />
            </div>
        </div>

        <div className="row g-3 mb-4">
            <div className="col-md-6">
                <div className="card border border-secondary border-opacity-25 bg-white p-3 shadow-none rounded-2">
                    <div className="small text-uppercase fw-bold text-muted opacity-75 mb-1">Total Debit (Sales/Receivable/Paid Out)</div>
                    <div className="h4 mb-0 fw-bold text-dark">₹{filteredDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                </div>
            </div>
            <div className="col-md-6">
                <div className="card border border-secondary border-opacity-25 bg-white p-3 shadow-none rounded-2">
                    <div className="small text-uppercase fw-bold text-muted opacity-75 mb-1">Total Credit (Purchases/Payable/Received In)</div>
                    <div className="h4 mb-0 fw-bold text-dark">₹{filteredCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                </div>
            </div>
        </div>

        {/* Toggle Filters Row */}
        <div className="d-flex flex-wrap gap-2 mb-3 bg-light p-2 rounded-3 border">
          {[
            { id: 'ALL', label: '📖 All Entries', color: 'dark' },
            { id: 'SALE', label: '🧾 Sales', color: 'primary' },
            { id: 'REPAIR', label: '🔧 Repairs', color: 'warning' },
            { id: 'RECHARGE', label: '⚡ Recharges', color: 'info' },
            { id: 'PURCHASE', label: '🛒 Purchases', color: 'success' },
            { id: 'PAYMENT_RECEIPT', label: '💰 Payments/Receipts', color: 'secondary' },
            { id: 'AIRTEL', label: '📶 Airtel Recovery', color: 'danger' }
          ].map(t => {
            const isActive = filterType === t.id;
            return (
              <button
                key={t.id}
                type="button"
                className={`btn btn-sm rounded-pill px-3 fw-bold transition-all ${isActive ? `btn-${t.color}` : 'btn-outline-secondary'}`}
                onClick={() => setFilterType(t.id)}
                style={{
                  fontSize: '0.78rem',
                  borderWidth: '1.5px',
                  transform: isActive ? 'scale(1.03)' : 'scale(1)',
                  boxShadow: isActive ? '0 4px 10px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                {t.label} <span className={`badge ${isActive ? 'bg-white text-dark' : 'bg-secondary text-white'} ms-1`}>{getCount(t.id)}</span>
              </button>
            );
          })}
        </div>

        <div className="card border border-secondary border-opacity-25 rounded-2 shadow-none overflow-hidden bg-white">
            <div className="table-responsive">
                <table className="table custom-tally-table mb-0">
                    <thead>
                        <tr>
                            <th className="ps-3" style={{ width: '120px' }}>Date</th>
                            <th>Entity Name</th>
                            <th style={{ width: '150px' }}>Voucher Type</th>
                            <th>Particulars</th>
                            <th className="text-end" style={{ width: '140px' }}>Debit (Dr)</th>
                            <th className="text-end pe-3" style={{ width: '140px' }}>Credit (Cr)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="6" className="text-center py-5 border-0"><div className="spinner-border text-secondary" /></td></tr>
                        ) : filteredEntries.length === 0 ? (
                            <tr><td colSpan="6" className="text-center py-5 text-muted border-0"><i className="bi bi-journal-x display-6 d-block mb-3 opacity-25"></i> No entries found matching the filter.</td></tr>
                        ) : filteredEntries.map(entry => (
                            <tr key={entry.id} className="tally-row">
                                <td className="ps-3 text-muted small">{new Date(entry.date).toLocaleDateString('en-GB')}</td>
                                <td>
                                    <Link to={`/accounts/entity-ledger?id=${entry.entity.id}&name=${encodeURIComponent(entry.entity.name)}`}>
                                        {entry.entity.name}
                                    </Link>
                                </td>
                                <td>
                                    <span className="badge bg-light text-dark border border-secondary border-opacity-25">
                                        {entry.voucher_type}
                                    </span>
                                </td>
                                <td className="small">{entry.particulars}</td>
                                <td className={`text-end fw-bold ${entry.debit > 0 ? 'text-dark' : 'text-muted opacity-25'}`}>
                                    {entry.debit > 0 ? `₹${Number(entry.debit).toLocaleString()}` : '—'}
                                </td>
                                <td className={`text-end pe-3 fw-bold ${entry.credit > 0 ? 'text-dark' : 'text-muted opacity-25'}`}>
                                    {entry.credit > 0 ? `₹${Number(entry.credit).toLocaleString()}` : '—'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
        <style>{`
           @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
           .animate-fadeIn { animation: fadeIn 0.4s ease-out; }
           
           .custom-tally-table {
               border-collapse: collapse !important;
               width: 100%;
           }
           .custom-tally-table thead th {
               background: #f8fafc;
               color: #475569;
               font-size: 0.75rem;
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
           }
           .custom-tally-table tbody tr td:last-child {
               border-right: none !important;
           }
           .custom-tally-table tbody tr:last-child td {
               border-bottom: none !important;
           }
           .custom-tally-table tbody tr.tally-row:hover {
               background-color: #f1f5f9;
           }
           .custom-tally-table a {
               color: #1e293b;
               text-decoration: none;
               font-weight: bold;
           }
           .custom-tally-table a:hover {
               text-decoration: underline;
               color: #0d6efd;
           }
        `}</style>
    </div>
  );
}
