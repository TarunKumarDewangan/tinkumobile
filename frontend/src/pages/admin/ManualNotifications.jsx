import { useState } from 'react';
import api from '../../api/axios';
import { toast } from 'react-toastify';

const REPORTS = [
  {
    key: 'daily-summary',
    icon: '🌙',
    title: 'Daily Summary',
    description: 'Sales, cash/bank collections, and stock alerts — normally sent automatically at 5 PM and 9 PM.',
    endpoint: '/notifications/send-daily-summary',
    hasSlot: true,
  },
  {
    key: 'emi-reminder',
    icon: '📅',
    title: 'EMI Due Reminder',
    description: 'Overdue and soon-due Personal EMI installments — normally sent automatically at 10 AM and 2 PM.',
    endpoint: '/notifications/send-emi-reminder',
    hasSlot: false,
  },
  {
    key: 'repair-reminder',
    icon: '🔧',
    title: 'Repair Status Reminder',
    description: 'Full list of every repair not yet delivered — normally sent automatically every 2 hours.',
    endpoint: '/notifications/send-repair-reminder',
    hasSlot: false,
  },
];

export default function ManualNotifications() {
  const [sending, setSending] = useState({});
  const [results, setResults] = useState({});
  const [slot, setSlot] = useState('night');

  const [pbChannels, setPbChannels] = useState({ pending_group: true, owner: false });
  const [pbSending, setPbSending] = useState(false);
  const [pbResult, setPbResult] = useState(null);

  const togglePbChannel = (key) => setPbChannels(c => ({ ...c, [key]: !c[key] }));

  const sendPendingBalanceNow = async () => {
    const channels = Object.entries(pbChannels).filter(([, v]) => v).map(([k]) => k);
    if (channels.length === 0) {
      toast.warning('Select at least one group to send to');
      return;
    }
    setPbSending(true);
    try {
      const { data } = await api.post('/notifications/send-pending-balance-summary', { channels });
      setPbResult(data);
      toast.success(`Pending Balance summary sent (Pending Group: ${data.pending_group ? 'yes' : 'no'}, Owner: ${data.owner ? 'yes' : 'no'})`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send Pending Balance summary');
    } finally {
      setPbSending(false);
    }
  };

  const sendNow = async (report) => {
    setSending(s => ({ ...s, [report.key]: true }));
    try {
      const payload = report.hasSlot ? { slot } : {};
      const { data } = await api.post(report.endpoint, payload);
      setResults(r => ({ ...r, [report.key]: data }));
      toast.success(`${report.title} sent (WhatsApp: ${data.whatsapp ? 'yes' : 'no'}, Telegram: ${data.telegram ? 'yes' : 'no'})`);
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to send ${report.title}`);
    } finally {
      setSending(s => ({ ...s, [report.key]: false }));
    }
  };

  return (
    <div className="container-fluid py-4">
      <div className="page-header mb-3">
        <h2 className="mb-0 fw-bold">📨 Send Reports Now</h2>
        <p className="text-muted small mb-0">
          Manually trigger any report right now, on top of its normal schedule — the automatic timing is unchanged.
        </p>
      </div>

      <div className="row g-3">
        {REPORTS.map(report => {
          const result = results[report.key];
          const isSending = sending[report.key];
          return (
            <div key={report.key} className="col-12 col-lg-6">
              <div className="card shadow-sm border-0 h-100">
                <div className="card-header bg-dark text-white py-3">
                  <h5 className="card-title mb-0">{report.icon} {report.title}</h5>
                </div>
                <div className="card-body p-4">
                  <p className="text-muted small">{report.description}</p>

                  {report.hasSlot && (
                    <div className="mb-3">
                      <label className="form-label fw-bold small text-uppercase">Header Style</label>
                      <select className="form-select form-select-sm" value={slot} onChange={e => setSlot(e.target.value)}>
                        <option value="afternoon">🕔 Afternoon Update</option>
                        <option value="night">🌙 Night Closing Summary</option>
                      </select>
                    </div>
                  )}

                  <button
                    className="btn btn-primary fw-bold w-100"
                    disabled={isSending}
                    onClick={() => sendNow(report)}
                  >
                    {isSending ? <span className="spinner-border spinner-border-sm me-2" /> : '🚀 '}
                    Send Now
                  </button>

                  {result && (
                    <div className="mt-3">
                      <div className="d-flex gap-2 mb-2">
                        <span className={`badge ${result.whatsapp ? 'bg-success' : 'bg-secondary'}`}>
                          WhatsApp: {result.whatsapp ? 'Sent' : 'Not sent'}
                        </span>
                        <span className={`badge ${result.telegram ? 'bg-success' : 'bg-secondary'}`}>
                          Telegram: {result.telegram ? 'Sent' : 'Not sent'}
                        </span>
                      </div>
                      <label className="form-label fw-bold small text-uppercase text-muted">Message Sent</label>
                      <pre
                        className="bg-light border rounded p-3 small"
                        style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 400, overflowY: 'auto' }}
                      >
                        {result.message}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        <div className="col-12 col-lg-6">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-header bg-dark text-white py-3">
              <h5 className="card-title mb-0">📋 Pending Balance + Promise to Pay + Personal Finance</h5>
            </div>
            <div className="card-body p-4">
              <p className="text-muted small">
                Name - Mobile - Amount list, sent as three separate messages: Pending Balance, Promise to Pay, and Personal Finance Due — normally sent automatically at 9 AM to the Pending Balance group.
              </p>

              <div className="mb-3">
                <label className="form-label fw-bold small text-uppercase">Send To</label>
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="pbChannelGroup"
                    checked={pbChannels.pending_group}
                    onChange={() => togglePbChannel('pending_group')}
                  />
                  <label className="form-check-label small" htmlFor="pbChannelGroup">Pending Balance Group</label>
                </div>
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="pbChannelOwner"
                    checked={pbChannels.owner}
                    onChange={() => togglePbChannel('owner')}
                  />
                  <label className="form-check-label small" htmlFor="pbChannelOwner">Main Telegram (Owner Chat/Channel)</label>
                </div>
              </div>

              <button
                className="btn btn-primary fw-bold w-100"
                disabled={pbSending}
                onClick={sendPendingBalanceNow}
              >
                {pbSending ? <span className="spinner-border spinner-border-sm me-2" /> : '🚀 '}
                Send Now
              </button>

              {pbResult && (
                <div className="mt-3">
                  <div className="d-flex gap-2 mb-2">
                    <span className={`badge ${pbResult.pending_group ? 'bg-success' : 'bg-secondary'}`}>
                      Pending Group: {pbResult.pending_group ? 'Sent' : 'Not sent'}
                    </span>
                    <span className={`badge ${pbResult.owner ? 'bg-success' : 'bg-secondary'}`}>
                      Owner: {pbResult.owner ? 'Sent' : 'Not sent'}
                    </span>
                  </div>
                  <label className="form-label fw-bold small text-uppercase text-muted">Message Sent</label>
                  <pre
                    className="bg-light border rounded p-3 small"
                    style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 400, overflowY: 'auto' }}
                  >
                    {pbResult.message}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
