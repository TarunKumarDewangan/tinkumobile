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
export const DEFAULT_LAYOUT = { heightMm: 23.5, gapMm: 3, widthMm: 40, shiftMm: 0 };
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
// Returns its size; drawn left-aligned at x and vertically centred within [top, top + areaH].
function drawQr(ctx, text, x, areaH, maxSize = 190, top = 0) {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const n = qr.modules.size;
  const quiet = 2; // white border scanners need
  const px = Math.max(1, Math.floor(Math.min(areaH, maxSize) / (n + quiet * 2)));
  const size = px * (n + quiet * 2);
  const y = top + Math.max(0, Math.floor((areaH - size) / 2));
  ctx.fillStyle = '#000';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.modules.get(r, c)) ctx.fillRect(x + (c + quiet) * px, y + (r + quiet) * px, px, px);
    }
  }
  return size;
}

/**
 * Draw one sticker as a black/white canvas 384 dots wide (the full head); content sits inside
 * [shift, shift + width] so it lands on the label. Layout (owner's design):
 *   top:    date + NEW|USED (left)                       SHOP NAME (right)
 *   middle: model / RAM·storage·colour / IMEI / MRP (centred)   QR (right)
 *   bottom: purchase-price code (left)                   selling-price code (right)
 * Purchase and selling price are never printed as numbers — only their BLACKWHITE codes.
 */
export function renderSticker(s, { shopName, layout, date = new Date() }) {
  const L = normalizeLayout(layout);
  const H = Math.round(L.heightMm * DOTS_PER_MM);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'top';

  const left = Math.round(L.shiftMm * DOTS_PER_MM);
  const right = Math.min(W, left + Math.round(L.widthMm * DOTS_PER_MM));
  const pad = 8; // ~1 mm in from the label edges
  const inL = left + pad;
  const inR = right - pad;
  const write = (text, x, y, size, weight, align) => {
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
  };

  // ── top line: date + NEW/USED on the left, shop name on the right
  const TOP = 16;
  const d = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getFullYear()).slice(2)}`;
  const dateText = `${d}  ${s.condition === 'new' ? 'NEW' : 'USED'}`;
  ctx.font = `bold ${TOP}px ${FONT}`;
  const dateW = ctx.measureText(dateText).width;
  write(dateText, inL, pad, TOP, 'bold', 'left');
  const shop = String(shopName || '').toUpperCase();
  const shopSize = fitFont(ctx, shop, 'bold', TOP, 9, inR - inL - dateW - 10);
  write(shop, inR, pad + (TOP - shopSize), shopSize, 'bold', 'right');

  // ── bottom line: purchase code (left), selling code (right)
  const BOT = 18;
  const botY = H - pad - BOT;
  const buy = priceCode(s.purchase_price);
  const sell = priceCode(s.price);
  if (buy) write(buy, inL, botY, BOT, 'bold', 'left');
  if (sell) write(sell, inR, botY, BOT, 'bold', 'right');

  // ── middle band between the two lines
  const midTop = pad + TOP + 6;
  const midBot = (buy || sell) ? botY - 6 : H - pad;
  const midH = midBot - midTop;

  // QR on the right, as big as the band allows (max ~40% of the width)
  let qrSize = 0;
  try {
    const maxQr = Math.min(midH, Math.round((right - left) * 0.4));
    const probe = QRCode.create(qrValue(s), { errorCorrectionLevel: 'M' }).modules.size + 4;
    const size = Math.max(1, Math.floor(maxQr / probe)) * probe;
    qrSize = drawQr(ctx, qrValue(s), inR - size + 4, midH, maxQr, midTop); // +4: QR has its own white border
  } catch {
    qrSize = 0; // text too long for a QR — print without it
  }

  // text column left of the QR, every line centred
  const colL = inL;
  const colR = qrSize ? inR - qrSize : inR;
  const colW = colR - colL;
  const mid = (colL + colR) / 2;
  const rows = [];
  const line = (text, max, min, weight) => {
    const size = fitFont(ctx, text, weight, max, min, colW);
    rows.push({ h: size, imei: false, draw: y => write(text, mid, y, size, weight, 'center') });
  };

  // model: big; wraps to 2 lines only if it can't fit on one at a readable size
  const name = String(s.name || '');
  ctx.font = `bold 22px ${FONT}`;
  if (ctx.measureText(name).width > colW && fitFont(ctx, name, 'bold', 22, 8, colW) < 16) {
    ctx.font = `bold 17px ${FONT}`;
    for (const ln of wrapLines(ctx, name, colW, 2)) line(ln, 17, 10, 'bold');
  } else {
    line(name, 22, 12, 'bold');
  }
  const specs = ([s.ram, s.storage].filter(Boolean).join(' / ') + (s.color ? `  ${String(s.color).toUpperCase()}` : '')).trim();
  if (specs) line(specs, 18, 10, 'normal');
  if (s.imei) { line(`IMEI ${s.imei}`, 15, 9, 'normal'); rows[rows.length - 1].imei = true; }
  const mrpVal = parseFloat(s.mrp || 0);
  if (mrpVal > 0) line(`MRP: ₹${mrpVal.toLocaleString('en-IN')}`, 19, 10, 'bold');

  // drop the IMEI line if everything doesn't fit (it is inside the QR anyway)
  const total = () => rows.reduce((a, r) => a + r.h, 0);
  if (total() + (rows.length - 1) * 2 > midH) {
    const i = rows.findIndex(r => r.imei);
    if (i >= 0) rows.splice(i, 1);
  }
  const gap = Math.max(2, Math.min(10, Math.floor((midH - total()) / Math.max(1, rows.length + 1))));
  let y = midTop + Math.max(0, Math.floor((midH - total() - gap * (rows.length - 1)) / 2));
  for (const r of rows) { r.draw(y); y += r.h + gap; }

  ctx.textAlign = 'left';
  toBlackAndWhite(ctx, W, H);
  return c;
}

// Snap every pixel to black or white with the same cut-off as the printer, so grey
// anti-aliasing never reaches a driver (which smears it) and previews match the print.
function toBlackAndWhite(ctx, w, h) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2] < 140 ? 0 : 255;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

// ---------- PC direct print (Chrome/Edge Web Serial → the printer's COM port) ----------

export const canPrintDirect = typeof navigator !== 'undefined' && 'serial' in navigator;

/**
 * Send ESC/POS bytes straight to the printer's serial port (USB or Bluetooth COM port),
 * the same raw data RawBT sends on Android — no print dialog, no driver scaling.
 * First use (or `choosePort`) asks the user to pick the port; later prints reuse it.
 */
export async function printDirect(bytes, { choosePort = false } = {}) {
  let port = null;
  if (!choosePort) {
    const ports = await navigator.serial.getPorts();
    if (ports.length === 1) port = ports[0];
    else if (ports.length > 1) {
      const last = Number(localStorage.getItem('stickerSerialPortIndex'));
      port = ports[Number.isInteger(last) && last < ports.length ? last : ports.length - 1];
    }
  }
  if (!port) port = await navigator.serial.requestPort();
  try {
    const all = await navigator.serial.getPorts();
    localStorage.setItem('stickerSerialPortIndex', String(all.indexOf(port)));
  } catch { /* ignore */ }

  await port.open({ baudRate: 9600 });
  try {
    const writer = port.writable.getWriter();
    try {
      const CHUNK = 1024;
      for (let i = 0; i < bytes.length; i += CHUNK) await writer.write(bytes.subarray(i, i + CHUNK));
      await writer.close();
    } finally {
      writer.releaseLock();
    }
  } finally {
    await port.close();
  }
}

// ---------- sticker image download (PNG at 203 dpi, so it opens at the real label size) ----------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// PNG with a pHYs chunk saying 8 dots per mm (203 dpi), inserted right after IHDR.
async function stickerPng(canvas) {
  const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
  const png = new Uint8Array(await blob.arrayBuffer());
  const ppm = DOTS_PER_MM * 1000;
  const chunk = new Uint8Array(21);
  const dv = new DataView(chunk.buffer);
  dv.setUint32(0, 9);
  chunk.set([0x70, 0x48, 0x59, 0x73], 4); // "pHYs"
  dv.setUint32(8, ppm);
  dv.setUint32(12, ppm);
  chunk[16] = 1; // unit: metre
  dv.setUint32(17, crc32(chunk.subarray(4, 17)));
  const ihdrEnd = 8 + 25;
  const out = new Uint8Array(png.length + chunk.length);
  out.set(png.subarray(0, ihdrEnd), 0);
  out.set(chunk, ihdrEnd);
  out.set(png.subarray(ihdrEnd), ihdrEnd + chunk.length);
  return new Blob([out], { type: 'image/png' });
}

/** Download each sticker as a PNG image of the label's real size (48 mm wide, 203 dpi). */
export async function downloadStickerImages(items) {
  for (let i = 0; i < items.length; i++) {
    const { canvas, name } = items[i];
    const blob = await stickerPng(canvas);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${String(name || 'Sticker').replace(/[^\w-]+/g, '_')}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    if (i < items.length - 1) await new Promise(r => setTimeout(r, 400));
  }
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
