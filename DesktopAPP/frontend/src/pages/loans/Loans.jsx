import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import { formatDate } from '../../utils/formatters';
import PaymentSplitInput from '../../components/PaymentSplitInput';
import { newSingleLine, buildPaymentPayload, paymentLinesSumMatches, buildModeOptions } from '../../utils/paymentSplit';
import { isAssetEntityType } from '../../utils/assetEntityTypes';

export default function Loans() {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bankEntities, setBankEntities] = useState([]);
  const [collectModal, setCollectModal] = useState(null); // { loan, payment, paid_date, penalty, notes }
  const [collectPaymentLines, setCollectPaymentLines] = useState(newSingleLine('CASH'));
  const [submitting, setSubmitting] = useState(false);

  const loadLoans = () => api.get('/loans').then(r => setLoans(r.data)).finally(() => setLoading(false));

  useEffect(() => {
    loadLoans();
    api.get('/entities').then(r => setBankEntities((r.data || []).filter(e => isAssetEntityType(e.type)))).catch(() => {});
  }, []);

  const modeOptions = useMemo(() => buildModeOptions(
    [{ value: 'CASH', label: 'CASH' }, { value: 'PHONEPE', label: 'PHONEPE' }, { value: 'GPAY', label: 'GPAY' }, { value: 'BANK / NEFT', label: 'BANK / NEFT' }],
    bankEntities
  ).concat([{ value: 'OTHER', label: 'OTHER' }]), [bankEntities]);

  const openCollect = (loan) => {
    const nextDue = loan.next_due;
    if (!nextDue) return;
    setCollectModal({
      loan,
      payment: nextDue,
      paid_date: new Date().toISOString().slice(0, 10),
      penalty: 0,
      notes: '',
    });
    setCollectPaymentLines(newSingleLine('CASH'));
  };

  const totalDue = collectModal ? parseFloat(collectModal.payment.amount || 0) + parseFloat(collectModal.penalty || 0) : 0;

  const handleCollect = async (e) => {
    e.preventDefault();
    if (!paymentLinesSumMatches(collectPaymentLines, totalDue)) {
      return toast.error("Split doesn't add up to the payment amount");
    }
    setSubmitting(true);
    try {
      await api.post(`/loan-payments/${collectModal.payment.id}/record`, {
        paid_date: collectModal.paid_date,
        penalty: parseFloat(collectModal.penalty) || 0,
        notes: collectModal.notes,
        ...buildPaymentPayload(collectPaymentLines),
      });
      toast.success('EMI payment collected');
      setCollectModal(null);
      loadLoans();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>💰 Loans</h2>
        <Link to="/loans/new" className="btn btn-primary btn-sm">+ New Loan</Link>
      </div>
      <div className="table-card">
        {loading ? <div className="text-center py-4"><div className="spinner-border spinner-border-sm" /></div> : (
          <table className="table table-hover mb-0">
            <thead><tr><th>Customer</th><th>Principal</th><th>Months</th><th>EMI ₹</th><th>Paid</th><th>Remaining</th><th>Status</th><th>Next Due</th><th></th></tr></thead>
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
                  <td className="text-end">
                    {l.next_due && (
                      <button className="btn btn-outline-success btn-sm fw-bold" onClick={() => openCollect(l)}>
                        Collect EMI
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {loans.length === 0 && <tr><td colSpan={9} className="text-center py-4 text-muted">No loans</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {collectModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-3">
              <div className="modal-header border-bottom p-3">
                <h5 className="modal-title fw-bold mb-0">💰 Collect EMI — {collectModal.loan.customer?.name}</h5>
                <button type="button" className="btn-close shadow-none" onClick={() => setCollectModal(null)}></button>
              </div>
              <form onSubmit={handleCollect}>
                <div className="modal-body p-3">
                  <div className="row g-3">
                    <div className="col-12 col-md-6">
                      <label className="form-label x-small fw-bold text-dark">Installment Amount (₹)</label>
                      <input type="text" className="form-control fw-bold" disabled
                        value={`₹${Number(collectModal.payment.amount).toLocaleString('en-IN')} (due ${formatDate(collectModal.payment.due_date)})`} />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label x-small fw-bold text-dark">Penalty (₹)</label>
                      <input type="number" step="0.01" className="form-control"
                        value={collectModal.penalty === 0 ? '' : collectModal.penalty}
                        onFocus={e => e.target.select()}
                        onChange={e => setCollectModal({ ...collectModal, penalty: e.target.value })} />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label x-small fw-bold text-dark">Paid Date</label>
                      <input type="date" className="form-control" required
                        value={collectModal.paid_date}
                        onChange={e => setCollectModal({ ...collectModal, paid_date: e.target.value })} />
                    </div>
                    <div className="col-12 col-md-6 d-flex align-items-end">
                      <div className="fw-bold text-primary fs-5">Total: ₹{totalDue.toLocaleString('en-IN')}</div>
                    </div>
                    <div className="col-12">
                      <label className="form-label x-small fw-bold text-dark">Payment Mode</label>
                      <PaymentSplitInput
                        totalAmount={totalDue}
                        lines={collectPaymentLines}
                        onChange={setCollectPaymentLines}
                        modeOptions={modeOptions}
                        size="x-small"
                      />
                    </div>
                    <div className="col-12">
                      <label className="form-label x-small fw-bold text-dark">Notes</label>
                      <input className="form-control" value={collectModal.notes}
                        onChange={e => setCollectModal({ ...collectModal, notes: e.target.value })} />
                    </div>
                  </div>
                </div>
                <div className="modal-footer border-top p-2 bg-light justify-content-end gap-2">
                  <button type="button" className="btn btn-outline-secondary btn-sm rounded-2 px-3 fw-bold" onClick={() => setCollectModal(null)}>Cancel</button>
                  <button type="submit" disabled={submitting} className="btn btn-success btn-sm rounded-2 px-4 fw-bold">
                    {submitting ? 'Recording...' : 'Record Payment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
