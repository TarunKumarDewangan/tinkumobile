import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { renderSticker, escposForCanvases, sendToRawBT, printCanvasesInBrowser, STICKER_HEIGHT_MM } from '../../utils/thermalSticker';

const SETTINGS_KEY = 'stickerPrintSettings';
const RAWBT_BATCH = 12; // stickers per send — keeps the Android hand-off small and reliable
const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return { copies: Math.min(10, Math.max(1, parseInt(s.copies) || 1)) };
  } catch {
    return { copies: 1 };
  }
}

export default function StickerPrint() {
  const { user } = useAuth();
  const shopName = user?.shop?.name || 'TINKU MOBILE';
  const [stickers, setStickers] = useState([]);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState(loadSettings);

  useEffect(() => {
    let rows = [];
    try { rows = JSON.parse(sessionStorage.getItem('stickerPrintBatch') || '[]'); } catch { rows = []; }
    if (rows.length === 0) {
      setError('No priced stickers found. Go to Generate Stickers first.');
      return;
    }
    setStickers(rows);
  }, []);

  useEffect(() => {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* ignore */ }
  }, [settings]);

  const rendered = useMemo(
    () => stickers.map(s => ({ key: s.key, canvas: renderSticker(s, { shopName, heightMm: STICKER_HEIGHT_MM }) })),
    [stickers, shopName]
  );
  const previews = useMemo(() => rendered.map(r => ({ key: r.key, src: r.canvas.toDataURL('image/png') })), [rendered]);
  // Copies repeat each sticker back-to-back.
  const canvases = useMemo(() => rendered.flatMap(r => Array(settings.copies).fill(r.canvas)), [rendered, settings.copies]);

  const batches = useMemo(() => {
    const out = [];
    for (let i = 0; i < canvases.length; i += RAWBT_BATCH) out.push({ from: i + 1, to: Math.min(i + RAWBT_BATCH, canvases.length), items: canvases.slice(i, i + RAWBT_BATCH) });
    return out;
  }, [canvases]);

  const printPc = () => printCanvasesInBrowser(canvases, STICKER_HEIGHT_MM);
  const printMobile = (items) => sendToRawBT(escposForCanvases(items));

  const pcBtn = (
    <button className={`btn btn-sm fw-bold ${isAndroid ? 'btn-outline-secondary' : 'btn-primary'}`} onClick={printPc}>
      🖨️ Print (PC)
    </button>
  );
  const mobileBtns = batches.length <= 1 ? (
    <button className={`btn btn-sm fw-bold ${isAndroid ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => printMobile(canvases)}>
      📱 Print on Mobile (RawBT)
    </button>
  ) : batches.map(b => (
    <button key={b.from} className={`btn btn-sm fw-bold ${isAndroid ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => printMobile(b.items)}>
      📱 RawBT {b.from}–{b.to}
    </button>
  ));

  return (
    <div>
      <div className="page-header">
        <h2>🖨️ Sticker Print</h2>
        <div className="d-flex gap-2 flex-wrap">
          <Link to="/stickers/prices" className="btn btn-outline-secondary btn-sm">← Back to Prices</Link>
          {stickers.length > 0 && (isAndroid ? <>{mobileBtns}{pcBtn}</> : <>{pcBtn}{mobileBtns}</>)}
        </div>
      </div>

      {error && <div className="alert alert-warning">{error}</div>}

      {stickers.length > 0 && (
        <>
          <div className="card mb-3">
            <div className="card-body py-2 d-flex flex-wrap gap-3 align-items-center">
              <label className="d-flex align-items-center gap-2 mb-0">
                <span className="small fw-semibold">Copies each</span>
                <input type="number" min="1" max="10" className="form-control form-control-sm" style={{ width: 70 }} value={settings.copies}
                  onChange={e => setSettings(s => ({ ...s, copies: Math.min(10, Math.max(1, parseInt(e.target.value) || 1)) }))} />
              </label>
              <span className="small text-muted">{canvases.length} sticker{canvases.length === 1 ? '' : 's'} · 2 × 1 inch · selling price printed as code</span>
            </div>
          </div>

          <details className="mb-3 small">
            <summary className="fw-semibold">Printer setup help (Posiflow 58 mm)</summary>
            <div className="mt-2">
              <div><b>PC:</b> connect by USB, install the Posiflow 58 driver. In the print window choose the Posiflow printer, Margins <b>None</b>, Scale <b>100</b>, untick <b>Headers and footers</b>.</div>
              <div className="mt-1"><b>Android:</b> install <b>RawBT</b> from the Play Store, pair the printer by Bluetooth inside RawBT once, then use <b>Print on Mobile</b>.</div>
            </div>
          </details>

          <div className="sticker-preview">
            {previews.map(p => <img key={p.key} src={p.src} alt="sticker" />)}
          </div>
        </>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .sticker-preview { display: flex; flex-wrap: wrap; gap: 12px; }
        .sticker-preview img { width: 288px; height: auto; border: 1px solid #ccc; background: #fff; image-rendering: pixelated; }
      `}} />
    </div>
  );
}
