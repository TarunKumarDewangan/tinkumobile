import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [otp, setOtp] = useState('');
  const [otpEmail, setOtpEmail] = useState(null);
  const [loading, setLoading] = useState(false);
  const { login, verifyOtp, resendOtp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await login(form.email, form.password);
      if (result?.otp_required) {
        setOtpEmail(result.email);
        toast.info('OTP sent — check Telegram');
        return;
      }
      toast.success(`Welcome back, ${result.name}!`);
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await verifyOtp(otpEmail, otp);
      toast.success(`Welcome back, ${user.name}!`);
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.errors?.otp?.[0] || 'Invalid or expired code');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      await resendOtp(otpEmail);
      toast.success('A new code has been sent');
    } catch (err) {
      toast.error('Could not resend code');
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">📱 Tinku<span>Mobiles</span></div>
        <p className="text-center text-muted mb-4" style={{ fontSize: '0.88rem' }}>Shop Management System</p>

        {!otpEmail ? (
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label fw-semibold">Email</label>
              <input
                type="email"
                className="form-control"
                value={form.email}
                onChange={e => setForm({...form, email: e.target.value})}
                placeholder="Email address"
                required
              />
            </div>
            <div className="mb-4">
              <label className="form-label fw-semibold">Password</label>
              <input
                type="password"
                className="form-control"
                value={form.password}
                onChange={e => setForm({...form, password: e.target.value})}
                placeholder="••••••••"
                required
              />
            </div>
            <button type="submit" className="btn btn-primary w-100 py-2 fw-semibold" disabled={loading}>
              {loading ? <span className="spinner-border spinner-border-sm me-2" /> : null}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp}>
            <p className="text-center text-muted mb-3" style={{ fontSize: '0.85rem' }}>
              🔐 Enter the 6-digit code sent to Telegram
            </p>
            <div className="mb-4">
              <label className="form-label fw-semibold">OTP Code</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                className="form-control text-center fw-bold"
                style={{ fontSize: '1.4rem', letterSpacing: '0.3em' }}
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                autoFocus
                required
              />
            </div>
            <button type="submit" className="btn btn-primary w-100 py-2 fw-semibold" disabled={loading || otp.length !== 6}>
              {loading ? <span className="spinner-border spinner-border-sm me-2" /> : null}
              {loading ? 'Verifying...' : 'Verify & Sign In'}
            </button>
            <div className="d-flex justify-content-between mt-3">
              <button type="button" className="btn btn-link btn-sm p-0 text-muted" onClick={() => { setOtpEmail(null); setOtp(''); }}>
                ← Back
              </button>
              <button type="button" className="btn btn-link btn-sm p-0" onClick={handleResend}>
                Resend Code
              </button>
            </div>
          </form>
        )}

        <div className="text-center mt-3">
          <Link to="/repair" className="text-muted" style={{ fontSize: '0.82rem' }}>
            📲 Submit a Repair Request
          </Link>
        </div>
      </div>
    </div>
  );
}
