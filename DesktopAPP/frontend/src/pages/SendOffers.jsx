import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import Select from 'react-select';
import api from '../api/axios';
import { useAuth } from '../contexts/AuthContext';

export default function SendOffers() {
  const { hasFullAccess } = useAuth();
  const navigate = useNavigate();

  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [offerText, setOfferText] = useState('');
  const [voucherCode, setVoucherCode] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/customers')
      .then(res => {
        setCustomers(res.data);
      })
      .catch(err => {
        console.error(err);
        toast.error('Failed to load customers');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!selectedCustomer) {
      toast.error('Please select a customer');
      return;
    }
    if (!offerText.trim()) {
      toast.error('Please enter the offer details');
      return;
    }

    setSending(true);
    try {
      const payload = {
        customer_id: selectedCustomer.value,
        offer: offerText,
        voucher_code: voucherCode || null
      };

      const res = await api.post('/customers/send-offer', payload);
      toast.success(res.data.message || 'Offer sent successfully via WhatsApp!');
      
      // Reset form on success (except customer selection to allow reuse)
      setOfferText('');
      setVoucherCode('');
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to send offer. Verify WhatsApp service.');
    } finally {
      setSending(false);
    }
  };

  // Map customers to react-select options
  const customerOptions = [
    { value: 'all', label: '📣 ALL CUSTOMERS (BULK SEND)' },
    ...customers.map(c => ({
      value: c.id,
      label: `${c.name.toUpperCase()} (${c.phone})`
    }))
  ];

  const customStyles = {
    control: (provided) => ({
      ...provided,
      backgroundColor: '#f8fafc',
      borderColor: '#e2e8f0',
      borderRadius: '9px',
      padding: '2px',
      fontSize: '0.9rem',
      fontWeight: '500',
      boxShadow: 'none',
      '&:hover': {
        borderColor: '#6366f1',
      }
    }),
    option: (provided, state) => ({
      ...provided,
      color: '#1e293b',
      fontSize: '0.85rem',
      textTransform: 'uppercase',
      backgroundColor: state.isSelected ? '#e0e7ff' : state.isFocused ? '#f1f5f9' : '#fff',
      '&:active': {
        backgroundColor: '#c7d2fe',
      }
    }),
    input: (provided) => ({
      ...provided,
      fontSize: '0.9rem',
      fontWeight: '500'
    }),
    singleValue: (provided) => ({
      ...provided,
      fontSize: '0.9rem',
      fontWeight: '500'
    }),
    placeholder: (provided) => ({
      ...provided,
      fontSize: '0.9rem',
      fontWeight: '500'
    })
  };

  const styleCSS = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    .so-wrap {
      background: linear-gradient(160deg, #f0f4ff 0%, #f8faff 60%, #fafbfe 100%);
      min-height: calc(100vh - 60px);
      padding: 24px;
      font-family: 'Inter', sans-serif;
    }
    .so-card {
      background: #fff;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.05);
      border: 1px solid rgba(226, 232, 240, 0.8);
      max-width: 600px;
      margin: 0 auto;
    }
    .so-title {
      font-size: 1.25rem;
      font-weight: 800;
      color: #1e293b;
    }
    .so-subtitle {
      font-size: 0.8rem;
      color: #64748b;
      margin-bottom: 24px;
    }
    .so-label {
      font-size: 0.7rem;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      display: block;
      margin-bottom: 6px;
    }
    .so-textarea {
      font-size: 0.9rem;
      border: 1.5px solid #e2e8f0;
      border-radius: 9px;
      padding: 10px 12px;
      width: 100%;
      background: #f8fafc;
      transition: all 0.18s;
      color: #1e293b;
      font-weight: 500;
      resize: vertical;
      min-height: 120px;
    }
    .so-textarea:focus {
      outline: none;
      border-color: #6366f1;
      background: #fff;
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
    }
    .so-input {
      font-size: 0.9rem;
      border: 1.5px solid #e2e8f0;
      border-radius: 9px;
      padding: 10px 12px;
      width: 100%;
      background: #f8fafc;
      transition: all 0.18s;
      color: #1e293b;
      font-weight: 600;
    }
    .so-input:focus {
      outline: none;
      border-color: #6366f1;
      background: #fff;
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
    }
    .so-btn-send {
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      border: none;
      color: #fff;
      font-weight: 700;
      font-size: 0.9rem;
      padding: 12px 24px;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.2s;
      letter-spacing: 0.4px;
      box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35);
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .so-btn-send:hover:not(:disabled) {
      opacity: 0.95;
      transform: translateY(-1px);
    }
    .so-btn-send:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  `;

  return (
    <div className="so-wrap">
      <style>{styleCSS}</style>

      <div className="so-card mt-3">
        <div className="d-flex align-items-center gap-2 mb-1">
          <span style={{ fontSize: '1.5rem' }}>✉️</span>
          <span className="so-title">Send Offers</span>
        </div>
        <p className="so-subtitle">Compose and send custom offers or vouchers via WhatsApp to your customers.</p>

        {loading ? (
          <div className="d-flex justify-content-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading Customers...</span>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSend}>
            <div className="mb-4">
              <label className="so-label">Select Customer *</label>
              <Select
                options={customerOptions}
                value={selectedCustomer}
                onChange={setSelectedCustomer}
                placeholder="TYPE NAME OR PHONE TO SEARCH..."
                isClearable
                styles={customStyles}
              />
              {selectedCustomer?.value === 'all' && (
                <div className="form-text text-danger fw-bold small mt-1">
                  ⚠️ WARNING: This will loop and send a separate WhatsApp message to ALL customers in the system!
                </div>
              )}
            </div>

            <div className="mb-4">
              <label className="so-label">Offer / Message *</label>
              <textarea
                className="so-textarea"
                placeholder="TYPE OFFER DETAILS HERE..."
                required
                value={offerText}
                onChange={e => setOfferText(e.target.value)}
              />
            </div>

            <div className="mb-4">
              <label className="so-label">Voucher Code (Optional)</label>
              <input
                type="text"
                className="so-input text-uppercase"
                placeholder="E.G. TINKU100, SAVE50"
                value={voucherCode}
                onChange={e => setVoucherCode(e.target.value.toUpperCase())}
              />
            </div>

            <button type="submit" className="so-btn-send" disabled={sending}>
              {sending ? (
                <>
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                  SENDING MESSAGES...
                </>
              ) : (
                <>
                  <span>💬</span> SEND VIA WHATSAPP
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
