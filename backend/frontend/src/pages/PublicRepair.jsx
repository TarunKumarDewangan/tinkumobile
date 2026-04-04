import { useState } from 'react';
import { toast } from 'react-toastify';
import api from '../api/axios';

export default function PublicRepair() {
  const [form, setForm] = useState({
    shop_id: 1, customer_name: '', customer_phone: '', customer_email: '', device_model: '', issue_description: ''
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/repair-request', form);
      setSubmitted(true);
    } catch (e) {
      toast.error('Failed to submit. Please try again.');
    } finally { setLoading(false); }
  };

  const f = (field) => ({ value: form[field], onChange: e => setForm({ ...form, [field]: e.target.value }) });

  if (submitted) return (
    <div className="repair-public">
      <div className="repair-public-card text-center">
        <div style={{ fontSize: '3.5rem' }}>✅</div>
        <h3 className="fw-bold mt-3">Request Submitted!</h3>
        <p className="text-muted">We've received your repair request. Our team will contact you shortly.</p>
        <button className="btn btn-primary mt-2" onClick={() => setSubmitted(false)}>Submit Another</button>
      </div>
    </div>
  );

  return (
    <div className="repair-public">
      <div className="repair-public-card">
        <div className="text-center mb-4">
          <div style={{ fontSize: '2.5rem' }}>🔧</div>
          <h3 className="fw-bold">📱 TinkuMobiles</h3>
          <p className="text-muted">Device Repair Request</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label fw-semibold">Your Name *</label>
              <input className="form-control" required placeholder="Full name" {...f('customer_name')} />
            </div>
            <div className="col-md-6">
              <label className="form-label fw-semibold">Phone Number *</label>
              <input className="form-control" required placeholder="10-digit mobile" {...f('customer_phone')} />
            </div>
            <div className="col-12">
              <label className="form-label fw-semibold">Email (optional)</label>
              <input className="form-control" type="email" placeholder="your@email.com" {...f('customer_email')} />
            </div>
            <div className="col-12">
              <label className="form-label fw-semibold">Device Model *</label>
              <input className="form-control" required placeholder="e.g. Samsung Galaxy A54" {...f('device_model')} />
            </div>
            <div className="col-12">
              <label className="form-label fw-semibold">Describe the Issue *</label>
              <textarea className="form-control" rows={4} required
                placeholder="e.g. Screen cracked, battery drains fast, phone not turning on..."
                value={form.issue_description} onChange={e => setForm({ ...form, issue_description: e.target.value })} />
            </div>
          </div>
          <button type="submit" className="btn btn-primary w-100 mt-4 py-2 fw-semibold" disabled={loading}>
            {loading ? <><span className="spinner-border spinner-border-sm me-2"/>Submitting...</> : '🔧 Submit Repair Request'}
          </button>
        </form>
        <p className="text-center text-muted mt-3" style={{ fontSize: '0.82rem' }}>
          Already have an account? <a href="/login">Staff Login</a>
        </p>
      </div>
    </div>
  );
}
