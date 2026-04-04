import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../api/axios';

export default function LoanForm() {
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({ customer_id:'', principal:'', interest_rate:'', total_months:'', start_date: new Date().toISOString().slice(0,10), interest_type:'simple', notes:'' });
  const navigate = useNavigate();

  useEffect(() => { api.get('/customers').then(r => setCustomers(r.data)); }, []);

  const calcEMI = () => {
    const p = parseFloat(form.principal) || 0;
    const r = parseFloat(form.interest_rate) / 100 || 0;
    const n = parseInt(form.total_months) || 1;
    const total = form.interest_type === 'compound' ? p * Math.pow(1 + r, n) : p + (p * r * n);
    return (total / n).toFixed(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/loans', form);
      toast.success('Loan created with payment schedule!');
      navigate('/loans');
    } catch(e) { toast.error(e.response?.data?.message || 'Error'); }
  };

  const f = (field) => ({ value: form[field], onChange: e => setForm({ ...form, [field]: e.target.value }) });

  return (
    <div>
      <div className="page-header">
        <h2>➕ New Loan</h2>
        <button onClick={() => navigate('/loans')} className="btn btn-outline-secondary btn-sm">← Back</button>
      </div>
      <div className="table-card p-4" style={{ maxWidth: 600 }}>
        <form onSubmit={handleSubmit}>
          <div className="row g-3">
            <div className="col-12">
              <label className="form-label fw-semibold">Customer *</label>
              <select className="form-select" required {...f('customer_id')}>
                <option value="">Select customer</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
              </select>
            </div>
            <div className="col-md-6">
              <label className="form-label fw-semibold">Principal ₹ *</label>
              <input type="number" className="form-control" required min="1" 
                  value={form.principal === 0 || form.principal === '' ? '' : form.principal} 
                  onFocus={e => e.target.select()}
                  onChange={e => setForm({ ...form, principal: e.target.value })} 
              />
            </div>
            <div className="col-md-6">
              <label className="form-label fw-semibold">Interest Rate % / month *</label>
              <input type="number" className="form-control" step="0.01" required 
                  value={form.interest_rate === 0 || form.interest_rate === '' ? '' : form.interest_rate} 
                  onFocus={e => e.target.select()}
                  onChange={e => setForm({ ...form, interest_rate: e.target.value })} 
              />
            </div>
            <div className="col-md-6">
              <label className="form-label fw-semibold">Total Months *</label>
              <input type="number" className="form-control" min="1" required 
                  value={form.total_months === 0 || form.total_months === '' ? '' : form.total_months} 
                  onFocus={e => e.target.select()}
                  onChange={e => setForm({ ...form, total_months: e.target.value })} 
              />
            </div>
            <div className="col-md-6">
              <label className="form-label fw-semibold">Interest Type</label>
              <select className="form-select" {...f('interest_type')}>
                <option value="simple">Simple Interest</option>
                <option value="compound">Compound Interest</option>
              </select>
            </div>
            <div className="col-md-6">
              <label className="form-label fw-semibold">Start Date</label>
              <input type="date" className="form-control" {...f('start_date')} />
            </div>
            <div className="col-12">
              <label className="form-label fw-semibold">Notes</label>
              <input className="form-control" {...f('notes')} />
            </div>
          </div>
          {form.principal && form.interest_rate && form.total_months && (
            <div className="mt-3 p-3 rounded" style={{ background:'#f0f6ff' }}>
              <div className="fw-semibold">📊 Estimated Monthly EMI: <span className="text-primary fs-5">₹{calcEMI()}</span></div>
              <div className="text-muted" style={{ fontSize:'0.82rem' }}>{form.total_months} installments of ₹{calcEMI()}</div>
            </div>
          )}
          <div className="mt-4">
            <button type="submit" className="btn btn-primary me-2">Create Loan & Schedule</button>
            <button type="button" className="btn btn-outline-secondary" onClick={() => navigate('/loans')}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
