import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../api/axios';

export default function SimCards() {
  const [sims, setSims] = useState([]);
  const load = () => api.get('/sim-cards').then(r => setSims(r.data));
  useEffect(() => { load(); }, []);

  const sell = async (id) => {
    const sold_to = prompt('Enter customer ID to sell to:');
    const sale_date = new Date().toISOString().slice(0,10);
    if (!sold_to) return;
    await api.post(`/sim-cards/${id}/sell`, { sold_to, sale_date });
    toast.success('SIM sold!'); load();
  };

  return (
    <div>
      <div className="page-header"><h2>📶 SIM Cards</h2></div>
      <div className="table-card">
        <table className="table table-hover mb-0">
          <thead><tr><th>SIM #</th><th>Mobile #</th><th>Operator</th><th>Purchase ₹</th><th>Sell ₹</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {sims.map(s => (
              <tr key={s.id}>
                <td><code>{s.sim_number}</code></td><td>{s.mobile_number || '—'}</td><td>{s.operator}</td>
                <td>₹{s.purchase_price}</td><td>₹{s.selling_price}</td>
                <td><span className={`badge ${s.status === 'in_stock' ? 'bg-success' : 'bg-secondary'}`}>{s.status}</span></td>
                <td>{s.status === 'in_stock' && <button className="btn btn-xs btn-primary" style={{ padding:'2px 8px', fontSize:'0.78rem' }} onClick={() => sell(s.id)}>Sell</button>}</td>
              </tr>
            ))}
            {sims.length === 0 && <tr><td colSpan={7} className="text-center py-4 text-muted">No SIM cards</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
