import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { formatDate } from '../utils/formatters';

export default function OldMobiles() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/old-mobiles')
      .then(r => setList(r.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container-fluid px-4 py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1 text-dark d-flex align-items-center gap-2">
            <span>📲</span> Old Mobile Purchases
          </h2>
          <p className="text-muted mb-0">Track and manage second-hand mobile devices acquired from customers.</p>
        </div>
        <button 
          onClick={() => navigate('/old-mobiles/new')}
          className="btn btn-primary d-flex align-items-center gap-2 px-4 py-2 shadow-sm rounded-pill hover-scale"
        >
          <span>➕</span> Record Purchase / Exchange
        </button>
      </div>

      <div className="card border-0 bg-white shadow-sm rounded-4 border-secondary-subtle overflow-hidden">
        {loading ? (
          <div className="d-flex justify-content-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th className="py-3 px-4 text-muted">Date</th>
                  <th className="py-3 text-muted">Customer (Seller)</th>
                  <th className="py-3 text-muted">Model Details</th>
                  <th className="py-3 text-muted">IMEI</th>
                  <th className="py-3 text-muted">Purchase Value</th>
                  <th className="py-3 text-muted">Type</th>
                  <th className="py-3 text-muted">Specs & Cond</th>
                  <th className="py-3 text-muted">Resale Target</th>
                  <th className="py-3 px-4 text-muted text-end">Staff</th>
                </tr>
              </thead>
              <tbody>
                {list.map(m => (
                  <tr key={m.id}>
                    <td className="py-3 px-4 text-muted">{formatDate(m.purchase_date)}</td>
                    <td className="py-3">
                      <div className="fw-bold text-dark">{m.customer?.name}</div>
                      <small className="text-muted">{m.customer?.phone}</small>
                    </td>
                    <td className="py-3">
                      <span className="fw-semibold text-dark">{m.model_name}</span>
                    </td>
                    <td className="py-3">
                      <code className="text-primary">{m.imei || '—'}</code>
                    </td>
                    <td className="py-3 fw-bold text-success">
                      ₹{parseFloat(m.purchase_price).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3">
                      {m.is_exchange ? (
                        <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-3 py-1">
                          🔄 Exchange
                        </span>
                      ) : (
                        <span className="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill px-3 py-1">
                          💵 Cash Payout
                        </span>
                      )}
                    </td>
                    <td className="py-3">
                      <div className="d-flex gap-1 flex-wrap mb-1">
                        {m.ram && <span className="badge bg-secondary rounded-pill text-xs">{m.ram} RAM</span>}
                        {m.storage && <span className="badge bg-secondary rounded-pill text-xs">{m.storage} Stock</span>}
                        {m.color && <span className="badge bg-dark rounded-pill text-xs">{m.color}</span>}
                      </div>
                      <small className="text-muted text-truncate d-inline-block" style={{maxWidth: '150px'}} title={m.condition_note}>
                        {m.condition_note || 'No notes'}
                      </small>
                    </td>
                    <td className="py-3 fw-bold text-warning">
                      {parseFloat(m.selling_price) > 0 ? `₹${parseFloat(m.selling_price).toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-end text-muted">{m.user?.name}</td>
                  </tr>
                ))}
                {list.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center py-5 text-muted">
                      <div className="fs-1 mb-2">📱</div>
                      No old mobile purchases found. Record a purchase to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
