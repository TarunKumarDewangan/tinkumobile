import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { downloadLabelTemplates } from '../../utils/labelTemplate';
import { renderSticker, escposForCanvases, sendToRawBT, printCanvasesInBrowser, DEFAULT_LAYOUT, normalizeLayout, PRINT_WIDTH_MM } from '../../utils/thermalSticker';

const SETTINGS_KEY = 'stickerPrintSettings';
const RAWBT_BATCH = 12; // stickers per send — keeps the Android hand-off small and reliable
const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return { copies: Math.min(10, Math.max(1, parseInt(s.copies) || 1)), layout: normalizeLayout(s.layout) };
  } catch {
    return { copies: 1, layout: { ...DEFAULT_LAYOUT } };
  }
}

const LAYOUT_FIELDS = [
  { key: 'heightMm', label: 'Label height' },
  { key: 'gapMm', label: 'Gap between labels' },
  { key: 'widthMm', label: 'Print width' },
  { key: 'shiftMm', label: 'Move right' },
];

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

  const layout = useMemo(() => normalizeLayout(settings.layout), [settings.layout]);
  const setLayout = (key, value) => setSettings(s => ({ ...s, layout: { ...s.layout, [key]: value } }));

  const rendered = useMemo(
    () => stickers.map(s => ({ key: s.key, canvas: renderSticker(s, { shopName, layout }) })),
    [stickers, shopName, layout]
  );
  const previews = useMemo(() => rendered.map(r => ({ key: r.key, src: r.canvas.toDataURL('image/png') })), [rendered]);
  // Copies repeat each sticker back-to-back.
  const canvases = useMemo(() => rendered.flatMap(r => Array(settings.copies).fill(r.canvas)), [rendered, settings.copies]);

  const batches = useMemo(() => {
    const out = [];
    for (let i = 0; i < canvases.length; i += RAWBT_BATCH) out.push({ from: i + 1, to: Math.min(i + RAWBT_BATCH, canvases.length), items: canvases.slice(i, i + RAWBT_BATCH) });
    return out;
  }, [canvases]);

  const printPc = (items = canvases) => printCanvasesInBrowser(items, layout);
  const printMobile = (items) => sendToRawBT(escposForCanvases(items, layout.gapMm));
  const testPrint = () => (isAndroid ? printMobile(canvases.slice(0, 1)) : printPc(canvases.slice(0, 1)));

  const pcBtn = (
    <button className={`btn btn-sm fw-bold ${isAndroid ? 'btn-outline-secondary' : 'btn-primary'}`} onClick={() => printPc()}>
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
          {stickers.length > 0 && (
            <button className="btn btn-sm btn-outline-secondary fw-bold" title="One file per sticker, for the label printer's own software (48 × 30 mm). QR not included yet."
              onClick={() => downloadLabelTemplates(stickers, { shopName })}>
              💾 Save label file
            </button>
          )}
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
              <span className="small text-muted">{canvases.length} sticker{canvases.length === 1 ? '' : 's'} · purchase &amp; selling price printed as code</span>
            </div>
            <div className="card-body py-2 border-top">
              <div className="small fw-semibold mb-2">Label setup (mm) — saved on this device</div>
              <div className="d-flex flex-wrap gap-3 align-items-end">
                {LAYOUT_FIELDS.map(f => (
                  <label key={f.key} className="mb-0">
                    <span className="small d-block text-muted">{f.label}</span>
                    <input type="number" step="0.5" className="form-control form-control-sm" style={{ width: 90 }}
                      value={settings.layout?.[f.key] ?? ''}
                      onChange={e => setLayout(f.key, e.target.value)}
                      onBlur={() => setSettings(s => ({ ...s, layout: normalizeLayout(s.layout) }))} />
                  </label>
                ))}
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setSettings(s => ({ ...s, layout: { ...DEFAULT_LAYOUT } }))}>Reset</button>
                <button type="button" className="btn btn-outline-primary btn-sm fw-bold" onClick={testPrint}>🧪 Test print 1 sticker</button>
              </div>
              <div className="small text-muted mt-2">
                Cut on the right? Lower <b>Print width</b>. Too close to the left edge? Raise <b>Move right</b>.
                Each print drifting into the next label? Adjust <b>Gap between labels</b>.
              </div>
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
            {previews.map(p => (
              <div key={p.key} className="sticker-preview-item">
                <img src={p.src} alt="sticker" />
                <div className="sticker-preview-area" style={{ left: `${(layout.shiftMm / PRINT_WIDTH_MM) * 100}%`, width: `${(layout.widthMm / PRINT_WIDTH_MM) * 100}%` }} />
              </div>
            ))}
          </div>
        </>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .sticker-preview { display: flex; flex-wrap: wrap; gap: 12px; }
        .sticker-preview-item { position: relative; width: 288px; max-width: 100%; border: 1px solid #ccc; background: #fff; }
        .sticker-preview-item img { display: block; width: 100%; height: auto; image-rendering: pixelated; }
        .sticker-preview-area { position: absolute; top: 0; bottom: 0; border: 1px dashed #0d6efd; pointer-events: none; }
      `}} />
    </div>
  );
}
