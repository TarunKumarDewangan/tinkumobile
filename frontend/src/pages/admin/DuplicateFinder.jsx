import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import pinGate from '../../utils/pinGate';

export default function DuplicateFinder() {
  const [issues, setIssues] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fixingKey, setFixingKey] = useState(null);

  const scan = () => {
    setLoading(true);
    api.get('/duplicate-finder')
      .then(r => setIssues(r.data.issues))
      .catch(e => toast.error(e.response?.data?.message || 'Scan failed'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { scan(); }, []);

  const handleFix = async (issue) => {
    if (!await pinGate.confirm()) return;
    setFixingKey(issue.key);
    try {
      const [keep, ...rest] = issue.transactions;
      await api.post('/duplicate-finder/fix', {
        keep_id: keep.id,
        delete_ids: rest.map(t => t.id),
      });
      toast.success(`Removed ${rest.length} duplicate(s)`);
      scan();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Fix failed');
    } finally {
      setFixingKey(null);
    }
  };

  return (
    <div>
      <div className="page-header d-flex justify-content-between align-items-center">
        <h2>🔁 Duplicate Finder</h2>
        <button className="btn btn-outline-primary btn-sm" onClick={scan} disabled={loading}>
          {loading ? 'Scanning...' : '↻ Re-scan'}
        </button>
      </div>

      <div className="alert alert-secondary small">
        Finds transactions that look like they were created by the same edit/save firing
        twice (two tabs, a slow connection, a retried request) — same customer/supplier,
        same category, same amount, recorded within {30} minutes of each other. These
        double-count in that person's ledger balance until removed. Fixing keeps the
        earliest entry and removes the later duplicate(s) — a soft delete, recoverable
        from Trash Manager if needed.
      </div>

      {loading ? (
        <div className="text-center py-5"><div className="spinner-border text-primary" /></div>
      ) : !issues ? null : issues.length === 0 ? (
        <div className="table-card p-4 text-center text-muted">
          ✅ No duplicate transactions found.
        </div>
      ) : (
        <div className="table-card">
          <div className="p-3 border-bottom">
            <strong>Likely Duplicate Transactions</strong> ({issues.length})
          </div>
          <table className="table table-bordered table-hover mb-0 align-middle">
            <thead>
              <tr>
                <th>Entity</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Count</th>
                <th>Extra Amount</th>
                <th>Span</th>
                <th>Description</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {issues.map(i => (
                <tr key={i.key}>
                  <td>{i.entity_name || '—'} <span className="text-muted x-small">({i.entity_type} #{i.entity_id})</span></td>
                  <td><span className={`badge ${i.type === 'IN' ? 'bg-success' : 'bg-secondary'}`}>{i.category}</span></td>
                  <td>₹{i.amount.toLocaleString('en-IN')}</td>
                  <td>{i.count}</td>
                  <td className="text-danger fw-bold">₹{i.extra_amount.toLocaleString('en-IN')}</td>
                  <td>{i.span_seconds < 60 ? `${i.span_seconds}s` : `${Math.round(i.span_seconds / 60)}m`}</td>
                  <td className="text-muted small">{i.description}</td>
                  <td>
                    <button
                      className="btn btn-xs btn-outline-danger"
                      disabled={fixingKey === i.key}
                      onClick={() => handleFix(i)}
                    >
                      {fixingKey === i.key ? 'Fixing...' : `Fix — keep 1, remove ${i.count - 1}`}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
