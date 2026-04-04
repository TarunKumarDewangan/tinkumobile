import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import { formatDate } from '../../utils/formatters';

export default function Loans() {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { api.get('/loans').then(r => setLoans(r.data)).finally(() => setLoading(false)); }, []);

  return (
    <div>
      <div className="page-header">
        <h2>💰 Loans</h2>
        <Link to="/loans/new" className="btn btn-primary btn-sm">+ New Loan</Link>
      </div>
      <div className="table-card">
        {loading ? <div className="text-center py-4"><div className="spinner-border spinner-border-sm" /></div> : (
          <table className="table table-hover mb-0">
            <thead><tr><th>Customer</th><th>Principal</th><th>Months</th><th>EMI ₹</th><th>Paid</th><th>Remaining</th><th>Status</th><th>Next Due</th></tr></thead>
            <tbody>
              {loans.map(l => (
                <tr key={l.id}>
                  <td className="fw-semibold">{l.customer?.name}</td>
                  <td>₹{Number(l.principal).toLocaleString('en-IN')}</td>
                  <td>{l.total_months} mo @ {l.interest_rate}%</td>
                  <td>₹{Number(l.monthly_installment).toLocaleString('en-IN')}</td>
                  <td className="text-success">₹{Number(l.total_paid||0).toLocaleString('en-IN')}</td>
                  <td className="text-danger">₹{Number(l.remaining||0).toLocaleString('en-IN')}</td>
                  <td><span className={`badge ${l.status==='active'?'bg-warning text-dark':l.status==='closed'?'bg-success':'bg-danger'}`}>{l.status}</span></td>
                  <td className="text-muted">{formatDate(l.next_due?.due_date)}</td>
                </tr>
              ))}
              {loans.length === 0 && <tr><td colSpan={8} className="text-center py-4 text-muted">No loans</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
