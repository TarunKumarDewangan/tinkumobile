import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../api/axios';
import Modal from './Modal';

export default function CloudSyncModal({ isOpen, onClose, onRefresh }) {
  const [cloudUrl, setCloudUrl] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saveSettings, setSaveSettings] = useState(true);
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [connectionTested, setConnectionTested] = useState(false);
  const [testSuccess, setTestSuccess] = useState(false);
  const [showConfirm, setShowConfirm] = useState(null); // 'pull' or 'push' or null
  const [caseMode, setCaseMode] = useState('lower'); // 'lower', 'upper', 'any'

  // Fetch saved settings on load
  useEffect(() => {
    if (isOpen) {
      api.get('/settings')
        .then(res => {
          let url = res.data.cloud_sync_url || '';
          let savedEmail = res.data.cloud_sync_email || '';
          
          // Apply casing based on default caseMode ('lower')
          if (caseMode === 'lower') {
            url = url.toLowerCase();
            savedEmail = savedEmail.toLowerCase();
          } else if (caseMode === 'upper') {
            url = url.toUpperCase();
            savedEmail = savedEmail.toUpperCase();
          }

          setCloudUrl(url);
          setEmail(savedEmail);
        })
        .catch(err => {
          console.error('Failed to load cloud sync settings', err);
        });
    }
  }, [isOpen]);

  // Adjust case when mode changes
  const handleCaseModeChange = (newMode) => {
    setCaseMode(newMode);
    if (newMode === 'lower') {
      setCloudUrl(p => p.toLowerCase());
      setEmail(p => p.toLowerCase());
    } else if (newMode === 'upper') {
      setCloudUrl(p => p.toUpperCase());
      setEmail(p => p.toUpperCase());
    }
  };

  // Helper to get styled inputs
  const getInputStyle = () => {
    if (caseMode === 'lower') return { textTransform: 'lowercase' };
    if (caseMode === 'upper') return { textTransform: 'uppercase' };
    return { textTransform: 'none' };
  };

  // Helper to get normalized credential values based on selected case
  const getNormalizedCredentials = () => {
    let urlVal = cloudUrl.trim();
    let emailVal = email.trim();
    
    if (caseMode === 'lower') {
      urlVal = urlVal.toLowerCase();
      emailVal = emailVal.toLowerCase();
    } else if (caseMode === 'upper') {
      urlVal = urlVal.toUpperCase();
      emailVal = emailVal.toUpperCase();
    }
    return { urlVal, emailVal };
  };

  // Warn user if closing during sync
  useEffect(() => {
    if (!loading) return;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = 'A system sync is in progress. Are you sure you want to leave?';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [loading]);

  const handleTestConnection = async () => {
    const { urlVal, emailVal } = getNormalizedCredentials();
    if (!urlVal || !emailVal || !password) {
      return toast.warning('Please enter Live URL, email, and password.');
    }
    try {
      setLoading(true);
      setStatusText('Testing connection to live server...');
      const response = await api.post('/cloud-sync/test', {
        cloud_url: urlVal,
        email: emailVal,
        password
      });

      if (response.data.success) {
        setTestSuccess(true);
        setConnectionTested(true);
        toast.success(response.data.message || 'Connection successful!');
        // Save settings if checked
        if (saveSettings) {
          await api.post('/settings', {
            cloud_sync_url: urlVal,
            cloud_sync_email: emailVal
          });
        }
      } else {
        setTestSuccess(false);
        setConnectionTested(true);
        toast.error(response.data.message || 'Connection failed.');
      }
    } catch (e) {
      setTestSuccess(false);
      setConnectionTested(true);
      const msg = e.response?.data?.message || 'Cannot reach live server.';
      toast.error(msg);
    } finally {
      setLoading(false);
      setStatusText('');
    }
  };

  const handleStartSync = (direction) => {
    const { urlVal, emailVal } = getNormalizedCredentials();
    if (!urlVal || !emailVal || !password) {
      return toast.warning('Please fill in Live URL, Email and Password.');
    }
    setShowConfirm(direction);
  };

  const executeSync = async () => {
    const direction = showConfirm;
    setShowConfirm(null);
    if (!direction) return;

    const { urlVal, emailVal } = getNormalizedCredentials();

    try {
      setLoading(true);
      if (direction === 'pull') {
        setStatusText('📥 Pulling data from Live Server... This might take a few minutes.');
        const res = await api.post('/cloud-sync/pull', {
          cloud_url: urlVal,
          email: emailVal,
          password
        });
        toast.success(res.data.message || 'Cloud Sync (Pull) complete!');
      } else {
        setStatusText('📤 Pushing data to Live Server... This might take a few minutes.');
        const res = await api.post('/cloud-sync/push', {
          cloud_url: urlVal,
          email: emailVal,
          password
        });
        toast.success(res.data.message || 'Cloud Sync (Push) complete!');
      }
      
      // Save settings if checked
      if (saveSettings) {
        await api.post('/settings', {
          cloud_sync_url: urlVal,
          cloud_sync_email: emailVal
        });
      }

      if (onRefresh) onRefresh();
      onClose();
    } catch (e) {
      const serverMsg = e.response?.data?.message || 'Sync failed.';
      toast.error(`Sync failed: ${serverMsg}`);
    } finally {
      setLoading(false);
      setStatusText('');
    }
  };

  return (
    <Modal show={isOpen} onClose={loading ? null : onClose} title="☁️ Cloud Sync (Bidirectional)" size="lg">
      <div className="p-3">
        
        {/* Credentials Form */}
        <div className="card border-0 bg-light p-4 rounded-4 mb-4">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h6 className="fw-bold mb-0 text-muted text-uppercase small letter-spacing-1">🔗 Live Website Connection</h6>
            <div className="d-flex align-items-center gap-2">
              <span className="text-muted small" style={{ fontSize: '0.72rem' }}>Text Case:</span>
              <select 
                className="form-select form-select-sm py-0 px-2" 
                style={{ width: '120px', fontSize: '0.72rem', textTransform: 'none' }}
                value={caseMode}
                onChange={e => handleCaseModeChange(e.target.value)}
                disabled={loading}
              >
                <option value="lower">Lower Case (Default)</option>
                <option value="upper">Upper Case</option>
                <option value="any">Any Case</option>
              </select>
            </div>
          </div>

          <div className="row g-3">
            <div className="col-md-12">
              <label className="form-label fw-semibold small">Live Server API URL</label>
              <input 
                type="url" 
                className="form-control" 
                placeholder="https://api.tinkumobile.in" 
                value={cloudUrl} 
                onChange={e => { setCloudUrl(e.target.value); setConnectionTested(false); }}
                style={getInputStyle()}
                disabled={loading}
              />
              <div className="text-muted" style={{fontSize: '0.72rem'}}>
                The URL of your hosted website backend API.
              </div>
            </div>
            <div className="col-md-6">
              <label className="form-label fw-semibold small">Owner Email</label>
              <input 
                type="email" 
                className="form-control" 
                placeholder="owner@tinkumobile.in" 
                value={email} 
                onChange={e => { setEmail(e.target.value); setConnectionTested(false); }}
                style={getInputStyle()}
                disabled={loading}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label fw-semibold small">Owner Password</label>
              <input 
                type="password" 
                className="form-control" 
                placeholder="••••••••" 
                value={password} 
                onChange={e => { setPassword(e.target.value); setConnectionTested(false); }}
                style={{ textTransform: 'none' }}
                disabled={loading}
              />
            </div>
            <div className="col-12 d-flex justify-content-between align-items-center mt-3">
              <div className="form-check">
                <input 
                  type="checkbox" 
                  className="form-check-input" 
                  id="saveSettingsCheck" 
                  checked={saveSettings} 
                  onChange={e => setSaveSettings(e.target.checked)}
                  disabled={loading}
                />
                <label className="form-check-label small text-muted" htmlFor="saveSettingsCheck">
                  Save URL and Email for next time
                </label>
              </div>
              <button 
                type="button" 
                className={`btn btn-${testSuccess ? 'success' : 'outline-primary'} btn-sm px-4 rounded-pill`}
                onClick={handleTestConnection}
                disabled={loading}
              >
                {loading && !statusText.includes('sync') ? 'Testing...' : testSuccess ? '✅ Connected' : '🔌 Test Connection'}
              </button>
            </div>
          </div>
        </div>

        {/* Sync Direction Cards */}
        <div className="row g-4">
          
          {/* Pull Card */}
          <div className="col-md-6">
            <div className="card h-100 border-0 shadow-sm p-4 rounded-4 text-center cursor-pointer hover-card" 
                 style={{ 
                   background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                   border: '2px solid #bbf7d0',
                   cursor: loading ? 'not-allowed' : 'pointer'
                 }}
                 onClick={() => !loading && handleStartSync('pull')}
            >
              <div className="fs-1 mb-2">📥</div>
              <h5 className="fw-bold text-success mb-2">Pull from Cloud</h5>
              <p className="text-muted small mb-4" style={{minHeight: '48px'}}>
                Download all data from the live website. Replaces the local desktop data.
              </p>
              <button className="btn btn-success w-100 rounded-pill fw-bold" disabled={loading}>
                Download & Sync
              </button>
            </div>
          </div>

          {/* Push Card */}
          <div className="col-md-6">
            <div className="card h-100 border-0 shadow-sm p-4 rounded-4 text-center cursor-pointer hover-card"
                 style={{ 
                   background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                   border: '2px solid #bfdbfe',
                   cursor: loading ? 'not-allowed' : 'pointer'
                 }}
                 onClick={() => !loading && handleStartSync('push')}
            >
              <div className="fs-1 mb-2">📤</div>
              <h5 className="fw-bold text-blue mb-2" style={{color: '#1d4ed8'}}>Push to Cloud</h5>
              <p className="text-muted small mb-4" style={{minHeight: '48px'}}>
                Upload local data to the live server. Replaces all data on the live website.
              </p>
              <button className="btn btn-primary w-100 rounded-pill fw-bold" style={{backgroundColor: '#1d4ed8', borderColor: '#1d4ed8'}} disabled={loading}>
                Upload & Sync
              </button>
            </div>
          </div>

        </div>

        {/* Status indicator */}
        {loading && statusText && (
          <div className="mt-4 alert alert-warning border-0 p-3 rounded-3 d-flex align-items-center gap-3">
            <div className="spinner-border spinner-border-sm text-warning" role="status"></div>
            <div className="small fw-semibold">{statusText}</div>
          </div>
        )}

      </div>

      {/* Confirmation Overlay Modal */}
      {showConfirm && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,.6)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }} onClick={() => setShowConfirm(null)}>
          <div style={{
            background: '#fff',
            borderRadius: 20,
            padding: '32px',
            maxWidth: 480,
            width: '90%',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,.25)'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 8 }} className="d-flex align-items-center gap-2">
              {showConfirm === 'pull' ? '📥 Confirm Pull from Cloud' : '📤 Confirm Push to Cloud'}
            </div>
            <p style={{ fontSize: '.88rem', color: '#475569', lineHeight: 1.6, marginBottom: 20 }}>
              {showConfirm === 'pull' ? (
                <>
                  You are about to download data from the live website and <strong>OVERWRITE all local data</strong> on this computer. 
                  This will replace all offline transactions, sales, and settings on this device.
                </>
              ) : (
                <>
                  You are about to upload local data and <strong>OVERWRITE all data on the live website</strong>. 
                  This will replace all live website records with your desktop data.
                </>
              )}
            </p>
            <div style={{ fontSize: '.82rem', color: '#dc2626', background: '#fef2f2', padding: '12px 16px', borderRadius: 10, marginBottom: 24, fontWeight: 600 }}>
              ⚠️ WARNING: This action cannot be undone. Please ensure you have tested the connection and are sync'ing in the correct direction.
            </div>
            <div style={{ display: 'flex', gap: 12, justifycontent: 'flex-end' }}>
              <button 
                onClick={() => setShowConfirm(null)} 
                className="btn btn-light px-4 rounded-pill border fw-bold text-muted small"
                style={{ padding: '8px 20px' }}
              >
                Cancel
              </button>
              <button 
                onClick={executeSync} 
                className={`btn btn-${showConfirm === 'pull' ? 'success' : 'primary'} px-4 rounded-pill fw-bold small`}
                style={{ padding: '8px 20px', backgroundColor: showConfirm === 'push' ? '#1d4ed8' : undefined }}
              >
                Yes, Start Sync
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .hover-card {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .hover-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 20px -8px rgba(0, 0, 0, 0.15) !important;
        }
      `}</style>
    </Modal>
  );
}
