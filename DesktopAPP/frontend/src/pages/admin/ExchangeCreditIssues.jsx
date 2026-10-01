import { useState, useEffect, useCallback } from 'react';
import { Modal, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import axios from '../../api/axios';
import { toast } from 'react-toastify';
import { useAuth } from '../../contexts/AuthContext';
import pinGate from '../../utils/pinGate';

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const RESOLUTION_LABEL = {
  credit_ledger: '✅ Credited to ledger',
  move_to_wallet: '🔒 Moved to wallet',
  ignore: '🙈 Ignored',
};

export default function ExchangeCreditIssues() {
  const { hasFullAccess } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState(null); // the row being resolved
  const [action, setAction] = useState(null); // 'credit_ledger' | 'move_to_wallet' | 'ignore'
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get('/old-mobiles/exchange-credit-issues');
      setRows(data);
    } catch {
      toast.error('Failed to load exchange credit issues');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (hasFullAccess()) fetchRows(); }, [fetchRows, hasFullAccess]);

  const openResolve = (row) => { setPicked(row); setAction(null); setNote(''); };
  const closeResolve = () => { if (!saving) { setPicked(null); setAction(null); setNote(''); } };

  const submitResolve = async () => {
    if (!picked || !action) return;
    if (!await pinGate.confirm()) return;
    setSaving(true);
    try {
      await axios.post(`/old-mobiles/${picked.id}/resolve-exchange-issue`, { action, note: note || undefined });
      toast.success('Resolved');
      setPicked(null);
      setAction(null);
      setNote('');
      fetchRows();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to resolve');
    } finally {
      setSaving(false);
    }
  };

  if (!hasFullAccess()) {
    return (
      <div className="container py-5 text-center">
        <div className="alert alert-danger fw-bold">⛔ ADMIN ACCESS ONLY</div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-3 text-uppercase">
      <div className="mb-3">
        <h2 className="fw-bold mb-0">⚠️ EXCHANGE CREDIT ISSUES</h2>
        <div className="small text-muted fw-normal mt-1" style={{ textTransform: 'none' }}>
          Old-mobile purchases where "Adjust against existing balance" exchange credit was silently cancelled
          instead of reducing what the customer owed — a bug fixed on 1 Oct 2026. Review each one and resolve it.
          {!loading && <> <strong>{rows.length}</strong> open.</>}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-5 text-muted fw-bold">LOADING…</div>
      ) : rows.length === 0 ? (
        <div className="card border-0 shadow-sm">
          <div className="card-body text-center py-5">
            <div style={{ fontSize: '2rem' }}>🎉</div>
            <div className="fw-bold text-success mt-2">No open issues — all clear.</div>
          </div>
        </div>
      ) : (
        <div className="card border-0 shadow-sm">
          <div className="table-responsive">
            <table className="table table-sm table-hover align-middle mb-0" style={{ fontSize: '0.85rem' }}>
              <thead className="table-light">
                <tr>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Model / IMEI</th>
                  <th className="text-end">Purchase Price</th>
                  <th className="text-end">Credit Lost</th>
                  <th className="text-end">Balance Now</th>
                  <th>Recorded By</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id}>
                    <td>{fmtDate(r.purchase_date)}</td>
                    <td>
                      <div className="fw-bold">{r.customer_name || '—'}</div>
                      <div className="text-muted" style={{ fontSize: '0.75rem' }}>{r.customer_phone || ''}</div>
                    </td>
                    <td>
                      <div>{r.model_name}</div>
                      {r.imei && <div className="text-muted" style={{ fontSize: '0.75rem' }}>{r.imei}</div>}
                    </td>
                    <td className="text-end">{money(r.purchase_price)}</td>
                    <td className="text-end fw-bold text-danger">{money(r.credit_amount)}</td>
                    <td className="text-end">{r.current_balance != null ? money(r.current_balance) : '—'}</td>
                    <td style={{ textTransform: 'none' }}>{r.recorded_by || '—'}</td>
                    <td className="text-center">
                      <div className="d-flex gap-1 justify-content-center flex-wrap">
                        {r.customer_id && (
                          <Link
                            to={`/accounts/entity-ledger?id=${r.entity_id || ''}&name=${encodeURIComponent(r.customer_name || '')}`}
                            className="btn btn-sm btn-outline-secondary fw-bold"
                          >
                            View
                          </Link>
                        )}
                        <button className="btn btn-sm btn-primary fw-bold" onClick={() => openResolve(r)}>
                          Resolve
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Resolve modal — full set of options per row */}
      <Modal show={!!picked} onHide={closeResolve} centered className="text-uppercase">
        <Modal.Header closeButton>
          <Modal.Title className="fw-bold small">
            🔍 Resolve — {picked?.model_name} ({picked?.customer_name})
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4" style={{ textTransform: 'none' }}>
          <p className="mb-3">
            <strong>{picked?.customer_name}</strong> was supposed to get <strong className="text-success">{money(picked?.credit_amount)}</strong> credit
            for this trade-in, but it never reduced what they owe. Their balance is currently <strong>{money(picked?.current_balance)}</strong>. How should this be fixed?
          </p>
          <div className="d-grid gap-2 mb-3">
            <Button
              variant={action === 'credit_ledger' ? 'success' : 'outline-success'}
              className="fw-bold text-start py-3"
              onClick={() => setAction('credit_ledger')}
            >
              ✅ Credit their ledger now — {money(picked?.credit_amount)}
              <div className="x-small fw-normal text-muted mt-1">
                Posts the missing credit today. Balance drops from {money(picked?.current_balance)} to {money((picked?.current_balance || 0) - (picked?.credit_amount || 0))}.
              </div>
            </Button>
            <Button
              variant={action === 'move_to_wallet' ? 'primary' : 'outline-primary'}
              className="fw-bold text-start py-3"
              onClick={() => setAction('move_to_wallet')}
            >
              🔒 Move it to their wallet instead — {money(picked?.credit_amount)}
              <div className="x-small fw-normal text-muted mt-1">
                Doesn't touch their current balance — banks it as exchange credit for their next purchase.
              </div>
            </Button>
            <Button
              variant={action === 'ignore' ? 'secondary' : 'outline-secondary'}
              className="fw-bold text-start py-3"
              onClick={() => setAction('ignore')}
            >
              🙈 Ignore — already handled elsewhere
              <div className="x-small fw-normal text-muted mt-1">
                No money moves. Use this if you already sorted it out another way (e.g. gave cash by hand).
              </div>
            </Button>
          </div>
          <label className="small fw-bold text-muted">Note (optional)</label>
          <textarea
            className="form-control"
            rows={2}
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Anything worth remembering about this one…"
            style={{ textTransform: 'none' }}
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" className="fw-bold" onClick={closeResolve} disabled={saving}>Cancel</Button>
          <Button variant="dark" className="fw-bold px-4" onClick={submitResolve} disabled={!action || saving}>
            {saving ? 'SAVING…' : 'CONFIRM'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
