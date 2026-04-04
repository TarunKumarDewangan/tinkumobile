import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../api/axios';
import { formatDate } from '../utils/formatters';

export default function Incentives() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = () => { setLoading(true); api.get('/incentives').then(r => setList(r.data)).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const markPaid = async (id) => {
    if (!window.confirm('Mark this incentive as paid?')) return;
    try {
      await api.post(`/incentives/${id}/mark-paid`, { payment_date: new Date().toISOString().slice(0, 10) });
      toast.success('Incentive marked as paid!');
      load();
    } catch (e) {
      toast.error('Error marking as paid');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>🏆 Employee Incentives</h2>
      </div>
      <div className="table-card">
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status" />
            <div className="mt-2 text-muted">Loading incentives...</div>
          </div>
        ) : (
          <div className="table-responsive-mobile">
            <table className="table table-hover mb-0">
              <thead>
                <tr>
                  <th>Staff Member</th>
                  <th>Product Details</th>
                  <th>Amount</th>
                  <th>Sale Date</th>
                  <th>Status / Paid On</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map(inc => (
                  <tr key={inc.id}>
                    <td>
                      <div className="fw-bold">{inc.user?.name}</div>
                      <div className="text-muted small">{inc.user?.designation}</div>
                    </td>
                    <td>{inc.product?.name}</td>
                    <td className="fw-bold text-primary">₹{Number(inc.incentive_amount).toLocaleString('en-IN')}</td>
                    <td className="text-muted">{formatDate(inc.sale_item?.invoice?.sale_date)}</td>
                    <td>
                      {inc.paid_status ? (
                        <div>
                          <span className="badge bg-success-subtle text-success border">Paid</span>
                          <div className="text-muted mt-1" style={{ fontSize: '0.7rem' }}>📅 {formatDate(inc.payment_date)}</div>
                        </div>
                      ) : (
                        <span className="badge bg-warning-subtle text-warning-emphasis border text-dark">Pending</span>
                      )}
                    </td>
                    <td>
                      {!inc.paid_status && (
                        <button className="btn btn-xs btn-success fw-bold" onClick={() => markPaid(inc.id)}>
                          Mark Paid
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {list.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-5 text-muted">
                      No incentive records found.
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
