import React, { useState } from 'react';
import pinGate from '../../../utils/pinGate';
import { toast } from 'react-toastify';
import api from '../../../api/axios';

export default function ClearStockModal({ show, onClose, onClearSuccess }) {
  const [isClearing, setIsClearing] = useState(false);

  if (!show) return null;

  const handleClear = async () => {
    if (!await pinGate.confirm()) return;
    setIsClearing(true);
    try {
      const { data } = await api.post('/stock-adjustments/clear-all');
      toast.success(data.message || 'All new mobile stocks cleared successfully!');
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

          <div className="modal-body p-4 bg-light">
            <div className="alert alert-danger border-0 shadow-sm" role="alert">
              <i className="bi bi-exclamation-triangle-fill me-2"></i>
              <strong>WARNING:</strong> You are about to completely wipe all <strong>New Mobile</strong> inventory,
              purchase invoices (supplier bills), and sale invoices (customer bills) from the entire system.
              This action is <strong>irreversible</strong>.
            </div>
            <p className="small text-muted fw-bold mb-0">
              Click <em>CONFIRM &amp; WIPE</em> to enter PIN and proceed.
            </p>
          </div>

          <div className="modal-footer border-0 p-3 bg-white justify-content-end gap-2">
            <button type="button" className="btn btn-light fw-bold px-4" onClick={onClose} disabled={isClearing}>Cancel</button>
            <button type="button" className="btn btn-danger fw-bold px-4 shadow-sm" onClick={handleClear} disabled={isClearing}>
              {isClearing ? 'Clearing...' : 'CONFIRM & WIPE'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
