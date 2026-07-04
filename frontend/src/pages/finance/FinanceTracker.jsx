import { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import { formatDate } from '../../utils/formatters';

const PAYMENT_MODES = ['CASH', 'PHONEPE', 'GPAY', 'BANK / NEFT', 'OTHER'];

export default function FinanceTracker() {
  const [plans, setPlans]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState({ type: '', status: '', search: '' });

  // Financer-sale marking
  const [markingReceived, setMarkingReceived] = useState(null); // invoice id

  // Payment modal state
  const [payModal, setPayModal]   = useState(null); // plan object
  const [payForm, setPayForm]     = useState({ amount: '', payment_date: today(), payment_mode: 'CASH', emi_number: '', notes: '' });
  const [paying, setPaying]       = useState(false);

  // Settle modal state
  const [settleModal, setSettleModal] = useState(null);
  const [settleForm, setSettleForm]   = useState({ payment_date: today(), payment_mode: 'CASH', notes: '' });
  const [settling, setSettling]       = useState(false);

  // Schedule drawer
  const [scheduleModal, setScheduleModal] = useState(null); // { plan, schedule[] }
  const [schedLoading, setSchedLoading]   = useState(false);

  useEffect(() => { load(); }, [filter]);

  async function load() {
    setLoading(true);
    try {
      // Fetch shop-finance plans (Personal EMI + Favor)
      const planParams = { ...filter };
      if (filter.type === 'FINANCER') planParams.type = ''; // financer type lives separately
      const planReq = (filter.type === '' || filter.type !== 'FINANCER')
        ? api.get('/finance-plans', { params: planParams })
        : Promise.resolve({ data: [] });

      // Fetch external-financer sales (always, unless filtering by non-financer type)
      const invParams = { has_financer: 1, per_page: 500 };
      if (filter.search) invParams.search = filter.search;
      if (filter.status === 'SETTLED') invParams.finance_payment_status = 'RECEIVED';
      if (filter.status === 'ACTIVE')  invParams.finance_payment_status = 'PENDING';
      const invReq = (filter.type === '' || filter.type === 'FINANCER')
        ? api.get('/sale-invoices', { params: invParams })
        : Promise.resolve({ data: { data: [] } });

      const [planRes, invRes] = await Promise.all([planReq, invReq]);
      const invList = Array.isArray(invRes.data) ? invRes.data : (invRes.data?.data ?? []);

      // Normalize financer invoices to look like plan objects
      const financerRows = invList.map(inv => ({
        _source: 'FINANCER',
        id: `F_${inv.id}`,
        _invoice_id: inv.id,
        type: 'FINANCER',
        status: inv.finance_payment_status === 'RECEIVED' ? 'SETTLED' : 'ACTIVE',
        customer: inv.customer,
        sale_invoice: inv,
        principal: parseFloat(inv.finance_amount || 0),
        total_payable: parseFloat(inv.finance_amount || 0),
        down_payment: parseFloat(inv.down_payment || 0),
        total_paid: inv.finance_payment_status === 'RECEIVED' ? parseFloat(inv.finance_amount || 0) : 0,
        financer: inv.financer,
        payments: [],
      }));

      setPlans([...(planRes.data ?? []), ...financerRows]);
    } catch { toast.error('Failed to load finance plans'); }
    finally  { setLoading(false); }
  }

  async function markFinancerReceived(invoiceId) {
    setMarkingReceived(invoiceId);
    try {
      await api.post(`/sale-invoices/${invoiceId}/receive-finance`);
      toast.success('Finance payment marked as received');
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to update'); }
    finally { setMarkingReceived(null); }
  }

  function today() { return new Date().toISOString().slice(0, 10); }

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const active   = plans.filter(p => p.status !== 'SETTLED');
    const overdue  = plans.filter(p => p.status === 'OVERDUE');
    const personal = plans.filter(p => p.type === 'PERSONAL');
    const favor    = plans.filter(p => p.type === 'FAVOR');
    const financer = plans.filter(p => p.type === 'FINANCER');
    const totalDue = active.reduce((s, p) => s + remaining(p), 0);
    return { total: plans.length, active: active.length, overdue: overdue.length, personal: personal.length, favor: favor.length, financer: financer.length, totalDue };
  }, [plans]);

  function remaining(plan) {
    const payable = plan.type === 'PERSONAL' ? parseFloat(plan.total_payable) : parseFloat(plan.principal);
    return Math.max(0, payable - parseFloat(plan.total_paid || 0));
  }

  function nextEmiBadge(plan) {
    if (plan.type !== 'PERSONAL' || !plan.emi_start_date || !plan.tenure_months) return null;
    const paid     = plan.payments?.filter(p => p.emi_number > 0).length ?? 0;
    if (paid >= plan.tenure_months) return null;
    const nextNo   = paid + 1;
    const start    = new Date(plan.emi_start_date);
    const dueDate  = new Date(start.getFullYear(), start.getMonth() + (nextNo - 1), start.getDate());
    const overdue  = dueDate < new Date();
    return { nextNo, dueDate, overdue };
  }

  // ── Payment modal helpers ──────────────────────────────────────────────────
  function openPayModal(plan) {
    const rem    = remaining(plan);
    const next   = nextEmiBadge(plan);
    setPayForm({
      amount:       plan.type === 'PERSONAL' && plan.monthly_emi ? plan.monthly_emi : rem,
      payment_date: today(),
      payment_mode: 'CASH',
      emi_number:   next ? next.nextNo : '',
      notes:        '',
    });
    setPayModal(plan);
  }

  async function submitPayment() {
    if (!payForm.amount || parseFloat(payForm.amount) <= 0) return toast.warning('Enter a valid amount');
    setPaying(true);
    try {
      const res = await api.post(`/finance-plans/${payModal.id}/add-payment`, payForm);
      toast.success(res.data.message || 'Payment recorded');
      setPayModal(null);
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Payment failed'); }
    finally     { setPaying(false); }
  }

  // ── Settle modal ──────────────────────────────────────────────────────────
  function openSettleModal(plan) {
    setSettleForm({ payment_date: today(), payment_mode: 'CASH', notes: 'Final settlement' });
    setSettleModal(plan);
  }

  async function submitSettle() {
    setSettling(true);
    try {
      const res = await api.post(`/finance-plans/${settleModal.id}/settle`, settleForm);
      toast.success(res.data.message || 'Plan settled');
      setSettleModal(null);
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Settlement failed'); }
    finally     { setSettling(false); }
  }

  // ── Schedule drawer ────────────────────────────────────────────────────────
  async function openSchedule(plan) {
    setSchedLoading(true);
    setScheduleModal({ plan, schedule: [] });
    try {
      const { data } = await api.get(`/finance-plans/${plan.id}`);
      setScheduleModal({ plan: data.plan, schedule: data.schedule });
    } catch { toast.error('Failed to load schedule'); setScheduleModal(null); }
    finally   { setSchedLoading(false); }
  }

  const statusColor = { ACTIVE: '#16a34a', OVERDUE: '#dc2626', SETTLED: '#64748b', PENDING: '#d97706', RECEIVED: '#16a34a' };
  const statusBg    = { ACTIVE: '#f0fdf4', OVERDUE: '#fef2f2', SETTLED: '#f8fafc', PENDING: '#fffbeb', RECEIVED: '#f0fdf4' };
  const typeBg      = { PERSONAL: '#eff6ff', FAVOR: '#ecfeff', FINANCER: '#f5f3ff' };
  const typeColor   = { PERSONAL: '#1d4ed8', FAVOR: '#0891b2', FINANCER: '#7c3aed' };

  return (
    <div className="container-fluid py-3">
      <div className="page-header mb-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div>
          <h2 className="mb-0 fw-bold text-uppercase">💳 Finance Tracker</h2>
          <p className="text-muted small mb-0 text-uppercase">Personal EMI & Favor Finance — Payments & Schedules</p>
        </div>
      </div>

      {/* Stats */}
      <div className="row g-2 mb-3">
        {[
          { label: 'Total Due',     value: `₹${stats.totalDue.toLocaleString('en-IN')}`, color: '#dc2626', bg: '#fef2f2' },
          { label: 'Active Plans',  value: stats.active,   color: '#16a34a', bg: '#f0fdf4' },
          { label: 'Overdue',       value: stats.overdue,  color: '#dc2626', bg: '#fef2f2' },
          { label: 'Personal EMI',  value: stats.personal, color: '#1d4ed8', bg: '#eff6ff' },
          { label: 'Favor',         value: stats.favor,    color: '#0891b2', bg: '#ecfeff' },
          { label: 'Financer',      value: stats.financer, color: '#7c3aed', bg: '#f5f3ff' },
        ].map(s => (
          <div key={s.label} className="col-6 col-md-2">
            <div style={{background: s.bg, border:`1.5px solid ${s.color}22`, borderRadius:10, padding:'10px 14px'}}>
              <div style={{fontSize:'.6rem', fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'.5px'}}>{s.label}</div>
              <div style={{fontSize:'1.25rem', fontWeight:900, color: s.color}}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card shadow-sm mb-3 p-3" style={{border:'1px solid #e2e8f0'}}>
        <div className="row g-2 align-items-end text-uppercase">
          <div className="col-12 col-md-3">
            <label className="small text-muted fw-bold mb-1">Search Customer / Invoice</label>
            <input className="form-control form-control-sm text-uppercase" placeholder="SEARCH..."
              value={filter.search} onChange={e => setFilter(f => ({...f, search: e.target.value}))} />
          </div>
          <div className="col-6 col-md-2">
            <label className="small text-muted fw-bold mb-1">Type</label>
            <select className="form-select form-select-sm" value={filter.type} onChange={e => setFilter(f => ({...f, type: e.target.value}))}>
              <option value="">ALL TYPES</option>
              <option value="PERSONAL">PERSONAL EMI</option>
              <option value="FAVOR">FAVOR</option>
              <option value="FINANCER">FINANCER (EXTERNAL)</option>
            </select>
          </div>
          <div className="col-6 col-md-2">
            <label className="small text-muted fw-bold mb-1">Status</label>
            <select className="form-select form-select-sm" value={filter.status} onChange={e => setFilter(f => ({...f, status: e.target.value}))}>
              <option value="">ALL STATUS</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="OVERDUE">OVERDUE</option>
              <option value="SETTLED">SETTLED</option>
            </select>
          </div>
          <div className="col-12 col-md-2">
            <button className="btn btn-sm btn-outline-secondary fw-bold w-100"
              onClick={() => setFilter({ type: '', status: '', search: '' })}>RESET</button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{background:'#fff', borderRadius:10, border:'1px solid #e2e8f0', overflow:'hidden'}}>
        <div className="table-responsive">
          <table style={{width:'100%', borderCollapse:'collapse', fontSize:'.8rem'}}>
            <thead>
              <tr style={{background:'#f1f5f9', borderBottom:'2px solid #cbd5e1'}}>
                {['TYPE', 'CUSTOMER', 'PRODUCT', 'PLAN DETAILS', 'TOTAL', 'PAID', 'DUE', 'STATUS', 'ACTIONS'].map(h => (
                  <th key={h} style={{padding:'10px 12px', fontSize:'.62rem', fontWeight:700, color:'#475569', textTransform:'uppercase', letterSpacing:'1px', border:'1px solid #e2e8f0'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-5"><div className="spinner-border text-primary" /></td></tr>
              ) : plans.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-5 text-muted fw-bold text-uppercase">No Finance Plans Found</td></tr>
              ) : plans.map(plan => {
                const rem  = remaining(plan);
                const next = nextEmiBadge(plan);
                const inv  = plan.sale_invoice;
                const product = inv?.items?.[0]?.product;
                const specs = [inv?.items?.[0]?.ram, inv?.items?.[0]?.storage, inv?.items?.[0]?.color].filter(Boolean).join('/');
                const isFinancer = plan.type === 'FINANCER';

                return (
                  <tr key={plan.id} style={{borderBottom:'1px solid #e2e8f0', background: plan.status === 'SETTLED' ? '#fafafa' : '#fff'}}>
                    {/* Type */}
                    <td style={{padding:'10px 12px', border:'1px solid #e2e8f0'}}>
                      <span style={{background: typeBg[plan.type], color: typeColor[plan.type], fontSize:'.62rem', fontWeight:800, padding:'2px 8px', borderRadius:20, display:'inline-block'}}>
                        {plan.type === 'PERSONAL' ? '📅 EMI' : plan.type === 'FAVOR' ? '🤝 FAVOR' : '🏦 FINANCER'}
                      </span>
                      {isFinancer && plan.financer && (
                        <div style={{fontSize:'.6rem', color:'#7c3aed', fontWeight:700, marginTop:3}}>{plan.financer.name}</div>
                      )}
                    </td>

                    {/* Customer */}
                    <td style={{padding:'10px 12px', border:'1px solid #e2e8f0'}}>
                      <div className="fw-bold" style={{fontSize:'.78rem'}}>{plan.customer?.name || '—'}</div>
                      <div style={{fontSize:'.65rem', color:'#64748b'}}>📞 {plan.customer?.phone || ''}</div>
                      {inv && (
                        <div style={{fontSize:'.6rem', color:'#94a3b8', marginTop:2}}>{inv.invoice_no}</div>
                      )}
                    </td>

                    {/* Product */}
                    <td style={{padding:'10px 12px', border:'1px solid #e2e8f0', maxWidth:160}}>
                      <div className="fw-bold" style={{fontSize:'.75rem'}}>{product?.name || '—'}</div>
                      {specs && <div style={{fontSize:'.62rem', color:'#475569'}}>{specs}</div>}
                      {inv?.items?.[0]?.imei && <div style={{fontSize:'.6rem', color:'#94a3b8'}}>IMEI: {inv.items[0].imei.split(',')[0]}</div>}
                      {inv?.sale_date && <div style={{fontSize:'.6rem', color:'#94a3b8', marginTop:2}}>Sale: {formatDate(inv.sale_date)}</div>}
                    </td>

                    {/* Plan Details */}
                    <td style={{padding:'10px 12px', border:'1px solid #e2e8f0', whiteSpace:'nowrap'}}>
                      <div style={{fontSize:'.65rem', color:'#64748b'}}>
                        <div>Down: <strong>₹{parseFloat(plan.down_payment || 0).toLocaleString('en-IN')}</strong></div>
                        {plan.type === 'PERSONAL' && (
                          <>
                            <div>EMI: <strong style={{color:'#1d4ed8'}}>₹{parseFloat(plan.monthly_emi).toLocaleString('en-IN')}/mo</strong></div>
                            <div>{plan.tenure_months} months @ {plan.interest_rate || 0}% p.a.</div>
                            {next && (
                              <div style={{marginTop:3, color: next.overdue ? '#dc2626' : '#16a34a', fontWeight:700}}>
                                EMI #{next.nextNo} due: {formatDate(next.dueDate.toISOString().slice(0,10))}
                                {next.overdue && ' ⚠️'}
                              </div>
                            )}
                          </>
                        )}
                        {plan.type === 'FAVOR' && (
                          <div style={{color:'#0891b2'}}>Flexible repayment</div>
                        )}
                        {isFinancer && (
                          <div style={{color:'#7c3aed'}}>
                            Finance: <strong>₹{parseFloat(plan.principal).toLocaleString('en-IN')}</strong>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Total */}
                    <td style={{padding:'10px 12px', border:'1px solid #e2e8f0', textAlign:'right', whiteSpace:'nowrap'}}>
                      <div className="fw-bold">₹{parseFloat(plan.type === 'PERSONAL' ? plan.total_payable : plan.principal).toLocaleString('en-IN')}</div>
                      <div style={{fontSize:'.62rem', color:'#64748b'}}>Principal: ₹{parseFloat(plan.principal).toLocaleString('en-IN')}</div>
                    </td>

                    {/* Paid */}
                    <td style={{padding:'10px 12px', border:'1px solid #e2e8f0', textAlign:'right', whiteSpace:'nowrap', color:'#16a34a', fontWeight:700}}>
                      ₹{parseFloat(plan.total_paid || 0).toLocaleString('en-IN')}
                      {!isFinancer && <div style={{fontSize:'.6rem', color:'#94a3b8', fontWeight:400}}>{plan.payments?.length || 0} payment(s)</div>}
                    </td>

                    {/* Due */}
                    <td style={{padding:'10px 12px', border:'1px solid #e2e8f0', textAlign:'right', whiteSpace:'nowrap',
                        color: rem > 0 ? '#dc2626' : '#16a34a', fontWeight:700}}>
                      ₹{rem.toLocaleString('en-IN')}
                    </td>

                    {/* Status */}
                    <td style={{padding:'10px 12px', border:'1px solid #e2e8f0', textAlign:'center'}}>
                      {isFinancer ? (
                        <span style={{
                          background: statusBg[plan.status === 'SETTLED' ? 'RECEIVED' : 'PENDING'],
                          color: statusColor[plan.status === 'SETTLED' ? 'RECEIVED' : 'PENDING'],
                          fontSize:'.62rem', fontWeight:800, padding:'3px 10px', borderRadius:20, display:'inline-block', textTransform:'uppercase'
                        }}>
                          {plan.status === 'SETTLED' ? 'RECEIVED' : 'PENDING'}
                        </span>
                      ) : (
                        <span style={{background: statusBg[plan.status], color: statusColor[plan.status], fontSize:'.62rem', fontWeight:800, padding:'3px 10px', borderRadius:20, display:'inline-block', textTransform:'uppercase'}}>
                          {plan.status}
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{padding:'10px 12px', border:'1px solid #e2e8f0'}}>
                      <div className="d-flex flex-column gap-1" style={{minWidth:100}}>
                        {isFinancer ? (
                          plan.status !== 'SETTLED' && (
                            <button
                              onClick={() => markFinancerReceived(plan._invoice_id)}
                              disabled={markingReceived === plan._invoice_id}
                              style={{padding:'3px 10px', fontSize:'.65rem', fontWeight:800, background:'#7c3aed', color:'#fff', border:'none', borderRadius:6, cursor:'pointer'}}>
                              {markingReceived === plan._invoice_id ? '...' : '✅ MARK RECEIVED'}
                            </button>
                          )
                        ) : (
                          <>
                            {plan.status !== 'SETTLED' && (
                              <>
                                <button onClick={() => openPayModal(plan)}
                                  style={{padding:'3px 10px', fontSize:'.65rem', fontWeight:800, background:'#1d4ed8', color:'#fff', border:'none', borderRadius:6, cursor:'pointer'}}>
                                  💰 PAY
                                </button>
                                <button onClick={() => openSettleModal(plan)}
                                  style={{padding:'3px 10px', fontSize:'.65rem', fontWeight:800, background:'#16a34a', color:'#fff', border:'none', borderRadius:6, cursor:'pointer'}}>
                                  ✅ SETTLE
                                </button>
                              </>
                            )}
                            {plan.type === 'PERSONAL' && (
                              <button onClick={() => openSchedule(plan)}
                                style={{padding:'3px 10px', fontSize:'.65rem', fontWeight:800, background:'#f1f5f9', color:'#475569', border:'1px solid #cbd5e1', borderRadius:6, cursor:'pointer'}}>
                                📅 SCHEDULE
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Payment Modal ──────────────────────────────────────────────────── */}
      {payModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:1050,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={() => setPayModal(null)}>
          <div style={{background:'#fff',borderRadius:16,padding:'24px 28px',maxWidth:420,width:'95%',boxShadow:'0 20px 60px rgba(0,0,0,.25)'}} onClick={e => e.stopPropagation()}>
            <div style={{fontWeight:800, fontSize:'1rem', marginBottom:4}}>💰 Record Payment</div>
            <div style={{fontSize:'.75rem', color:'#64748b', marginBottom:16}}>
              {payModal.customer?.name} — {payModal.type === 'PERSONAL' ? `EMI #${payForm.emi_number || '?'}` : 'Favor Payment'}
            </div>

            <div className="mb-3">
              <label className="x-small fw-bold text-uppercase text-muted mb-1">Amount (₹)</label>
              <input type="number" step="0.01" min="0.01" className="form-control fw-bold" style={{fontSize:'1.3rem', color:'#1d4ed8'}}
                value={payForm.amount} onFocus={e => e.target.select()}
                onChange={e => setPayForm(f => ({...f, amount: e.target.value}))} />
              <div className="x-small text-muted mt-1">
                Due: ₹{remaining(payModal).toLocaleString('en-IN')}
                {payModal.type === 'PERSONAL' && payModal.monthly_emi ? ` | EMI: ₹${parseFloat(payModal.monthly_emi).toLocaleString('en-IN')}` : ''}
              </div>
            </div>

            <div className="row g-2 mb-3">
              <div className="col-6">
                <label className="x-small fw-bold text-uppercase text-muted mb-1">Payment Date</label>
                <input type="date" className="form-control form-control-sm" value={payForm.payment_date}
                  onChange={e => setPayForm(f => ({...f, payment_date: e.target.value}))} />
              </div>
              <div className="col-6">
                <label className="x-small fw-bold text-uppercase text-muted mb-1">Mode</label>
                <select className="form-select form-select-sm fw-bold" value={payForm.payment_mode}
                  onChange={e => setPayForm(f => ({...f, payment_mode: e.target.value}))}>
                  {PAYMENT_MODES.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
            </div>

            {payModal.type === 'PERSONAL' && (
              <div className="mb-3">
                <label className="x-small fw-bold text-uppercase text-muted mb-1">EMI Number (which EMI this clears)</label>
                <input type="number" step="1" min="1" className="form-control form-control-sm"
                  value={payForm.emi_number} onChange={e => setPayForm(f => ({...f, emi_number: e.target.value}))} />
              </div>
            )}

            <div className="mb-3">
              <label className="x-small fw-bold text-uppercase text-muted mb-1">Notes</label>
              <input type="text" className="form-control form-control-sm" placeholder="Optional..."
                value={payForm.notes} onChange={e => setPayForm(f => ({...f, notes: e.target.value}))} />
            </div>

            <div className="d-flex gap-2 justify-content-end">
              <button onClick={() => setPayModal(null)} style={{padding:'7px 18px', fontSize:'.8rem', border:'1.5px solid #e2e8f0', background:'#f8fafc', borderRadius:8, fontWeight:700, cursor:'pointer'}}>Cancel</button>
              <button onClick={submitPayment} disabled={paying}
                style={{padding:'7px 18px', fontSize:'.8rem', background:'#1d4ed8', color:'#fff', border:'none', borderRadius:8, fontWeight:800, cursor:'pointer'}}>
                {paying ? 'Saving...' : '💰 Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Settle Modal ──────────────────────────────────────────────────── */}
      {settleModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:1050,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={() => setSettleModal(null)}>
          <div style={{background:'#fff',borderRadius:16,padding:'24px 28px',maxWidth:400,width:'95%',boxShadow:'0 20px 60px rgba(0,0,0,.25)'}} onClick={e => e.stopPropagation()}>
            <div style={{fontWeight:800, fontSize:'1rem', marginBottom:4}}>✅ Settle Finance Plan</div>
            <div style={{fontSize:'.78rem', color:'#475569', marginBottom:4}}>
              Customer: <strong>{settleModal.customer?.name}</strong>
            </div>
            <div style={{fontSize:'.78rem', color:'#dc2626', fontWeight:700, marginBottom:16}}>
              Remaining: ₹{remaining(settleModal).toLocaleString('en-IN')}
            </div>
            {remaining(settleModal) > 0.01 && (
              <div style={{background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:8, padding:'8px 12px', marginBottom:16, fontSize:'.75rem', color:'#dc2626', fontWeight:600}}>
                The remaining ₹{remaining(settleModal).toLocaleString('en-IN')} will be recorded as a final payment.
              </div>
            )}
            <div className="row g-2 mb-3">
              <div className="col-6">
                <label className="x-small fw-bold text-uppercase text-muted mb-1">Date</label>
                <input type="date" className="form-control form-control-sm" value={settleForm.payment_date}
                  onChange={e => setSettleForm(f => ({...f, payment_date: e.target.value}))} />
              </div>
              <div className="col-6">
                <label className="x-small fw-bold text-uppercase text-muted mb-1">Mode</label>
                <select className="form-select form-select-sm fw-bold" value={settleForm.payment_mode}
                  onChange={e => setSettleForm(f => ({...f, payment_mode: e.target.value}))}>
                  {PAYMENT_MODES.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div className="mb-3">
              <label className="x-small fw-bold text-uppercase text-muted mb-1">Notes</label>
              <input type="text" className="form-control form-control-sm" value={settleForm.notes}
                onChange={e => setSettleForm(f => ({...f, notes: e.target.value}))} />
            </div>
            <div className="d-flex gap-2 justify-content-end">
              <button onClick={() => setSettleModal(null)} style={{padding:'7px 18px', fontSize:'.8rem', border:'1.5px solid #e2e8f0', background:'#f8fafc', borderRadius:8, fontWeight:700, cursor:'pointer'}}>Cancel</button>
              <button onClick={submitSettle} disabled={settling}
                style={{padding:'7px 18px', fontSize:'.8rem', background:'#16a34a', color:'#fff', border:'none', borderRadius:8, fontWeight:800, cursor:'pointer'}}>
                {settling ? 'Settling...' : '✅ Confirm Settle'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Schedule Drawer ────────────────────────────────────────────────── */}
      {scheduleModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:1050,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={() => setScheduleModal(null)}>
          <div style={{background:'#fff',borderRadius:16,padding:'24px',maxWidth:520,width:'95%',maxHeight:'85vh',overflowY:'auto',boxShadow:'0 20px 60px rgba(0,0,0,.25)'}} onClick={e => e.stopPropagation()}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <div style={{fontWeight:800, fontSize:'1rem'}}>📅 EMI Schedule</div>
                <div style={{fontSize:'.75rem', color:'#64748b'}}>{scheduleModal.plan?.customer?.name}</div>
              </div>
              <button onClick={() => setScheduleModal(null)} style={{background:'none', border:'none', fontSize:'1.3rem', cursor:'pointer', color:'#64748b'}}>×</button>
            </div>

            {scheduleModal.plan && (
              <div style={{background:'#eff6ff', borderRadius:8, padding:'10px 14px', marginBottom:16, fontSize:'.73rem'}}>
                <div className="d-flex justify-content-between">
                  <span>Principal: <strong>₹{parseFloat(scheduleModal.plan.principal).toLocaleString('en-IN')}</strong></span>
                  <span>Rate: <strong>{scheduleModal.plan.interest_rate || 0}% p.a.</strong></span>
                  <span>EMI: <strong style={{color:'#1d4ed8'}}>₹{parseFloat(scheduleModal.plan.monthly_emi).toLocaleString('en-IN')}</strong></span>
                </div>
                <div className="d-flex justify-content-between mt-1">
                  <span>Tenure: <strong>{scheduleModal.plan.tenure_months} months</strong></span>
                  <span>Total Payable: <strong>₹{parseFloat(scheduleModal.plan.total_payable).toLocaleString('en-IN')}</strong></span>
                  <span>Paid: <strong style={{color:'#16a34a'}}>₹{parseFloat(scheduleModal.plan.total_paid).toLocaleString('en-IN')}</strong></span>
                </div>
              </div>
            )}

            {schedLoading ? (
              <div className="text-center py-4"><div className="spinner-border text-primary" /></div>
            ) : scheduleModal.schedule?.length === 0 ? (
              <div className="text-center text-muted py-4">No schedule available</div>
            ) : (
              <table style={{width:'100%', borderCollapse:'collapse', fontSize:'.78rem'}}>
                <thead>
                  <tr style={{background:'#f1f5f9'}}>
                    {['EMI #', 'DUE DATE', 'AMOUNT', 'STATUS', 'PAID ON'].map(h => (
                      <th key={h} style={{padding:'8px 10px', fontSize:'.62rem', fontWeight:700, color:'#64748b', textAlign: h === 'AMOUNT' ? 'right' : 'left', border:'1px solid #e2e8f0'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {scheduleModal.schedule.map(row => (
                    <tr key={row.emi_no} style={{background: row.status === 'PAID' ? '#f0fdf4' : row.status === 'OVERDUE' ? '#fef2f2' : '#fff', borderBottom:'1px solid #e2e8f0'}}>
                      <td style={{padding:'7px 10px', fontWeight:700, border:'1px solid #e2e8f0'}}>#{row.emi_no}</td>
                      <td style={{padding:'7px 10px', border:'1px solid #e2e8f0'}}>{formatDate(row.due_date)}</td>
                      <td style={{padding:'7px 10px', textAlign:'right', fontWeight:700, border:'1px solid #e2e8f0'}}>₹{parseFloat(row.amount).toLocaleString('en-IN')}</td>
                      <td style={{padding:'7px 10px', border:'1px solid #e2e8f0'}}>
                        <span style={{
                          fontSize:'.62rem', fontWeight:800, padding:'2px 8px', borderRadius:20,
                          background: row.status === 'PAID' ? '#dcfce7' : row.status === 'OVERDUE' ? '#fee2e2' : '#f1f5f9',
                          color: row.status === 'PAID' ? '#16a34a' : row.status === 'OVERDUE' ? '#dc2626' : '#64748b'
                        }}>{row.status}</span>
                      </td>
                      <td style={{padding:'7px 10px', fontSize:'.7rem', color:'#64748b', border:'1px solid #e2e8f0'}}>
                        {row.payment ? `${formatDate(row.payment.payment_date)} (${row.payment.payment_mode})` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      <style>{`.x-small { font-size: 0.65rem; }`}</style>
    </div>
  );
}
