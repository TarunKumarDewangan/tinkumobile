import { useState, useEffect } from 'react';
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
                <h2 className="h4 mb-0 text-uppercase fw-bold text-primary">Daybook</h2>
                <p className="text-muted small mb-0">View all unified ledger entries for the given date range</p>
            </div>
            <div className="d-flex gap-2 align-items-center bg-white p-2 rounded-3 shadow-sm border">
                <input type="date" className="form-control form-control-sm border-0 shadow-none bg-light" value={dates.start} onChange={e => setDates({...dates, start: e.target.value})} />
                <span className="text-muted small">to</span>
                <input type="date" className="form-control form-control-sm border-0 shadow-none bg-light" value={dates.end} onChange={e => setDates({...dates, end: e.target.value})} />
            </div>
        </div>

        <div className="row g-3 mb-4">
            <div className="col-md-6">
                <div className="card border-0 shadow-sm bg-danger text-white bg-gradient p-3">
                    <div className="small text-uppercase fw-bold opacity-75 mb-1">Total Debit (Sales/Receivable/Paid Out)</div>
                    <div className="h4 mb-0 fw-bold">₹{Number(totals.debit).toLocaleString()}</div>
                </div>
            </div>
            <div className="col-md-6">
                <div className="card border-0 shadow-sm bg-success text-white bg-gradient p-3">
                    <div className="small text-uppercase fw-bold opacity-75 mb-1">Total Credit (Purchases/Payable/Received In)</div>
                    <div className="h4 mb-0 fw-bold">₹{Number(totals.credit).toLocaleString()}</div>
                </div>
            </div>
        </div>

        <div className="card border-0 shadow-sm">
            <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                    <thead className="table-light text-uppercase">
                        <tr>
                            <th className="ps-4">Date</th>
                            <th>Entity Name</th>
                            <th>Voucher Type</th>
                            <th>Particulars</th>
                            <th className="text-end">Debit (Dr)</th>
                            <th className="text-end pe-4">Credit (Cr)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="6" className="text-center py-5"><div className="spinner-border text-primary" /></td></tr>
                        ) : entries.length === 0 ? (
                            <tr><td colSpan="6" className="text-center py-5 text-muted"><i className="bi bi-journal-x display-6 d-block mb-3 opacity-25"></i> No entries found for this period.</td></tr>
                        ) : entries.map(entry => (
                            <tr key={entry.id}>
                                <td className="ps-4 text-muted small">{new Date(entry.date).toLocaleDateString()}</td>
                                <td>
                                    <Link to={`/accounts/entity-ledger?id=${entry.entity.id}&name=${encodeURIComponent(entry.entity.name)}`} className="text-decoration-none fw-bold">
                                        {entry.entity.name}
                                    </Link>
                                </td>
                                <td><span className="badge bg-light text-secondary border">{entry.voucher_type}</span></td>
                                <td className="small">{entry.particulars}</td>
                                <td className={`text-end fw-bold ${entry.debit > 0 ? 'text-danger' : 'text-muted opacity-25'}`}>
                                    {entry.debit > 0 ? `₹${Number(entry.debit).toLocaleString()}` : '—'}
                                </td>
                                <td className={`text-end pe-4 fw-bold ${entry.credit > 0 ? 'text-success' : 'text-muted opacity-25'}`}>
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
        `}</style>
    </div>
  );
}
