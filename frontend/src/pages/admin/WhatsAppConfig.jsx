import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { toast } from 'react-toastify';

export default function WhatsAppConfig() {
    const [settings, setSettings] = useState({
        WAPP_HOST: '',
        WAPP_API_KEY: '',
        OWNER_MOBILE: '',
        TELEGRAM_BOT_TOKEN: '',
        TELEGRAM_CHAT_ID: ''
    });
    const [loading, setLoading] = useState(false);
    const [testLoading, setTestLoading] = useState(false);
    const [telegramSaving, setTelegramSaving] = useState(false);
    const [telegramTestLoading, setTelegramTestLoading] = useState(false);

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
                OWNER_MOBILE: data.OWNER_MOBILE || '',
                TELEGRAM_BOT_TOKEN: data.TELEGRAM_BOT_TOKEN || '',
                TELEGRAM_CHAT_ID: data.TELEGRAM_CHAT_ID || ''
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
            await api.post('/settings', {
                WAPP_HOST: settings.WAPP_HOST,
                WAPP_API_KEY: settings.WAPP_API_KEY,
                OWNER_MOBILE: settings.OWNER_MOBILE
            });
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
            await api.post('/settings/test-whatsapp');
            toast.success('Test message sent to ' + settings.OWNER_MOBILE);
        } catch (error) {
            toast.error('Test message failed. Check your configuration.');
        } finally {
            setTestLoading(false);
        }
    };

    const handleSaveTelegram = async (e) => {
        e.preventDefault();
        setTelegramSaving(true);
        try {
            await api.post('/settings', {
                TELEGRAM_BOT_TOKEN: settings.TELEGRAM_BOT_TOKEN,
                TELEGRAM_CHAT_ID: settings.TELEGRAM_CHAT_ID
            });
            toast.success('Telegram configuration saved successfully!');
        } catch (error) {
            toast.error('Failed to save Telegram settings');
        } finally {
            setTelegramSaving(false);
        }
    };

    const handleSendTelegramTest = async () => {
        if (!settings.TELEGRAM_BOT_TOKEN || !settings.TELEGRAM_CHAT_ID) {
            toast.warning('Please enter Bot Token and Chat ID first');
            return;
        }
        setTelegramTestLoading(true);
        try {
            await api.post('/settings/test-telegram');
            toast.success('Test message sent to Telegram');
        } catch (error) {
            toast.error('Test message failed. Check your configuration.');
        } finally {
            setTelegramTestLoading(false);
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

                    <div className="card shadow-sm border-0 mt-4">
                        <div className="card-header bg-info text-white py-3">
                            <h5 className="card-title mb-0">
                                <span className="me-2">✈️</span>
                                Telegram Bot Configuration
                            </h5>
                        </div>
                        <div className="card-body p-4">
                            <p className="text-muted small mb-4">
                                Daily summary reports (5 PM &amp; 9 PM) and other automated alerts are sent to this Telegram chat.
                            </p>

                            <form onSubmit={handleSaveTelegram}>
                                <div className="mb-3">
                                    <label className="form-label fw-bold small text-uppercase">Bot Token</label>
                                    <input
                                        type="password"
                                        className="form-control font-monospace"
                                        placeholder="e.g. 123456789:AAF..."
                                        value={settings.TELEGRAM_BOT_TOKEN}
                                        onChange={e => setSettings({...settings, TELEGRAM_BOT_TOKEN: e.target.value})}
                                        required
                                    />
                                    <div className="form-text">From @BotFather when you created your bot.</div>
                                </div>

                                <div className="mb-4">
                                    <label className="form-label fw-bold small text-uppercase">Chat ID</label>
                                    <input
                                        type="text"
                                        className="form-control font-monospace"
                                        placeholder="e.g. 7570378032"
                                        value={settings.TELEGRAM_CHAT_ID}
                                        onChange={e => setSettings({...settings, TELEGRAM_CHAT_ID: e.target.value})}
                                        required
                                    />
                                    <div className="form-text">Message your bot once, then use its getUpdates API to find this.</div>
                                </div>

                                <div className="d-grid gap-2">
                                    <button
                                        type="submit"
                                        className="btn btn-info text-white fw-bold py-2"
                                        disabled={telegramSaving}
                                    >
                                        {telegramSaving ? <span className="spinner-border spinner-border-sm me-2"/> : '💾 '}
                                        Save Configuration
                                    </button>

                                    <button
                                        type="button"
                                        className="btn btn-outline-success fw-bold py-2"
                                        onClick={handleSendTelegramTest}
                                        disabled={telegramTestLoading || telegramSaving}
                                    >
                                        {telegramTestLoading ? <span className="spinner-border spinner-border-sm me-2"/> : '📲 '}
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
                            <li>The daily summary (5 PM &amp; 9 PM) is sent via both WhatsApp and Telegram automatically.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
