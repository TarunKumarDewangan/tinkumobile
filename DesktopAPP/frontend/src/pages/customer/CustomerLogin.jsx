import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import axios from 'axios';

export default function CustomerLogin() {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('phone'); // 'phone' | 'otp'
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${import.meta.env.VITE_API_BASE_URL}/customer/login/request-otp`, { phone });
      toast.success('A login code has been sent to your WhatsApp number.');
      setStep('otp');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not send login code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(`${import.meta.env.VITE_API_BASE_URL}/customer/login`, { phone, otp });
      localStorage.setItem('customer_info', JSON.stringify(res.data.customer));
      toast.success('Login Successful!');
      navigate(`/customer/profile/${res.data.customer.id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light p-3">
      <div className="card shadow-lg border-0" style={{ maxWidth: 400, width: '100%', borderRadius: '1.5rem' }}>
        <div className="card-body p-5">
          <div className="text-center mb-4">
            <h2 className="fw-bold text-primary mb-1">Tinku Mobiles</h2>
            <p className="text-muted small">Customer Portal Login</p>
          </div>

          {step === 'phone' ? (
            <form onSubmit={handleRequestOtp}>
              <div className="mb-4">
                <label className="form-label small fw-bold text-uppercase text-muted">Mobile Number</label>
                <input
                  type="tel"
                  className="form-control form-control-lg border-2 shadow-none"
                  placeholder="Enter 10 digit mobile"
                  required
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                />
                <div className="form-text x-small mt-2">We'll send a login code to this number on WhatsApp.</div>
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-lg w-100 fw-bold shadow-sm"
                disabled={loading}
                style={{ borderRadius: '1rem' }}
              >
                {loading ? 'Sending code...' : 'SEND LOGIN CODE'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp}>
              <div className="mb-4">
                <label className="form-label small fw-bold text-uppercase text-muted">Enter Code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength="6"
                  className="form-control form-control-lg border-2 shadow-none text-center fs-3 fw-bold"
                  placeholder="••••••"
                  required
                  value={otp}
                  onChange={e => setOtp(e.target.value)}
                />
                <div className="form-text x-small text-center mt-2">Sent to your WhatsApp — valid for 5 minutes</div>
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-lg w-100 fw-bold shadow-sm"
                disabled={loading}
                style={{ borderRadius: '1rem' }}
              >
                {loading ? 'Verifying...' : 'VIEW MY HISTORY'}
              </button>

              <button
                type="button"
                onClick={() => setStep('phone')}
                className="btn btn-link link-secondary text-decoration-none small w-100 mt-2"
              >
                ← Use a different number
              </button>
            </form>
          )}

          <div className="mt-5 text-center">
            <button onClick={() => navigate('/')} className="btn btn-link link-secondary text-decoration-none small">← Back to Main Site</button>
          </div>
        </div>
      </div>

      <style>{`
        .x-small { font-size: 0.7rem; }
        .btn-primary { background: linear-gradient(135deg, #0d6efd 0%, #004dc7 100%); }
      `}</style>
    </div>
  );
}
