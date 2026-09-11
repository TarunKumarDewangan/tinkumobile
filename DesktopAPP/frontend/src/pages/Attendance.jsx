import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../api/axios';
import FaceCapture from '../components/FaceCapture';

function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Geolocation not supported by this browser'));
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000 });
  });
}

export default function Attendance() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [capturing, setCapturing] = useState(false); // false | 'enroll' | 'check'
  const [submitting, setSubmitting] = useState(false);

  const loadStatus = () => {
    setLoading(true);
    api.get('/attendance/status')
      .then(r => setStatus(r.data))
      .catch(() => toast.error('Failed to load attendance status'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadStatus(); }, []);

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

  const handleCheckCapture = async ({ descriptor, photo }) => {
    setCapturing(false);
    setSubmitting(true);
    try {
      const pos = await getPosition();
      const { data } = await api.post('/attendance/check', {
        descriptor, photo,
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
        {capturing === 'check' && (
          <FaceCapture onCapture={handleCheckCapture} onCancel={() => setCapturing(false)} />
        )}

        {!capturing && status?.shop && (
          <div className="text-center">
            {!status?.enrolled ? (
              <>
                <div className="mb-3">
                  <div className="fs-1 mb-2">🙂</div>
                  <p className="text-muted small mb-0">You haven't enrolled your face yet. This is a one-time setup — you'll blink on camera to confirm it's really you.</p>
                </div>
                <button className="btn btn-primary" disabled={submitting || !status?.shop} onClick={() => setCapturing('enroll')}>
                  {submitting ? 'Enrolling...' : '📷 Enroll My Face'}
                </button>
              </>
            ) : (
              <>
                <div className="mb-3">
                  <div className="fs-1 mb-2">{status.next_action === 'IN' ? '🚪' : '👋'}</div>
                  <p className="text-muted small mb-1">
                    {status.last_log
                      ? `Last: ${status.last_log.type} at ${new Date(status.last_log.logged_at).toLocaleTimeString()}`
                      : 'No attendance yet today.'}
                  </p>
                  <p className="fw-bold mb-0">Next action: {status.next_action === 'IN' ? 'Check In' : 'Check Out'}</p>
                </div>
                <button
                  className={`btn ${status.next_action === 'IN' ? 'btn-success' : 'btn-danger'}`}
                  disabled={submitting || !status?.shop?.latitude}
                  onClick={() => setCapturing('check')}
                >
                  {submitting ? 'Please wait...' : (status.next_action === 'IN' ? '✅ Check In' : '🚪 Check Out')}
                </button>
                <div className="mt-3">
                  <button className="btn btn-sm btn-link text-muted" onClick={() => setCapturing('enroll')}>Re-enroll my face</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
