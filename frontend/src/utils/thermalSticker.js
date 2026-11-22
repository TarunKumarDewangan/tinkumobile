import QRCode from 'qrcode';

// 58 mm thermal printers (e.g. Posiflow 58D) print 48 mm wide at 203 dpi = 384 dots (8 dots per mm).
export const DOTS_PER_MM = 8;
export const PRINT_WIDTH_MM = 48;
export const PAPER_WIDTH_MM = 58;
export const STICKER_HEIGHT_MM = 25.4; // 1 inch
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
function drawQr(ctx, text, x, areaH) {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const n = qr.modules.size;
  const quiet = 2; // white border scanners need
  const px = Math.max(1, Math.floor(Math.min(areaH, 190) / (n + quiet * 2)));
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
 * Draw one 2 × 1 inch sticker (384 × 203 dots, 48 mm print area) as a black/white canvas.
 * Left: QR (set info + IMEI). Right: shop, NEW/USED, model, RAM/storage, IMEI, MRP, price code.
 */
export function renderSticker(s, { shopName, heightMm = STICKER_HEIGHT_MM }) {
  const H = Math.round(heightMm * DOTS_PER_MM);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'top';

  const pad = 4;
  const cutZone = 6;
  const usable = H - cutZone;

  // QR on the left
  let qrSize = 0;
  try {
    qrSize = drawQr(ctx, qrValue(s), 0, usable);
  } catch {
    qrSize = 0; // text too long for a QR — print without it
  }

  const x0 = qrSize + 2;
  const colW = W - x0 - pad;
  ctx.fillStyle = '#000';
  ctx.textAlign = 'left';
  let y = 2;

  // Shop name + NEW/USED box
  const cond = s.condition === 'new' ? 'NEW' : 'USED';
  ctx.font = `bold 15px ${FONT}`;
  const condW = ctx.measureText(cond).width + 8;
  const shop = String(shopName).toUpperCase();
  const shopSize = fitFont(ctx, shop, 'bold', 16, 10, colW - condW - 4);
  ctx.fillText(shop, x0, y + 1);
  ctx.fillRect(W - pad - condW, y, condW, 18);
  ctx.fillStyle = '#fff';
  ctx.font = `bold 15px ${FONT}`;
  ctx.fillText(cond, W - pad - condW + 4, y + 2);
  ctx.fillStyle = '#000';
  y += Math.max(shopSize, 18) + 3;

  // Model (up to 2 lines)
  ctx.font = `bold 18px ${FONT}`;
  for (const line of wrapLines(ctx, s.name, colW, 2)) {
    ctx.fillText(line, x0, y);
    y += 20;
  }

  // RAM / storage / colour
  const specs = [s.ram, s.storage].filter(Boolean).join(' / ') + (s.color ? `  ${s.color}` : '');
  if (specs.trim()) {
    fitFont(ctx, specs.trim(), 'normal', 15, 10, colW);
    ctx.fillText(specs.trim(), x0, y);
    y += 17;
  }

  if (s.imei) {
    fitFont(ctx, `IMEI ${s.imei}`, 'normal', 14, 10, colW);
    ctx.fillText(`IMEI ${s.imei}`, x0, y);
  }

  // Bottom line: MRP left, price code right (bold, large)
  const code = priceCode(s.price);
  const codeSize = 24;
  const by = usable - codeSize - 2;
  ctx.font = `bold ${codeSize}px ${FONT}`;
  const codeW = code ? ctx.measureText(code).width : 0;
  if (code) ctx.fillText(code, W - pad - codeW, by);
  const mrpVal = parseFloat(s.mrp || 0);
  if (mrpVal > 0) {
    const mrp = `MRP ₹${mrpVal.toLocaleString('en-IN')}`;
    const ms = fitFont(ctx, mrp, 'bold', 18, 10, colW - codeW - 6);
    ctx.fillText(mrp, x0, by + (codeSize - ms));
  }

  // Dashed cut line
  for (let x = 0; x < W; x += 12) ctx.fillRect(x, H - 3, 6, 2);

  return c;
}

/** ESC/POS raster bytes (GS v 0) for a list of canvases, one after another. */
export function escposForCanvases(canvases, feedLines = 1) {
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
    if (feedLines > 0) bytes.push(0x1b, 0x64, feedLines); // ESC d n — small gap between stickers
  }
  bytes.push(0x1b, 0x64, 3); // feed so the last sticker clears the tear bar
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
export function printCanvasesInBrowser(canvases, heightMm) {
  const imgs = canvases.map(c => `<div class="p"><img src="${c.toDataURL('image/png')}"></div>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Stickers</title><style>
    @page { size: ${PAPER_WIDTH_MM}mm ${heightMm}mm; margin: 0; }
    html, body { margin: 0; padding: 0; background: #fff; }
    .p { width: ${PAPER_WIDTH_MM}mm; height: ${heightMm}mm; display: flex; justify-content: center; align-items: flex-start; overflow: hidden; page-break-after: always; break-after: page; }
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
