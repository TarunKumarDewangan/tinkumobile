import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';
import { isValidStartLetter, buildCipherMap, priceToCipher } from '../../utils/stickerCipher';

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export default function StickerPrint() {
  const { hasFullAccess } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stickers, setStickers] = useState([]); // one entry per physical sticker to print
  const [startLetter, setStartLetter] = useState('');
  const [letterInput, setLetterInput] = useState('');
  const [savingLetter, setSavingLetter] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    const raw = sessionStorage.getItem('stickerBatch');
    const items = raw ? JSON.parse(raw) : [];

    Promise.all([
      api.get('/settings'),
      items.length ? Promise.all(items.map(it => api.get(`/products/${it.product_id}`).then(r => ({ ...r.data, qty: it.qty })))) : Promise.resolve([]),
    ])
      .then(([settingsRes, products]) => {
        setStartLetter(settingsRes.data.sticker_cipher_start_letter || '');
        const expanded = [];
        products.forEach(p => {
          for (let i = 0; i < p.qty; i++) {
            expanded.push({
              key: `${p.id}-${i}`,
              brand: p.attributes?.brand || '',
              name: p.name,
              ram: p.attributes?.ram || '',
              storage: p.attributes?.storage || '',
              selling_price: p.selling_price,
            });
          }
        });
        setStickers(expanded);
        if (items.length === 0) setError('No products selected. Go to Generate Stickers first.');
      })
      .catch(() => setError('Failed to load sticker data.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const saveStartLetter = async () => {
    if (!isValidStartLetter(letterInput)) {
      toast.error('Pick a starting letter A-Z');
      return;
    }
    setSavingLetter(true);
    try {
      await api.post('/settings', { sticker_cipher_start_letter: letterInput.toUpperCase() });
      setStartLetter(letterInput.toUpperCase());
      toast.success('Cipher starting letter saved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save starting letter');
    } finally {
      setSavingLetter(false);
    }
  };

  const cipherReady = isValidStartLetter(startLetter);
  const previewLetter = isValidStartLetter(letterInput) ? letterInput.toUpperCase() : startLetter;
  const previewMap = buildCipherMap(previewLetter);

  if (loading) {
    return <div className="text-center py-5"><div className="spinner-border text-primary" /></div>;
  }

  return (
    <div>
      <div className="page-header d-print-none">
        <h2>🖨️ Sticker Print</h2>
        <div className="d-flex gap-2">
          <Link to="/stickers/generate" className="btn btn-outline-secondary btn-sm">← Back to Generate</Link>
          {cipherReady && stickers.length > 0 && (
            <button className="btn btn-primary btn-sm fw-bold" onClick={() => window.print()}>🖨️ Print</button>
          )}
        </div>
      </div>

      {error && (
        <div className="alert alert-warning d-print-none">{error}</div>
      )}

      {hasFullAccess() && (
        <div className="form-card mb-3 d-print-none">
          <div className="form-card-title">🔑 Cipher Code Setup</div>
          <div className="row g-3 align-items-end mb-3">
            <div className="col-12 col-md-5">
              <label className="form-label fw-semibold">
                Starting letter <span className="text-danger">*</span>
                <span className="ms-2 text-muted fw-normal" style={{ fontSize: '0.76rem' }}>digit 0 = this letter, then counts forward (1 = next letter, 2 = next after that...)</span>
              </label>
              <select className="form-select" value={letterInput} onChange={e => setLetterInput(e.target.value)}>
                <option value="">— Select —</option>
                {ALPHA.split('').map(l => <option key={l} value={l}>{l}</option>)}
              </select>
              {startLetter && (
                <div className="form-text">Current: <code>{startLetter}</code></div>
              )}
            </div>
            <div className="col-auto">
              <button className="btn btn-outline-primary" disabled={savingLetter} onClick={saveStartLetter}>
                💾 Save
              </button>
            </div>
          </div>

          {previewMap && (
            <div>
              <div className="text-muted fw-semibold text-uppercase mb-2" style={{ fontSize: '0.76rem' }}>
                Digit → Letter Lookup {letterInput && letterInput !== startLetter ? '(preview, not yet saved)' : ''}
              </div>
              <table className="table table-bordered table-sm text-center mb-0 font-monospace" style={{ maxWidth: 560 }}>
                <thead className="table-light">
                  <tr>{Array.from({ length: 10 }, (_, d) => <th key={d}>{d}</th>)}</tr>
                </thead>
                <tbody>
                  <tr>{Array.from({ length: 10 }, (_, d) => <td key={d} className="fw-bold">{previewMap[d]}</td>)}</tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!cipherReady && !hasFullAccess() && (
        <div className="alert alert-info d-print-none">
          The sticker cipher hasn't been set up yet. Ask an owner/admin to configure it here.
        </div>
      )}

      {cipherReady && stickers.length > 0 && (
        <div className="sticker-sheet">
          {stickers.map(s => (
            <div className="sticker" key={s.key}>
              <div className="sticker-brand">{s.brand}</div>
              <div className="sticker-model">{s.name}</div>
              {(s.ram || s.storage) && (
                <div className="sticker-specs">{[s.ram, s.storage].filter(Boolean).join(' / ')}</div>
              )}
              <div className="sticker-code">{priceToCipher(s.selling_price, startLetter)}</div>
            </div>
          ))}
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .sticker-sheet {
          display: flex;
          flex-wrap: wrap;
          gap: 2mm;
        }
        .sticker {
          width: 1in;
          height: 1in;
          box-sizing: border-box;
          border: 1px dashed #999;
          padding: 1mm;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
          overflow: hidden;
          page-break-inside: avoid;
        }
        .sticker-brand { font-size: 6pt; font-weight: 700; text-transform: uppercase; line-height: 1.1; }
        .sticker-model { font-size: 5.5pt; font-weight: 600; line-height: 1.1; }
        .sticker-specs { font-size: 5pt; color: #444; line-height: 1.1; }
        .sticker-code { font-family: monospace; font-size: 9pt; font-weight: 800; letter-spacing: 1.5px; margin-top: 1mm; }

        @media print {
          @page { size: A4; margin: 8mm; }
          body * { visibility: hidden; }
          .sticker-sheet, .sticker-sheet * { visibility: visible; }
          .sticker-sheet { position: absolute; left: 0; top: 0; }
          .d-print-none { display: none !important; }
        }
      `}} />
    </div>
  );
}
