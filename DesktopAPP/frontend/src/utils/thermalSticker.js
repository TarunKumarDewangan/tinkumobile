import QRCode from 'qrcode';

// 58 mm thermal printers (e.g. Posiflow 58D) print 48 mm wide at 203 dpi = 384 dots (8 dots per mm).
export const DOTS_PER_MM = 8;
export const PRINT_WIDTH_MM = 48;
export const PAPER_WIDTH_MM = 58;

/**
 * Label-roll layout (mm). Pre-cut label rolls sit so the print head starts a few mm
 * inside the label, so the printed area is narrower than the full 48 mm head:
 *  - heightMm: label height, gapMm: blank gap between labels (each sticker advances height + gap)
 *  - widthMm: width actually printed, shiftMm: move the print right from the head's left edge
 */
export const DEFAULT_LAYOUT = { heightMm: 25.4, gapMm: 3, widthMm: 40, shiftMm: 0 };
export function normalizeLayout(l = {}) {
  const num = (v, d, min, max) => { const n = parseFloat(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d; };
  const shiftMm = num(l.shiftMm, DEFAULT_LAYOUT.shiftMm, 0, 20);
  return {
    heightMm: num(l.heightMm, DEFAULT_LAYOUT.heightMm, 15, 60),
    gapMm: num(l.gapMm, DEFAULT_LAYOUT.gapMm, 0, 10),
    shiftMm,
    widthMm: Math.min(PRINT_WIDTH_MM - shiftMm, num(l.widthMm, DEFAULT_LAYOUT.widthMm, 25, PRINT_WIDTH_MM)),
  };
}
const W = PRINT_WIDTH_MM * DOTS_PER_MM; // 384

const FONT = 'Arial, Helvetica, sans-serif';

function fitFont(ctx, text, weight, maxPx, minPx, maxWidth) {
  let size = maxPx;
  ctx.font = `${weight} ${size}px ${FONT}`;
  while (size > minPx && ctx.measureText(text).width > maxWidth) {
    size -= 1;
    ctx.font = `${weight} ${size}px ${FONT}`;
  }
  return size;
}

// Split text into at most `maxLines` lines that fit `maxWidth`.
function wrapLines(ctx, text, maxWidth, maxLines) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width <= maxWidth || !line) {
      line = test;
    } else {
      lines.push(line);
      line = w;
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && words.join(' ') !== lines.join(' ')) {
    let last = lines[maxLines - 1];
    while (last.length > 1 && ctx.measureText(last + '…').width > maxWidth) last = last.slice(0, -1);
    lines[maxLines - 1] = last + '…';
  }
  return lines;
}

// Selling price is printed as a shop code: B L A C K W H I T E = 1 2 3 4 5 6 7 8 9 0
const CODE_LETTERS = ['E', 'B', 'L', 'A', 'C', 'K', 'W', 'H', 'I', 'T'];
export function priceCode(price) {
  const n = Math.round(parseFloat(price) || 0);
  if (n <= 0) return '';
  return String(n).split('').map(d => CODE_LETTERS[+d]).join('');
}

// Text kept in the QR: "VIVO V70 FE 5G 8 256:IMEI". The sale screen reads the part after ':'.
// Kept to ~30 characters (model name shortened, RAM/storage always kept) so the QR
// stays small with big squares that scan easily from thermal paper.
const QR_INFO_MAX = 30;
export function setInfo(s) {
  const num = v => String(v || '').replace(/\s*(GB|TB|MB)\s*$/i, '').trim();
  const specs = [num(s.ram), num(s.storage)].filter(Boolean).join(' ');
  const room = Math.max(8, QR_INFO_MAX - (specs ? specs.length + 1 : 0));
  let name = String(s.name || '').replace(/:/g, ' ').replace(/\s+/g, ' ').trim();
  if (name.length > room) {
    const cut = name.slice(0, room + 1);
    name = (cut.lastIndexOf(' ') > 0 ? cut.slice(0, cut.lastIndexOf(' ')) : name.slice(0, room)).trim(); // whole words only
  }
  return [name, specs].filter(Boolean).join(' ');
}
export function qrValue(s) {
  const id = s.imei || s.sku || '';
  const info = setInfo(s);
  return id ? `${info}:${id}` : info;
}

// QR drawn module-by-module with whole-dot squares so it stays sharp on thermal paper.
// Returns its size; drawn left-aligned at x and vertically centred within `areaH`.
function drawQr(ctx, text, x, areaH, maxSize = 190) {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const n = qr.modules.size;
  const quiet = 2; // white border scanners need
  const px = Math.max(1, Math.floor(Math.min(areaH, maxSize) / (n + quiet * 2)));
  const size = px * (n + quiet * 2);
  const y = Math.max(0, Math.floor((areaH - size) / 2));
  ctx.fillStyle = '#000';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.modules.get(r, c)) ctx.fillRect(x + (c + quiet) * px, y + (r + quiet) * px, px, px);
    }
  }
  return size;
}

/**
 * Draw one sticker (default 2 × 1 inch label) as a black/white canvas 384 dots wide (the full head).
 * Content is placed inside [shift, shift + width] so it lands inside the label.
 * Left: QR (set info + IMEI). Right: shop, NEW/USED, model, RAM/storage, IMEI, MRP, price code.
 */
export function renderSticker(s, { shopName, layout }) {
  const L = normalizeLayout(layout);
  const H = Math.round(L.heightMm * DOTS_PER_MM);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'top';

  const left = Math.round(L.shiftMm * DOTS_PER_MM);
  const right = Math.min(W, left + Math.round(L.widthMm * DOTS_PER_MM));
  const vpad = 6; // keep clear of the label's top/bottom edge
  const usable = H - vpad * 2;

  // QR on the left — at most ~42% of the width so text has room
  let qrSize = 0;
  try {
    qrSize = drawQr(ctx, qrValue(s), left, H, Math.min(usable, Math.round((right - left) * 0.42)));
  } catch {
    qrSize = 0; // text too long for a QR — print without it
  }

  const x0 = left + qrSize + 2;
  const colW = right - x0;
  ctx.fillStyle = '#000';
  ctx.textAlign = 'left';
  let y = vpad;

  // Shop name + NEW/USED box
  const cond = s.condition === 'new' ? 'NEW' : 'USED';
  ctx.font = `bold 14px ${FONT}`;
  const condW = ctx.measureText(cond).width + 6;
  const shop = String(shopName).toUpperCase();
  const shopSize = fitFont(ctx, shop, 'bold', 15, 9, colW - condW - 3);
  ctx.fillText(shop, x0, y + 1);
  ctx.fillRect(right - condW, y, condW, 17);
  ctx.fillStyle = '#fff';
  ctx.font = `bold 14px ${FONT}`;
  ctx.fillText(cond, right - condW + 3, y + 2);
  ctx.fillStyle = '#000';
  y += Math.max(shopSize, 17) + 3;

  // Model (up to 2 lines)
  ctx.font = `bold 17px ${FONT}`;
  for (const line of wrapLines(ctx, s.name, colW, 2)) {
    ctx.fillText(line, x0, y);
    y += 19;
  }

  // RAM / storage / colour
  const specs = ([s.ram, s.storage].filter(Boolean).join(' / ') + (s.color ? `  ${s.color}` : '')).trim();
  if (specs) {
    fitFont(ctx, specs, 'normal', 14, 9, colW);
    ctx.fillText(specs, x0, y);
    y += 16;
  }

  if (s.imei) {
    fitFont(ctx, `IMEI ${s.imei}`, 'normal', 14, 9, colW);
    ctx.fillText(`IMEI ${s.imei}`, x0, y);
  }

  // Bottom line: MRP left, price code right (bold, large)
  const code = priceCode(s.price);
  const codeSize = 22;
  const by = H - vpad - codeSize;
  ctx.font = `bold ${codeSize}px ${FONT}`;
  const codeW = code ? ctx.measureText(code).width : 0;
  if (code) ctx.fillText(code, right - codeW, by);
  const mrpVal = parseFloat(s.mrp || 0);
  if (mrpVal > 0) {
    const mrp = `MRP ₹${mrpVal.toLocaleString('en-IN')}`;
    const ms = fitFont(ctx, mrp, 'bold', 16, 9, colW - codeW - 4);
    ctx.fillText(mrp, x0, by + (codeSize - ms));
  }

  return c;
}

/**
 * ESC/POS raster bytes (GS v 0) for a list of canvases. After each sticker the paper
 * advances exactly `gapMm` (ESC J, in dots) so every sticker lands on the next label —
 * no extra feed at the end, which used to push half a label out.
 */
export function escposForCanvases(canvases, gapMm = 0) {
  const bytes = [0x1b, 0x40]; // ESC @ init
  for (const c of canvases) {
    const ctx = c.getContext('2d');
    const { width, height } = c;
    const data = ctx.getImageData(0, 0, width, height).data;
    const rowBytes = Math.ceil(width / 8);
    const BAND = 64; // send in bands so small printer buffers don't overflow
    for (let top = 0; top < height; top += BAND) {
      const rows = Math.min(BAND, height - top);
      bytes.push(0x1d, 0x76, 0x30, 0x00, rowBytes & 0xff, rowBytes >> 8, rows & 0xff, rows >> 8);
      for (let yy = top; yy < top + rows; yy++) {
        for (let xb = 0; xb < rowBytes; xb++) {
          let b = 0;
          for (let bit = 0; bit < 8; bit++) {
            const x = xb * 8 + bit;
            if (x < width) {
              const i = (yy * width + x) * 4;
              const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
              if (lum < 140) b |= 0x80 >> bit;
            }
          }
          bytes.push(b);
        }
      }
    }
    let gap = Math.round(gapMm * DOTS_PER_MM);
    while (gap > 0) { const n = Math.min(255, gap); bytes.push(0x1b, 0x4a, n); gap -= n; } // ESC J n — feed n dots
  }
  return new Uint8Array(bytes);
}

function toBase64(u8) {
  let s = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < u8.length; i += CHUNK) s += String.fromCharCode.apply(null, u8.subarray(i, i + CHUNK));
  return btoa(s);
}

/** Send raw bytes to the RawBT Android app (it prints to the paired Bluetooth/USB printer). */
export function sendToRawBT(bytes) {
  window.location.href = `intent:base64,${toBase64(bytes)}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`;
}

/** Print canvases on a PC through the browser, page = one sticker on a 58 mm roll. */
export function printCanvasesInBrowser(canvases, layout) {
  const L = normalizeLayout(layout);
  const heightMm = L.heightMm;
  const pageMm = L.heightMm + L.gapMm;
  const imgs = canvases.map(c => `<div class="p"><img src="${c.toDataURL('image/png')}"></div>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Stickers</title><style>
    @page { size: ${PAPER_WIDTH_MM}mm ${pageMm}mm; margin: 0; }
    html, body { margin: 0; padding: 0; background: #fff; }
    .p { width: ${PAPER_WIDTH_MM}mm; height: ${pageMm}mm; display: flex; justify-content: center; align-items: flex-start; overflow: hidden; page-break-after: always; break-after: page; }
    .p:last-child { page-break-after: auto; break-after: auto; }
    img { width: ${PRINT_WIDTH_MM}mm; height: ${heightMm}mm; image-rendering: pixelated; }
  </style></head><body>${imgs}</body></html>`;

  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(frame);
  const doc = frame.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();
  const go = () => {
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(() => frame.remove(), 60000);
  };
  const images = Array.from(doc.images);
  Promise.all(images.map(im => (im.complete ? 1 : new Promise(r => { im.onload = im.onerror = r; })))).then(go);
}
