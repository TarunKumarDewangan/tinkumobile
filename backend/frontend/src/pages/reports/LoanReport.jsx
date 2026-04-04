import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { formatDate } from '../../utils/formatters';

export default function LoanReport() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.get('/reports/loans').then(r => setData(r.data)).finally(() => setLoading(false)); }, []);

  return (
    <div>
      <div className="page-header">
        <h2>💰 Loan Outstanding</h2>
        <span className="text-danger fw-semibold">{data.length} pending payments</span>
      </div>
      <div className="table-card">
        {loading ? <div className="text-center py-4"><div className="spinner-border spinner-border-sm" /></div> : (
          <table className="table table-hover mb-0">
            <thead><tr><th>Customer</th><th>Loan ID</th><th>Due Date</th><th>Amount ₹</th><th>Overdue</th></tr></thead>
            <tbody>
              {data.map(p => {
                const overdue = new Date(p.due_date) < new Date();
                return (
                <tr key={p.id} className={overdue ? 'table-danger' : ''}>
                  <td className="fw-semibold">{p.loan?.customer?.name}</td>
                  <td className="text-muted">#{p.loan_id}</td>
                  <td className={overdue ? 'text-danger fw-bold' : ''}>{formatDate(p.due_date)}</td>
                  <td>₹{Number(p.amount).toLocaleString('en-IN')}</td>
                  <td>{overdue ? <span className="badge bg-danger">Overdue</span> : <span className="badge bg-success">On Time</span>}</td>
                </tr>
              )})}
              {data.length === 0 && <tr><td colSpan={5} className="text-center py-4 text-muted">No pending payments</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
