import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import pinGate from '../../utils/pinGate';
import api from '../../api/axios';

const today = () => new Date().toISOString().slice(0, 10);

const CATEGORY_LABELS = {
  CUSTOMER: 'Customer',
  SHOP_CUSTOMER: 'Shop Customer',
  PERSONAL_FINANCE: 'Personal Finance',
  COMPANY_FINANCE: 'Company Finance',
};

export default function PromiseToPay() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [quickFilter, setQuickFilter] = useState('ALL'); // ALL | TODAY | OVERDUE | UPCOMING
  const [category, setCategory] = useState('ALL');

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/entity-notes');
      setNotes(data);
    } catch (e) {
      toast.error('Failed to load promise-to-pay notes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (note) => {
    if (!await pinGate.confirm()) return;
    try {
      await api.delete(`/entity-notes/${note.id}`);
      toast.success('Note removed');
      setNotes(prev => prev.filter(n => n.id !== note.id));
    } catch (e) {
      toast.error('Failed to remove note');
    }
  };

  const filtered = useMemo(() => {
    const t = today();
    let rows = notes;
    if (quickFilter === 'TODAY') rows = rows.filter(n => n.promise_date === t);
    else if (quickFilter === 'OVERDUE') rows = rows.filter(n => n.promise_date < t);
    else if (quickFilter === 'UPCOMING') rows = rows.filter(n => n.promise_date > t);

    if (category !== 'ALL') rows = rows.filter(n => n.category === category);

    if (search.trim()) {
      const s = search.trim().toUpperCase();
      rows = rows.filter(n => (n.name || '').toUpperCase().includes(s) || (n.phone || '').includes(s));
    }
    return rows;
  }, [notes, quickFilter, category, search]);

  const t = today();
  const counts = useMemo(() => ({
    today: notes.filter(n => n.promise_date === t).length,
    overdue: notes.filter(n => n.promise_date < t).length,
    upcoming: notes.filter(n => n.promise_date > t).length,
  }), [notes, t]);

  const badgeFor = (date) => {
    if (date < t) return <span className="badge bg-danger">OVERDUE</span>;
    if (date === t) return <span className="badge bg-warning text-dark">TODAY</span>;
    return <span className="badge bg-light text-dark border">UPCOMING</span>;
  };

  return (
    <div className="container-fluid py-3">
      <div className="page-header mb-3">
        <h2 className="mb-0 fw-bold text-uppercase">📝 Promise to Pay</h2>
        <p className="text-muted small mb-0 text-uppercase">Dates customers promised to clear their pending balance</p>
      </div>

      <div className="d-flex flex-wrap gap-2 mb-3">
        {[
          { id: 'ALL', label: `📋 All (${notes.length})` },
          { id: 'OVERDUE', label: `🔴 Overdue (${counts.overdue})` },
          { id: 'TODAY', label: `🟡 Today (${counts.today})` },
          { id: 'UPCOMING', label: `⚪ Upcoming (${counts.upcoming})` },
        ].map(f => (
          <button
            key={f.id}
            className={`btn btn-sm rounded-pill fw-bold ${quickFilter === f.id ? 'btn-dark' : 'btn-outline-secondary'}`}
            onClick={() => setQuickFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="card shadow-sm border-0 mb-3">
        <div className="card-body py-3 d-flex flex-wrap gap-3 align-items-center">
          <input
            className="form-control"
            style={{ maxWidth: 280 }}
            placeholder="Search name or phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select className="form-select fw-bold" style={{ maxWidth: 220 }} value={category} onChange={e => setCategory(e.target.value)}>
            <option value="ALL">All Categories</option>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button className="btn btn-outline-secondary btn-sm" onClick={load}>Refresh</button>
        </div>
      </div>

      <div className="card shadow-sm border-0">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-dark text-uppercase">
              <tr>
                <th>Promise Date</th>
                <th>Status</th>
                <th>Name</th>
                <th>Category</th>
                <th className="text-end">Balance (at time)</th>
                <th>Note</th>
                <th>Logged By</th>
                <th className="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-5"><div className="spinner-border text-primary" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-5 text-muted fw-bold">No promise-to-pay notes found</td></tr>
              ) : filtered.map(n => (
                <tr key={n.id}>
                  <td className="fw-bold">{n.promise_date}</td>
                  <td>{badgeFor(n.promise_date)}</td>
                  <td>
                    {n.entity_id ? (
                      <Link to={`/accounts/entity-ledger?id=${n.entity_id}&name=${encodeURIComponent(n.name)}`} className="fw-bold text-decoration-underline">
                        {n.name}
                      </Link>
                    ) : (
                      <span className="fw-bold">{n.name}</span>
                    )}
                    {n.phone && <div className="x-small text-muted">📞 {n.phone}</div>}
                  </td>
                  <td><span className="badge bg-light text-dark border">{CATEGORY_LABELS[n.category] || n.category || '—'}</span></td>
                  <td className="text-end fw-bold text-danger">{n.balance_at_time != null ? `₹${Number(n.balance_at_time).toLocaleString('en-IN')}` : '—'}</td>
                  <td className="small" style={{ maxWidth: 260 }}>{n.note || <span className="text-muted">—</span>}</td>
                  <td className="small text-muted">{n.created_by?.name || '—'}</td>
                  <td className="text-center">
                    <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(n)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
