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

// Lighten a box on a 1-bit printer: snap it to black/white, then clear 1 dot in every 2×2 block
// so the price codes print a bit lighter (greyish) than other text.
function fadeBox(ctx, x, y, w, h) {
  x = Math.max(0, Math.floor(x)); y = Math.max(0, Math.floor(y));
  w = Math.min(ctx.canvas.width - x, Math.ceil(w)); h = Math.min(ctx.canvas.height - y, Math.ceil(h));
  if (w <= 0 || h <= 0) return;
  const img = ctx.getImageData(x, y, w, h);
  const d = img.data;
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const i = (r * w + c) * 4;
      const dark = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2] < 140 && !((x + c) % 2 === 0 && (y + r) % 2 === 0);
      d[i] = d[i + 1] = d[i + 2] = dark ? 0 : 255;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, x, y);
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
 * Draw one sticker (default 2 × 1 inch label) as a black/white canvas 384 dots wide (the full head).
 * Content is placed inside [shift, shift + width] so it lands inside the label.
 * Right: QR (set info + IMEI) with the selling-price code under it (bottom-right corner).
 * Top-left corner: purchase-price code. Middle, every line centred:
 *   SHOP NAME / date + NEW|USED / model / RAM·storage·colour / IMEI / MRP.
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
  ctx.textBaseline = 'top';

  const left = Math.round(L.shiftMm * DOTS_PER_MM);
  const right = Math.min(W, left + Math.round(L.widthMm * DOTS_PER_MM));
  const vpad = 10; // ~1.25 mm clear of the label's top/bottom edge
  const inset = 12; // ~1.5 mm clear of the label's left/right edge for the corner codes
  const usable = H - vpad * 2;

  const sellCode = priceCode(s.price);
  const buyCode = priceCode(s.purchase_price);
  const SELL_H = 18;

  // QR on the right — at most ~40% of the width so the text has room;
  // the selling-price code sits under it, so the QR uses the height above that.
  let qrSize = 0;
  const qrAreaH = sellCode ? usable - SELL_H - 2 : usable;
  try {
    const maxQr = Math.min(qrAreaH, Math.round((right - left) * 0.4));
    const probe = QRCode.create(qrValue(s), { errorCorrectionLevel: 'M' }).modules.size + 4;
    const size = Math.max(1, Math.floor(maxQr / probe)) * probe;
    qrSize = drawQr(ctx, qrValue(s), right - size, qrAreaH, maxQr, vpad);
  } catch {
    qrSize = 0; // text too long for a QR — print without it
  }

  // Bottom-right: selling price as code
  if (sellCode) {
    const size = fitFont(ctx, sellCode, 'bold', SELL_H, 10, Math.max(qrSize, 80) - inset);
    ctx.font = `bold ${size}px ${FONT}`;
    ctx.fillStyle = '#000';
    ctx.textAlign = 'right';
    ctx.fillText(sellCode, right - inset, H - vpad - size);
    const w = ctx.measureText(sellCode).width;
    fadeBox(ctx, right - inset - w - 1, H - vpad - size - 1, w + 2, size + 4);
  }

  const colL = left;
  const colR = right - qrSize - (qrSize ? 4 : 0);
  const colW = colR - colL;
  const mid = (colL + colR) / 2;
  ctx.fillStyle = '#000';
  ctx.textAlign = 'center';

  // Build the rows first (height + how to draw), then spread them over the label height.
  const rows = [];
  const text = (str, weight, max, min) => {
    const size = fitFont(ctx, str, weight, max, min, colW);
    rows.push({ h: size, draw: y => { ctx.font = `${weight} ${size}px ${FONT}`; ctx.fillText(str, mid, y); } });
  };

  // 1. shop name — shares its line with the purchase-price code in the top-left corner
  const shop = String(shopName).toUpperCase();
  ctx.font = `bold 15px ${FONT}`;
  const buyW = buyCode ? ctx.measureText(buyCode).width + 6 : 0;
  // with a code, the shop name is centred in the space to the right of it
  const shopL = buyCode ? colL + inset + buyW : colL;
  const shopMid = (shopL + colR) / 2;
  const shopSize = fitFont(ctx, shop, 'bold', 16, 8, Math.max(40, colR - shopL));
  rows.push({
    h: Math.max(shopSize, buyCode ? 15 : 0),
    draw: y => {
      ctx.font = `bold ${shopSize}px ${FONT}`;
      ctx.fillText(shop, shopMid, y);
      if (buyCode) {
        ctx.font = `bold 15px ${FONT}`;
        ctx.textAlign = 'left';
        ctx.fillText(buyCode, colL + inset, y);
        fadeBox(ctx, colL + inset - 1, y - 1, buyW - 4, 18);
        ctx.textAlign = 'center';
      }
    },
  });

  // 2. date + NEW/USED box
  const d = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getFullYear()).slice(2)}`;
  const cond = s.condition === 'new' ? 'NEW' : 'USED';
  rows.push({
    h: 16,
    draw: y => {
      ctx.font = `bold 13px ${FONT}`;
      const dw = ctx.measureText(d).width;
      const cw = ctx.measureText(cond).width + 8;
      const gap = 8;
      const x = mid - (dw + gap + cw) / 2;
      ctx.textAlign = 'left';
      ctx.fillText(d, x, y + 2);
      ctx.fillRect(x + dw + gap, y, cw, 16);
      ctx.fillStyle = '#fff';
      ctx.fillText(cond, x + dw + gap + 4, y + 2);
      ctx.fillStyle = '#000';
      ctx.textAlign = 'center';
    },
  });

  // 3. model (up to 2 lines)
  ctx.font = `bold 16px ${FONT}`;
  for (const line of wrapLines(ctx, s.name, colW, 2)) {
    rows.push({ h: 17, draw: y => { ctx.font = `bold 16px ${FONT}`; ctx.fillText(line, mid, y); } });
  }

  // 4. RAM / storage / colour
  const specs = ([s.ram, s.storage].filter(Boolean).join(' / ') + (s.color ? `  ${String(s.color).toUpperCase()}` : '')).trim();
  if (specs) text(specs, 'normal', 14, 9);

  // 5. IMEI
  if (s.imei) { text(`IMEI ${s.imei}`, 'normal', 12, 8); rows[rows.length - 1].imei = true; }

  // 6. MRP
  const mrpVal = parseFloat(s.mrp || 0);
  if (mrpVal > 0) text(`MRP: ₹${mrpVal.toLocaleString('en-IN')}`, 'bold', 15, 9);

  // Drop the IMEI line if everything doesn't fit (it is inside the QR anyway).
  const total = () => rows.reduce((a, r) => a + r.h, 0);
  if (total() + rows.length * 2 > usable && s.imei) {
    const i = rows.findIndex(r => r.imei);
    if (i >= 0) rows.splice(i, 1);
  }
  // The first row (shop name + purchase code) is pinned to the top corner;
  // the rest are spread evenly below it and centred in the remaining height.
  const [first, ...rest] = rows;
  first.draw(vpad);
  const restH = usable - first.h - 4;
  const restTotal = rest.reduce((a, r) => a + r.h, 0);
  const gap = Math.max(2, Math.min(8, Math.floor((restH - restTotal) / Math.max(1, rest.length))));
  let y = vpad + first.h + gap + Math.max(0, Math.floor((restH - restTotal - gap * rest.length) / 2));
  for (const r of rest) { r.draw(y); y += r.h + gap; }

  ctx.textAlign = 'left';
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
