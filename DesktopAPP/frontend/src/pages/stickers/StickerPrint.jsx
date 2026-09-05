import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import JsBarcode from 'jsbarcode';
import { useAuth } from '../../contexts/AuthContext';

function Barcode({ value }) {
  const setRef = useCallback((canvas) => {
    if (!canvas || !value) return;
    try {
      JsBarcode(canvas, value, {
        format: 'CODE128',
        width: 1.1,
        height: 26,
        fontSize: 8,
        margin: 0,
        displayValue: true,
      });
    } catch (e) {
      // Invalid characters for CODE128 (shouldn't happen with SKU/IMEI) — leave canvas blank.
    }
  }, [value]);

  return <canvas ref={setRef} className="sticker-barcode" />;
}

export default function StickerPrint() {
  const { user } = useAuth();
  const shopName = user?.shop?.name || 'TINKU MOBILE';
  const [stickers, setStickers] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const raw = sessionStorage.getItem('stickerPrintBatch');
    const rows = raw ? JSON.parse(raw) : [];
    if (rows.length === 0) {
      setError('No priced stickers found. Go to Generate Stickers first.');
      return;
    }
    setStickers(rows);
  }, []);

  return (
    <div>
      <div className="page-header d-print-none">
        <h2>🖨️ Sticker Print</h2>
        <div className="d-flex gap-2">
          <Link to="/stickers/prices" className="btn btn-outline-secondary btn-sm">← Back to Prices</Link>
          {stickers.length > 0 && (
            <button className="btn btn-primary btn-sm fw-bold" onClick={() => window.print()}>🖨️ Print</button>
          )}
        </div>
      </div>

      {error && <div className="alert alert-warning d-print-none">{error}</div>}

      {stickers.length > 0 && (
        <div className="sticker-sheet">
          {stickers.map(s => {
            const barcodeValue = s.imei ? `${s.sku}:${s.imei}` : (s.sku || '');
            const specs = [s.ram, s.storage, s.color].filter(Boolean).join('/');
            return (
              <div className="sticker" key={s.key}>
                <div className="sticker-brand">{shopName.toUpperCase()}</div>
                <div className={`sticker-condition ${s.condition === 'new' ? 'is-new' : 'is-used'}`}>
                  {s.condition === 'new' ? 'NEW' : 'USED'}
                </div>
                <div className="sticker-model">{s.name}</div>
                {specs && <div className="sticker-specs">{specs}</div>}
                <Barcode value={barcodeValue} />
                {s.imei && <div className="sticker-imei">IMEI: {s.imei}</div>}
                <div className="sticker-mrp">MRP: ₹{parseFloat(s.mrp || 0).toLocaleString('en-IN')}</div>
                <div className="sticker-price">PRICE: ₹{parseFloat(s.price || 0).toLocaleString('en-IN')}</div>
              </div>
            );
          })}
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .sticker-sheet {
          display: flex;
          flex-wrap: wrap;
          gap: 3mm;
        }
        .sticker {
          width: 40mm;
          height: 40mm;
          box-sizing: border-box;
          border: 1px dashed #999;
          padding: 1.5mm;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          align-items: center;
          text-align: center;
          overflow: hidden;
          page-break-inside: avoid;
        }
        .sticker-brand { font-size: 7.5pt; font-weight: 800; letter-spacing: 0.3px; line-height: 1.1; }
        .sticker-condition {
          font-size: 6.5pt;
          font-weight: 800;
          letter-spacing: 0.6px;
          padding: 0.3mm 2mm;
          border-radius: 2mm;
          line-height: 1.4;
        }
        .sticker-condition.is-new { background: #16a34a; color: #fff; }
        .sticker-condition.is-used { background: #475569; color: #fff; }
        .sticker-model { font-size: 7pt; font-weight: 700; line-height: 1.15; }
        .sticker-specs { font-size: 6pt; color: #444; line-height: 1.1; }
        .sticker-barcode { width: 100%; max-width: 36mm; height: auto; }
        .sticker-imei { font-size: 5.5pt; color: #444; line-height: 1.1; letter-spacing: 0.2px; }
        .sticker-mrp { font-size: 6.5pt; color: #666; line-height: 1.1; }
        .sticker-price { font-size: 9.5pt; font-weight: 800; line-height: 1.1; }

        @media print {
          @page { size: 40mm 40mm; margin: 0; }
          body * { visibility: hidden; }
          .sticker-sheet, .sticker-sheet * { visibility: visible; }
          .sticker-sheet { position: absolute; left: 0; top: 0; gap: 0; }
          .sticker { border: none; page-break-after: always; }
          .d-print-none { display: none !important; }
        }
      `}} />
    </div>
  );
}
