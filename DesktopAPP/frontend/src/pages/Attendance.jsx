import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import api from '../api/axios';
import FaceCapture from '../components/FaceCapture';
import AttendanceReport from './admin/AttendanceReport';

function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Geolocation not supported by this browser'));
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000 });
  });
}

function formatRemaining(ms) {
  const overdue = ms < 0;
  const abs = Math.abs(ms);
  const mins = Math.floor(abs / 60000);
  const secs = Math.floor((abs % 60000) / 1000);
  const clock = `${mins}:${String(secs).padStart(2, '0')}`;
  return overdue ? `${clock} over` : `${clock} left`;
}

export default function Attendance() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [capturing, setCapturing] = useState(false); // false | 'enroll' | 'IN' | 'OUT' | 'LUNCH_OUT' | 'LUNCH_IN'
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [showReport, setShowReport] = useState(false);
  const tickRef = useRef(null);

  const loadStatus = () => {
    setLoading(true);
    api.get('/attendance/status')
      .then(r => setStatus(r.data))
      .catch(() => toast.error('Failed to load attendance status'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadStatus(); }, []);

  useEffect(() => {
    if (status?.state === 'on_lunch') {
      tickRef.current = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(tickRef.current);
    }
  }, [status?.state]);

  const handleEnrollCapture = async ({ descriptor, photo }) => {
    setCapturing(false);
    setSubmitting(true);
    try {
      await api.post('/attendance/enroll', { descriptor, photo });
      toast.success('Face enrolled! You can now check in/out.');
      loadStatus();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Enrollment failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckCapture = (action) => async ({ descriptor, photo }) => {
    setCapturing(false);
    setSubmitting(true);
    try {
      const pos = await getPosition();
      const { data } = await api.post('/attendance/check', {
        action, descriptor, photo,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      toast.success(data.message);
      loadStatus();
    } catch (e) {
      if (e.message === 'Geolocation not supported by this browser' || e.code === 1 || e.code === 2 || e.code === 3) {
        toast.error('Could not get your location — please allow location access and try again.');
      } else {
        toast.error(e.response?.data?.message || 'Check-in/out failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="text-center py-5"><div className="spinner-border text-primary" /></div>;
  }

  const stateIcon = { not_in: '🚪', checked_in: '✅', on_lunch: '🍴' };
  const remainingMs = status?.lunch_deadline ? (new Date(status.lunch_deadline).getTime() - now) : null;

  return (
    <div>
      <div className="page-header">
        <h2>🕐 Attendance</h2>
      </div>

      <div className="table-card p-4" style={{ maxWidth: 480, margin: '0 auto' }}>
        {!status?.shop && (
          <div className="alert alert-info small mb-0">
            Your account isn't assigned to a specific shop, so there's no fixed location to check the GPS against — attendance is for shop-floor staff with a shop assigned. (Set one in Staff Details if you do want to use this.)
          </div>
        )}
        {status?.shop && !status.shop.latitude && (
          <div className="alert alert-warning small">
            Your shop's attendance location hasn't been set up yet — ask an owner/admin to set it in Shops settings before you can check in/out.
          </div>
        )}

        {capturing === 'enroll' && (
          <FaceCapture onCapture={handleEnrollCapture} onCancel={() => setCapturing(false)} />
        )}
        {(capturing === 'IN' || capturing === 'OUT' || capturing === 'LUNCH_OUT' || capturing === 'LUNCH_IN') && (
          <FaceCapture onCapture={handleCheckCapture(capturing)} onCancel={() => setCapturing(false)} />
        )}

        {!capturing && status?.shop && (
          <div className="text-center">
            {!status?.enrolled ? (
              <>
                <div className="mb-3">
                  <div className="fs-1 mb-2">🙂</div>
                  <p className="text-muted small mb-0">You haven't enrolled your face yet. This is a one-time setup — just look at the camera and hold still for a moment.</p>
                </div>
                <button className="btn btn-primary" disabled={submitting || !status?.shop} onClick={() => setCapturing('enroll')}>
                  {submitting ? 'Enrolling...' : '📷 Enroll My Face'}
                </button>
              </>
            ) : (
              <>
                <div className="mb-3">
                  <div className="fs-1 mb-2">{stateIcon[status.state]}</div>
                  <p className="text-muted small mb-1">
                    {status.last_log
                      ? `Last: ${status.last_log.type.replace('_', ' ')} at ${new Date(status.last_log.logged_at).toLocaleTimeString()}`
                      : 'No attendance yet today.'}
                  </p>
                </div>

                {status.state === 'on_lunch' && remainingMs !== null && (
                  <div className={`alert small ${remainingMs < 0 ? 'alert-danger' : 'alert-info'}`}>
                    🍴 On lunch — {formatRemaining(remainingMs)} {remainingMs < 0 ? '(late return)' : '(45 min break)'}
                  </div>
                )}

                {status.state === 'not_in' && (
                  <button
                    className="btn btn-success"
                    disabled={submitting || !status?.shop?.latitude}
                    onClick={() => setCapturing('IN')}
                  >
                    {submitting ? 'Please wait...' : '✅ Check In'}
                  </button>
                )}

                {status.state === 'checked_in' && (
                  <div className="d-flex gap-2 justify-content-center flex-wrap">
                    <button
                      className="btn btn-danger"
                      disabled={submitting || !status?.shop?.latitude}
                      onClick={() => setCapturing('OUT')}
                    >
                      {submitting ? 'Please wait...' : '🚪 Check Out'}
                    </button>
                    <button
                      className="btn btn-outline-primary"
                      disabled={submitting || !status?.shop?.latitude}
                      onClick={() => setCapturing('LUNCH_OUT')}
                    >
                      🍴 Lunch
                    </button>
                  </div>
                )}

                {status.state === 'on_lunch' && (
                  <button
                    className="btn btn-primary"
                    disabled={submitting || !status?.shop?.latitude}
                    onClick={() => setCapturing('LUNCH_IN')}
                  >
                    {submitting ? 'Please wait...' : '🍽️ Back from Lunch'}
                  </button>
                )}

                <div className="mt-3">
                  <button className="btn btn-sm btn-link text-muted" onClick={() => setCapturing('enroll')}>Re-enroll my face</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="text-center mt-3">
        <button className="btn btn-sm btn-outline-secondary" onClick={() => setShowReport(s => !s)}>
          {showReport ? '▾ Hide My Report' : '▸ My Attendance Report'}
        </button>
      </div>

      {showReport && (
        <div className="mt-3">
          <AttendanceReport readOnly />
        </div>
      )}
    </div>
  );
}
