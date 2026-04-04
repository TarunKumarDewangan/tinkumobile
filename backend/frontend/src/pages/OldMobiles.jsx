import { useState, useEffect } from 'react';
import api from '../api/axios';
import { formatDate } from '../utils/formatters';

export default function OldMobiles() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.get('/old-mobiles').then(r => setList(r.data)).finally(() => setLoading(false)); }, []);
  return (
    <div>
      <div className="page-header"><h2>📲 Old Mobile Purchases</h2></div>
      <div className="table-card">
        {loading ? <div className="text-center py-4"><div className="spinner-border spinner-border-sm" /></div> : (
          <table className="table table-hover mb-0">
            <thead><tr><th>Date</th><th>Customer (Seller)</th><th>Model</th><th>IMEI</th><th>Paid ₹</th><th>Condition Notes</th><th>Staff</th></tr></thead>
            <tbody>
              {list.map(m => (<tr key={m.id}>
                <td>{formatDate(m.purchase_date)}</td><td className="fw-semibold">{m.customer?.name}</td>
                <td>{m.model_name}</td><td><code>{m.imei || '—'}</code></td>
                <td>₹{m.purchase_price}</td><td>{m.condition_note || '—'}</td><td>{m.user?.name}</td>
              </tr>))}
              {list.length === 0 && <tr><td colSpan={7} className="text-center py-4 text-muted">No old mobile purchases</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
