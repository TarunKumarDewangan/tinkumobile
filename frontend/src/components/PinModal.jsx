import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import pinGate from '../utils/pinGate';

const KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

export default function PinModal() {
  const [visible, setVisible] = useState(false);
  const [pin, setPin]         = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const show = useCallback(() => {
    setPin('');
    setError('');
    setLoading(false);
    setVisible(true);
  }, []);

  useEffect(() => {
    pinGate.register(show);
  }, [show]);

  const press = (k) => {
    if (loading) return;
    if (k === '⌫') {
      setPin(p => p.slice(0, -1));
      setError('');
    } else if (k === '') {
      // blank key (placeholder)
    } else if (pin.length < 8) {
      setPin(p => p + k);
      setError('');
    }
  };

  const cancel = () => {
    setVisible(false);
    pinGate.resolve(false);
  };

  const verify = async () => {
    if (pin.length < 4) { setError('PIN must be at least 4 digits'); return; }
    setLoading(true);
    try {
      const { data } = await api.post('/settings/verify-pin', { pin });
      setVisible(false);
      pinGate.resolve(true, data.pin_token);
    } catch {
      setError('Wrong PIN. Try again.');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  // Keyboard support
  useEffect(() => {
    if (!visible) return;
    const handler = (e) => {
      if (e.key >= '0' && e.key <= '9') press(e.key);
      else if (e.key === 'Backspace') press('⌫');
      else if (e.key === 'Enter') verify();
      else if (e.key === 'Escape') cancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  if (!visible) return null;

  const dots = Array.from({ length: 8 }, (_, i) => (
    <div key={i} style={{
      width: 12, height: 12, borderRadius: '50%',
      background: i < pin.length ? '#1e293b' : '#e2e8f0',
      transition: 'background .15s',
    }} />
  ));

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="pin-modal-title" style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,.55)', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: '28px 24px',
        width: 300, boxShadow: '0 20px 60px rgba(0,0,0,.3)',
        textAlign: 'center',
      }}>
        {/* Header */}
        <div aria-hidden="true" style={{ fontSize: '2rem', marginBottom: 4 }}>🔐</div>
        <div id="pin-modal-title" style={{ fontWeight: 900, fontSize: '.95rem', textTransform: 'uppercase', letterSpacing: 1, color: '#1e293b' }}>
          Enter Action PIN
        </div>
        <div style={{ fontSize: '.7rem', color: '#64748b', marginBottom: 20 }}>
          This action requires authorization
        </div>

        {/* Dots */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
          {dots}
        </div>

        {/* Error */}
        {error && (
          <div style={{ fontSize: '.72rem', color: '#dc2626', fontWeight: 700, marginBottom: 10 }}>
            {error}
          </div>
        )}

        {/* Keypad */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16,
        }}>
          {KEYS.map((k, i) => (
            <button key={i} onClick={() => press(k)} disabled={loading || k === ''}
              aria-label={k === '⌫' ? 'Backspace' : (k === '' ? undefined : `Digit ${k}`)}
              aria-hidden={k === '' ? 'true' : undefined}
              tabIndex={k === '' ? -1 : undefined}
              style={{
                height: 52, fontSize: k === '⌫' ? '1.1rem' : '1.2rem',
                fontWeight: 700, border: '1.5px solid #e2e8f0',
                borderRadius: 10, cursor: k ? 'pointer' : 'default',
                background: k === '' ? 'transparent' : '#f8fafc',
                color: '#1e293b', transition: 'background .1s',
                opacity: k === '' ? 0 : 1,
              }}
              onMouseEnter={e => { if (k) e.currentTarget.style.background = '#e2e8f0'; }}
              onMouseLeave={e => { if (k) e.currentTarget.style.background = '#f8fafc'; }}
            >
              {k}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={cancel} disabled={loading}
            style={{
              flex: 1, height: 42, fontWeight: 700, fontSize: '.8rem',
              border: '1.5px solid #e2e8f0', borderRadius: 10,
              background: '#fff', color: '#64748b', cursor: 'pointer',
              textTransform: 'uppercase',
            }}>
            Cancel
          </button>
          <button onClick={verify} disabled={loading || pin.length < 4}
            style={{
              flex: 2, height: 42, fontWeight: 800, fontSize: '.8rem',
              border: 'none', borderRadius: 10,
              background: pin.length >= 4 ? '#1e293b' : '#94a3b8',
              color: '#fff', cursor: pin.length >= 4 ? 'pointer' : 'not-allowed',
              textTransform: 'uppercase',
            }}>
            {loading ? '...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
