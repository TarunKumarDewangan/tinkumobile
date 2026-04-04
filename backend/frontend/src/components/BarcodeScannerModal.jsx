import { useEffect, useRef } from 'react';
import { Modal, Button } from 'react-bootstrap';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';

export default function BarcodeScannerModal({ show, onHide, onScanSuccess, continuous = false }) {
  const scannerRef = useRef(null);
  const lastScannedRef = useRef('');
  const lastScannedTimeRef = useRef(0);

  useEffect(() => {
    if (show) {
      lastScannedRef.current = ''; // Reset on open
      
      const timer = setTimeout(() => {
        try {
          const scanner = new Html5QrcodeScanner(
            "reader", 
            { 
              fps: 15, 
              qrbox: { width: 280, height: 200 },
              aspectRatio: 1.0,
              formatsToSupport: [ 
                Html5QrcodeSupportedFormats.CODE_128,
                Html5QrcodeSupportedFormats.EAN_13,
                Html5QrcodeSupportedFormats.EAN_8,
                Html5QrcodeSupportedFormats.QR_CODE,
                Html5QrcodeSupportedFormats.UPC_A
              ],
              showTorchButtonIfSupported: true
            }, 
            false
          );

          scanner.render((decodedText) => {
            const now = Date.now();
            // Prevent duplicate scans within 2 seconds for same text in continuous mode
            if (continuous && decodedText === lastScannedRef.current && (now - lastScannedTimeRef.current < 2000)) {
              return;
            }
            
            lastScannedRef.current = decodedText;
            lastScannedTimeRef.current = now;
            
            onScanSuccess(decodedText);
            
            if (!continuous) {
              onHide();
            }
          }, (error) => {
            // ignore
          });

          scannerRef.current = scanner;
        } catch (err) {
          console.error("Scanner init error:", err);
        }
      }, 300);

      return () => {
        clearTimeout(timer);
        if (scannerRef.current) {
          scannerRef.current.clear().catch(err => console.error("Failed to clear scanner", err));
        }
      };
    }
  }, [show]);

  return (
    <Modal show={show} onHide={onHide} centered size="md" contentClassName="scanner-modal">
      <Modal.Header closeButton className="border-0 pb-0">
        <Modal.Title className="fs-5 fw-bold">📷 Barcode / IMEI Scanner</Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-3">
        <div className="rounded-3 overflow-hidden border shadow-sm bg-black" style={{ minHeight: '300px' }}>
          <div id="reader" style={{ width: '100%' }}></div>
        </div>
        <p className="text-center text-muted small mt-2 mb-0">
          Point your camera at the 1D barcode (IMEI) or QR code.
        </p>
      </Modal.Body>
      <Modal.Footer className="border-0 pt-0">
        <Button variant="outline-secondary" className="w-100" onClick={onHide}>Cancel</Button>
      </Modal.Footer>

      <style>{`
        .scanner-modal #reader__scan_region video {
          object-fit: cover !important;
          border-radius: 8px;
        }
        .scanner-modal #reader__dashboard {
          padding: 15px !important;
          background: #f8f9fa;
          border-top: 1px solid #dee2e6;
        }
        .scanner-modal #reader__dashboard_section_csr button {
          padding: 6px 12px;
          font-size: 0.875rem;
          background-color: #0d6efd;
          color: white;
          border: none;
          border-radius: 4px;
        }
        .scanner-modal #reader__status_span {
            display: none !important;
        }
      `}</style>
    </Modal>
  );
}
