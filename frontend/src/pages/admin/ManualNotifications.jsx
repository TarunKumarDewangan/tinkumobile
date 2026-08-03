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
      </div>
    </div>
  );
}
