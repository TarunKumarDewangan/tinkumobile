import React, { useState } from 'react';
import { toast } from 'react-toastify';
import api from '../../../api/axios';

export default function ClearStockModal({ show, onClose, onClearSuccess }) {
  const [pin, setPin] = useState('');
  const [isClearing, setIsClearing] = useState(false);

  if (!show) return null;

  const handleClear = async (e) => {
    e.preventDefault();
    if (pin !== '71727378') {
      toast.error('Invalid PIN');
      return;
    }

    if (!window.confirm('WARNING: This will permanently delete ALL New Mobile stocks, purchase bills, and sale bills! Are you absolutely sure?')) {
      return;
    }

    setIsClearing(true);
    try {
      const { data } = await api.post('/stock-adjustments/clear-all', { pin });
      toast.success(data.message || 'All new mobile stocks cleared successfully!');
      setPin('');
      if (onClearSuccess) onClearSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error clearing stocks');
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="modal show d-block animate-fadeIn" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', zIndex: 1060 }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
          <div className="modal-header bg-danger text-white border-0 p-4">
            <div>
              <h5 className="modal-title fw-bold mb-0">🔥 CLEAR ALL STOCKS</h5>
              <p className="xx-small text-white-50 mb-0 mt-1">DANGER ZONE: Irreversible action</p>
            </div>
            <button type="button" className="btn-close btn-close-white shadow-none" onClick={onClose} disabled={isClearing}></button>
          </div>
          
          <form onSubmit={handleClear}>
            <div className="modal-body p-4 bg-light">
              <div className="alert alert-danger border-0 shadow-sm" role="alert">
                <i className="bi bi-exclamation-triangle-fill me-2"></i>
                <strong>WARNING:</strong> You are about to completely wipe all **New Mobile** inventory, purchase invoices (supplier bills), and sale invoices (customer bills) from the entire system.
              </div>
              <p className="x-small text-muted mb-3 fw-bold">Enter authorization PIN to proceed:</p>
              
              <div className="mb-3">
                <input 
                  type="password" 
                  className="form-control form-control-lg text-center fw-bold text-danger border-danger shadow-sm" 
                  placeholder="• • • • • • • •" 
                  maxLength="8"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  autoFocus
                  required
                />
              </div>
            </div>
            
            <div className="modal-footer border-0 p-3 bg-white justify-content-end gap-2">
              <button type="button" className="btn btn-light fw-bold px-4" onClick={onClose} disabled={isClearing}>Cancel</button>
              <button type="submit" className="btn btn-danger fw-bold px-4 shadow-sm" disabled={isClearing || pin.length < 8}>
                {isClearing ? 'Clearing...' : 'CONFIRM & WIPE'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
