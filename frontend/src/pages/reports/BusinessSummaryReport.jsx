import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../api/axios';

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function BusinessSummaryReport() {
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/reports/business-summary', { params: { start_date: startDate, end_date: endDate } });
      setData(data);
    } catch (e) {
      toast.error('Failed to load business summary');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const downloadCsv = () => {
    if (!data) return;
    const rows = [];
    rows.push(['Business Summary Report']);
    rows.push(['Period', `${data.period.start_date} to ${data.period.end_date}`]);
    rows.push([]);
    rows.push(['Metric', 'Value']);
    rows.push(['Sale Invoices', data.sales.invoices]);
    rows.push(['Sets Sold', data.sales.sets_sold]);
    rows.push(['Sales Amount', data.sales.amount]);
    rows.push(['Purchase Invoices', data.purchases.invoices]);
    rows.push(['Purchase Amount', data.purchases.amount]);
    rows.push(['Repair Count', data.repairs.count]);
    rows.push(['Repair Income', data.repairs.income]);
    rows.push(['Recharge Sale', data.recharge.sale]);
    rows.push(['Recharge Purchase', data.recharge.purchase]);
    rows.push(['Old Mobile Purchase (Cash)', data.old_mobile.purchase]);
    rows.push(['Old Mobile Purchase (Exchange)', data.old_mobile.exchange]);
    rows.push(['Airtel Recovery', data.airtel_recovery]);
    rows.push(['Salary Paid', data.salary_paid]);
    rows.push(['Expenses', data.expenses]);
    rows.push(['Other Income', data.other_income]);
    rows.push(['Cash In', data.payments.cash_in]);
    rows.push(['Bank In', data.payments.bank_in]);
    rows.push(['Exchange In', data.payments.exchange_in]);
    rows.push(['Finance In', data.payments.finance_in]);
    rows.push(['Cash Out', data.payments.cash_out]);
    rows.push(['Bank Out', data.payments.bank_out]);
    rows.push(['Net Cash Flow', data.payments.net]);
    rows.push(['Company Finance (External EMI) Done', data.finance.company_finance_done]);
    rows.push(['Shop Finance (Personal EMI) Done', data.finance.shop_finance_done]);
    rows.push(['Cash In Hand (all-time, literal CASH mode)', data.cash_in_hand]);
    rows.push([]);
    rows.push(['Bank / Card / UPI / Cash Counter Balances']);
    rows.push(['Account', 'Type', 'Balance']);
    data.bank_balances.forEach(b => rows.push([b.name, b.type, b.net_balance]));
    rows.push([]);
    rows.push(['Day-wise Breakdown']);
    rows.push(['Date', 'Sale Invoices', 'Sets Sold', 'Sales Amount', 'Cash In', 'Bank In', 'Cash Out', 'Bank Out']);
    data.day_wise.forEach(d => rows.push([d.date, d.sale_invoices, d.sets_sold, d.sales_amount, d.cash_in, d.bank_in, d.cash_out, d.bank_out]));

    const csv = rows.map(r => r.map(cell => {
      const s = String(cell ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `business-summary-${startDate}-to-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const StatCard = ({ label, value, sub, color = '#1e293b' }) => (
    <div className="col-6 col-md-3">
      <div className="p-3 rounded-3 border h-100" style={{ background: '#fff' }}>
        <div className="text-muted text-uppercase" style={{ fontSize: '.65rem', fontWeight: 700 }}>{label}</div>
        <div className="fw-bold" style={{ fontSize: '1.15rem', color }}>{value}</div>
        {sub && <div className="text-muted" style={{ fontSize: '.68rem' }}>{sub}</div>}
      </div>
    </div>
  );

  return (
    <div className="container-fluid py-3">
      <div className="page-header mb-3 no-print d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div>
          <button className="btn btn-sm btn-outline-secondary me-2" onClick={() => navigate('/reports')}>← Back</button>
          <h2 className="d-inline mb-0">📈 Business Summary Report</h2>
        </div>
        <div className="d-flex gap-2 align-items-center flex-wrap">
          <input type="date" className="form-control form-control-sm" value={startDate} onChange={e => setStartDate(e.target.value)} />
          <span className="text-muted small">to</span>
          <input type="date" className="form-control form-control-sm" value={endDate} onChange={e => setEndDate(e.target.value)} />
          <button className="btn btn-primary btn-sm fw-bold" onClick={load} disabled={loading}>{loading ? 'Loading...' : 'Refresh'}</button>
          <button className="btn btn-outline-success btn-sm fw-bold" onClick={downloadCsv} disabled={!data}>⬇ Excel (CSV)</button>
          <button className="btn btn-outline-dark btn-sm fw-bold" onClick={() => window.print()} disabled={!data}>🖨 PDF / Print</button>
        </div>
      </div>

      {/* Print-only header */}
      <div className="d-none d-print-block text-center mb-4">
        <h2 className="fw-bold mb-1">Tinku Mobiles</h2>
        <h5 className="text-muted">Business Summary Report</h5>
        {data && <div className="small">{data.period.start_date} to {data.period.end_date}</div>}
        <hr />
      </div>

      {loading && !data ? (
        <div className="text-center py-5"><div className="spinner-border text-primary" /></div>
      ) : !data ? null : (
        <>
          <h6 className="text-uppercase text-muted fw-bold mt-2 mb-2" style={{ fontSize: '.75rem' }}>🛍️ Sales & Purchases</h6>
          <div className="row g-2 mb-3">
            <StatCard label="Sale Invoices" value={data.sales.invoices} color="#16a34a" />
            <StatCard label="Sets Sold" value={data.sales.sets_sold} color="#16a34a" />
            <StatCard label="Sales Amount" value={money(data.sales.amount)} color="#16a34a" />
            <StatCard label="Purchase Amount" value={money(data.purchases.amount)} sub={`${data.purchases.invoices} invoices`} color="#dc2626" />
          </div>

          <h6 className="text-uppercase text-muted fw-bold mt-3 mb-2" style={{ fontSize: '.75rem' }}>💵 Cash / Bank Movement</h6>
          <div className="row g-2 mb-3">
            <StatCard label="Cash In" value={money(data.payments.cash_in)} color="#16a34a" />
            <StatCard label="Bank In" value={money(data.payments.bank_in)} color="#16a34a" />
            <StatCard label="Cash Out" value={money(data.payments.cash_out)} color="#dc2626" />
            <StatCard label="Bank Out" value={money(data.payments.bank_out)} color="#dc2626" />
          </div>
          <div className="row g-2 mb-3">
            <StatCard label="Exchange Credit (IN)" value={money(data.payments.exchange_in)} sub="Old-mobile trade-in, not real cash" />
            <StatCard label="Finance Receivable (IN)" value={money(data.payments.finance_in)} sub="Unmatched to a bank account" />
            <StatCard label="Net Cash Flow" value={money(data.payments.net)} color={data.payments.net >= 0 ? '#16a34a' : '#dc2626'} />
            <StatCard label="Cash In Hand" value={money(data.cash_in_hand)} sub="All-time, literal CASH mode only — see note below" color={data.cash_in_hand >= 0 ? '#16a34a' : '#dc2626'} />
          </div>
          <div className="alert alert-warning py-2 px-3 no-print" style={{ fontSize: '.75rem' }}>
            ⚠️ "Cash In Hand" only totals transactions explicitly recorded with payment mode <strong>CASH</strong>, across all time. If older entries were recorded as CASH by default even when the real payment was by bank/UPI, this figure won't match your actual cash drawer. For a precise number going forward, always pick the actual Bank/Cash Counter account instead of generic "CASH" when it applies.
          </div>

          <h6 className="text-uppercase text-muted fw-bold mt-3 mb-2" style={{ fontSize: '.75rem' }}>🏦 Bank / Card / UPI / Cash Counter Balances</h6>
          <div className="row g-2 mb-3">
            {data.bank_balances.length === 0 ? (
              <div className="col-12 text-muted small">No Bank/Card/UPI/Cash Counter accounts set up yet.</div>
            ) : data.bank_balances.map(b => (
              <StatCard key={b.id} label={`${b.name} (${b.type})`} value={money(b.net_balance)} color={b.net_balance >= 0 ? '#16a34a' : '#dc2626'} />
            ))}
          </div>

          <h6 className="text-uppercase text-muted fw-bold mt-3 mb-2" style={{ fontSize: '.75rem' }}>💳 Finance / EMI</h6>
          <div className="row g-2 mb-3">
            <StatCard label="External Financer EMI Received" value={money(data.finance.company_finance_done)} sub="Bajaj / HDB / etc." />
            <StatCard label="Shop Finance (Personal EMI) Collected" value={money(data.finance.shop_finance_done)} sub="Down payments + EMI installments" />
          </div>

          <h6 className="text-uppercase text-muted fw-bold mt-3 mb-2" style={{ fontSize: '.75rem' }}>🔧 Other Modules</h6>
          <div className="row g-2 mb-4">
            <StatCard label="Repair Income" value={money(data.repairs.income)} sub={`${data.repairs.count} repairs booked`} />
            <StatCard label="Recharge Sale / Purchase" value={`${money(data.recharge.sale)} / ${money(data.recharge.purchase)}`} />
            <StatCard label="Old Mobile Purchase / Exchange" value={`${money(data.old_mobile.purchase)} / ${money(data.old_mobile.exchange)}`} />
            <StatCard label="Airtel Recovery" value={money(data.airtel_recovery)} />
            <StatCard label="Salary Paid" value={money(data.salary_paid)} color="#dc2626" />
            <StatCard label="Expenses (Cashbook)" value={money(data.expenses)} color="#dc2626" />
            <StatCard label="Other Income (Cashbook)" value={money(data.other_income)} color="#16a34a" />
          </div>

          <h6 className="text-uppercase text-muted fw-bold mt-3 mb-2" style={{ fontSize: '.75rem' }}>📅 Day-wise Breakdown</h6>
          <div className="card shadow-sm border-0 mb-4">
            <div className="table-responsive">
              <table className="table table-sm table-hover mb-0">
                <thead className="table-light">
                  <tr className="text-uppercase" style={{ fontSize: '.68rem' }}>
                    <th>Date</th>
                    <th className="text-end">Invoices</th>
                    <th className="text-end">Sets Sold</th>
                    <th className="text-end">Sales Amount</th>
                    <th className="text-end">Cash In</th>
                    <th className="text-end">Bank In</th>
                    <th className="text-end">Cash Out</th>
                    <th className="text-end">Bank Out</th>
                  </tr>
                </thead>
                <tbody>
                  {data.day_wise.map(d => (
                    <tr key={d.date} style={{ fontSize: '.78rem' }}>
                      <td className="fw-bold">{d.date}</td>
                      <td className="text-end">{d.sale_invoices || '—'}</td>
                      <td className="text-end">{d.sets_sold || '—'}</td>
                      <td className="text-end">{d.sales_amount ? money(d.sales_amount) : '—'}</td>
                      <td className="text-end text-success">{d.cash_in ? money(d.cash_in) : '—'}</td>
                      <td className="text-end text-success">{d.bank_in ? money(d.bank_in) : '—'}</td>
                      <td className="text-end text-danger">{d.cash_out ? money(d.cash_out) : '—'}</td>
                      <td className="text-end text-danger">{d.bank_out ? money(d.bank_out) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
        }
      `}</style>
    </div>
  );
}
