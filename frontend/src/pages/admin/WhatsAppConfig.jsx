import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { toast } from 'react-toastify';

export default function WhatsAppConfig() {
    const [settings, setSettings] = useState({
        WAPP_HOST: '',
        WAPP_API_KEY: '',
        OWNER_MOBILE: ''
    });
    const [loading, setLoading] = useState(false);
    const [testLoading, setTestLoading] = useState(false);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        setLoading(true);
        try {
            const response = await api.get('/settings');
            const data = response.data;
            setSettings({
                WAPP_HOST: data.WAPP_HOST || '',
                WAPP_API_KEY: data.WAPP_API_KEY || '',
                OWNER_MOBILE: data.OWNER_MOBILE || ''
            });
        } catch (error) {
            toast.error('Failed to load settings');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post('/settings', settings);
            toast.success('WhatsApp configuration saved successfully!');
        } catch (error) {
            toast.error('Failed to save settings');
        } finally {
            setLoading(false);
        }
    };

    const handleSendTest = async () => {
        if (!settings.OWNER_MOBILE) {
            toast.warning('Please enter Owner Mobile first');
            return;
        }
        setTestLoading(true);
        try {
            // We can create a temporary endpoint or just use the daily summary command logic if we expose it
            // For now, let's just send a simple "Test Message"
            // Since we don't have a direct "test" endpoint, we can use the DailySummary command or add a test endpoint.
            // Let's assume we add a test endpoint in SettingsController.
            await api.post('/settings/test-whatsapp');
            toast.success('Test message sent to ' + settings.OWNER_MOBILE);
        } catch (error) {
            toast.error('Test message failed. Check your configuration.');
        } finally {
            setTestLoading(false);
        }
    };

    return (
        <div className="container-fluid py-4">
            <div className="row justify-content-center">
                <div className="col-md-8 col-lg-6">
                    <div className="card shadow-sm border-0">
                        <div className="card-header bg-primary text-white py-3">
                            <h5 className="card-title mb-0">
                                <span className="me-2">⚙️</span>
                                WhatsApp API Configuration
                            </h5>
                        </div>
                        <div className="card-body p-4">
                            <p className="text-muted small mb-4">
                                Configure your <strong>api.iconics</strong> credentials here. These settings are used for all automated notifications (Sales, Repairs, Recoveries, etc.).
                            </p>

                            <form onSubmit={handleSave}>
                                <div className="mb-3">
                                    <label className="form-label fw-bold small text-uppercase">API Host URL</label>
                                    <input 
                                        type="text" 
                                        className="form-control" 
                                        placeholder="e.g. yourhostname.com"
                                        value={settings.WAPP_HOST}
                                        onChange={e => setSettings({...settings, WAPP_HOST: e.target.value})}
                                        required
                                    />
                                    <div className="form-text">The domain provided in your iconics panel.</div>
                                </div>

                                <div className="mb-3">
                                    <label className="form-label fw-bold small text-uppercase">API Key</label>
                                    <input 
                                        type="password" 
                                        className="form-control" 
                                        placeholder="Enter your API Key"
                                        value={settings.WAPP_API_KEY}
                                        onChange={e => setSettings({...settings, WAPP_API_KEY: e.target.value})}
                                        required
                                    />
                                </div>

                                <div className="mb-4">
                                    <label className="form-label fw-bold small text-uppercase">Owner Mobile Number</label>
                                    <div className="input-group">
                                        <span className="input-group-text bg-light">+91</span>
                                        <input 
                                            type="text" 
                                            className="form-control" 
                                            placeholder="10-digit mobile number"
                                            value={settings.OWNER_MOBILE}
                                            onChange={e => setSettings({...settings, OWNER_MOBILE: e.target.value})}
                                            required
                                        />
                                    </div>
                                    <div className="form-text">All management alerts will be sent to this number.</div>
                                </div>

                                <div className="d-grid gap-2">
                                    <button 
                                        type="submit" 
                                        className="btn btn-primary fw-bold py-2"
                                        disabled={loading}
                                    >
                                        {loading ? <span className="spinner-border spinner-border-sm me-2"/> : '💾 '}
                                        Save Configuration
                                    </button>
                                    
                                    <button 
                                        type="button" 
                                        className="btn btn-outline-success fw-bold py-2"
                                        onClick={handleSendTest}
                                        disabled={testLoading || loading}
                                    >
                                        {testLoading ? <span className="spinner-border spinner-border-sm me-2"/> : '📲 '}
                                        Send Test Message
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                    
                    <div className="mt-4 p-3 bg-light rounded border">
                        <h6 className="fw-bold small text-uppercase mb-2 text-primary">How it works</h6>
                        <ul className="small text-muted mb-0 ps-3">
                            <li>The system automatically prepends <strong>91</strong> to all mobile numbers.</li>
                            <li>Messages are sent via the JSON API endpoint of iconics.</li>
                            <li>Failed messages are logged in the backend error logs.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
