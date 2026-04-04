import React from 'react';

export default function Modal({ show, onClose, title, children }) {
  if (!show) return null;

  return (
    <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="modal-dialog modal-dialog-centered shadow-lg">
        <div className="modal-content border-0" style={{ borderRadius: '16px' }}>
          <div className="modal-header border-bottom-0 pt-4 px-4">
            <h5 className="modal-title fw-bold text-uppercase">{title}</h5>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close"></button>
          </div>
          <div className="modal-body px-4 pb-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
