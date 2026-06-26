import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../api/axios';
import { formatDate } from '../utils/formatters';

export default function CompanyOffers() {
  const [offers, setOffers] = useState([]);
  const load = () => api.get('/company-offers').then(r => setOffers(r.data));
  useEffect(() => { load(); }, []);

  const markFulfilled = async (id) => {
    if (!window.confirm('Mark this offer as fulfilled?')) return;
    await api.put(`/company-offers/${id}`, { is_fulfilled: true });
    toast.success('Offer fulfilled!'); load();
  };

  return (
    <div>
      <div className="page-header"><h2>🎯 Company Offers</h2></div>
      <div className="table-card">
        <table className="table table-hover mb-0">
          <thead><tr><th>Offer</th><th>Product</th><th>Period</th><th>Target</th><th>Sold</th><th>Progress</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {offers.map(o => {
              const pct = Math.min(100, Math.round((o.actual_sold / o.target_quantity) * 100));
              return (
                <tr key={o.id}>
                  <td className="fw-semibold">{o.name}</td>
                  <td>{o.product?.name || 'Any'}</td>
                  <td style={{ fontSize:'0.8rem' }}>{formatDate(o.start_date)} → {formatDate(o.end_date)}</td>
                  <td>{o.target_quantity}</td>
                  <td>{o.actual_sold}</td>
                  <td style={{ minWidth:120 }}>
                    <div className="progress" style={{ height:8 }}>
                      <div className={`progress-bar ${pct >= 100 ? 'bg-success' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div style={{ fontSize:'0.72rem', color:'#555' }}>{pct}%</div>
                  </td>
                  <td><span className={`badge ${o.is_fulfilled ? 'bg-success' : 'bg-warning text-dark'}`}>{o.is_fulfilled ? 'Fulfilled' : 'Active'}</span></td>
                  <td>{!o.is_fulfilled && <button className="btn btn-xs btn-success" style={{ padding:'2px 8px', fontSize:'0.78rem' }} onClick={() => markFulfilled(o.id)}>✓ Fulfill</button>}</td>
                </tr>
              );
            })}
            {offers.length === 0 && <tr><td colSpan={8} className="text-center py-4 text-muted">No offers</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
