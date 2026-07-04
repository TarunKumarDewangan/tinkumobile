import { useState } from 'react';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';

export default function SecuritySettings() {
  const { user } = useAuth();
  const isAdmin  = user?.is_owner || user?.roles?.includes('Admin');

  const [form, setForm]       = useState({ old_pin: '', new_pin: '', confirm_pin: '' });
  const [saving, setSaving]   = useState(false);
  const [show, setShow]       = useState({ old: false, new: false, confirm: false });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggle = (k) => setShow(s => ({ ...s, [k]: !s[k] }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.new_pin !== form.confirm_pin) { toast.error('New PIN and Confirm PIN do not match'); return; }
    if (form.new_pin.length < 4) { toast.error('New PIN must be at least 4 digits'); return; }
    setSaving(true);
    try {
      await api.post('/settings/change-pin', { old_pin: form.old_pin, new_pin: form.new_pin });
      toast.success('PIN changed successfully');
      setForm({ old_pin: '', new_pin: '', confirm_pin: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change PIN');
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="container-fluid py-4 text-center">
        <div style={{ fontSize: '3rem' }}>🔒</div>
        <p className="fw-bold text-uppercase text-muted">Access Restricted — Admins Only</p>
      </div>
    );
  }

  const inputStyle = {
    width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0',
    borderRadius: 8, fontSize: '.85rem', color: '#1e293b',
    outline: 'none', background: '#fff',
  };

  const fieldRow = (label, key, placeholder) => (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: '.7rem', fontWeight: 800, textTransform: 'uppercase', color: '#475569', marginBottom: 6 }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          type={show[key] ? 'text' : 'password'}
          inputMode="numeric"
          value={form[key === 'confirm' ? 'confirm_pin' : key === 'new' ? 'new_pin' : 'old_pin']}
          onChange={e => set(key === 'confirm' ? 'confirm_pin' : key === 'new' ? 'new_pin' : 'old_pin', e.target.value.replace(/\D/g, ''))}
          placeholder={placeholder}
          maxLength={8}
          style={inputStyle}
        />
        <button type="button" onClick={() => toggle(key)}
          style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '.8rem',
          }}>
          {show[key] ? '🙈' : '👁️'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="container-fluid py-3">
      <div className="page-header mb-4">
        <h2 className="fw-bold text-uppercase mb-0">🔐 Security Settings</h2>
        <p className="text-muted small mb-0 text-uppercase">Change the action PIN used to authorize deletes &amp; cancellations</p>
      </div>

      <div className="row justify-content-center">
        <div className="col-12 col-sm-8 col-md-5 col-lg-4">
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '28px 24px' }}>

            {/* Info box */}
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '12px 14px', marginBottom: 24, fontSize: '.75rem', color: '#1d4ed8', lineHeight: 1.6 }}>
              <strong>ℹ️ Action PIN</strong><br />
              The action PIN is required whenever anyone tries to cancel, delete, or perform a sensitive operation in the system.
              Only the owner or admin can change it.
            </div>

            <form onSubmit={handleSubmit}>
              {fieldRow('Current PIN', 'old', '••••')}
              {fieldRow('New PIN', 'new', 'Min 4 digits')}
              {fieldRow('Confirm New PIN', 'confirm', 'Re-enter new PIN')}

              <button type="submit" disabled={saving}
                style={{
                  width: '100%', padding: '12px', fontWeight: 800,
                  fontSize: '.85rem', textTransform: 'uppercase',
                  background: '#1e293b', color: '#fff', border: 'none',
                  borderRadius: 8, cursor: saving ? 'not-allowed' : 'pointer',
                  marginTop: 8,
                }}>
                {saving ? 'Saving...' : '🔑 Change PIN'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
