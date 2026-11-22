import JsBarcode from 'jsbarcode';

// 58 mm thermal printers (e.g. Posiflow 58D) print 48 mm wide at 203 dpi = 384 dots (8 dots per mm).
export const DOTS_PER_MM = 8;
export const PRINT_WIDTH_MM = 48;
export const PAPER_WIDTH_MM = 58;
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

// Barcode with whole-dot bar widths (sharp on thermal), widest that fits.
function drawBarcode(value, maxWidth, height) {
  const probe = document.createElement('canvas');
  JsBarcode(probe, value, { format: 'CODE128', width: 1, height: 10, margin: 0, displayValue: false });
  const modules = probe.width;
  const barW = Math.max(1, Math.floor(maxWidth / modules));
  const c = document.createElement('canvas');
  JsBarcode(c, value, { format: 'CODE128', width: barW, height, margin: 0, displayValue: false, background: '#ffffff', lineColor: '#000000' });
  return c;
}

/**
 * Draw one sticker as a black/white canvas, 384 dots wide.
 * heightMm = sticker length on the roll; a dashed cut line is drawn at the bottom.
 */
export function renderSticker(s, { shopName, heightMm = 40 }) {
  const H = Math.round(heightMm * DOTS_PER_MM);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const pad = 8;
  const inner = W - pad * 2;
  const cutZone = 10; // space reserved for the dashed cut line
  const scale = Math.min(1.25, Math.max(0.75, heightMm / 40));
  let y = 4;

  // Shop name + NEW/USED box on one line
  const cond = s.condition === 'new' ? 'NEW' : 'USED';
  ctx.font = `bold ${Math.round(18 * scale)}px ${FONT}`;
  const condW = ctx.measureText(cond).width + 14;
  const nameSize = fitFont(ctx, String(shopName).toUpperCase(), 'bold', Math.round(22 * scale), 12, inner - condW - 8);
  const rowH = Math.round(Math.max(nameSize, 18 * scale) + 6);
  ctx.textAlign = 'left';
  ctx.font = `bold ${nameSize}px ${FONT}`;
  ctx.fillText(String(shopName).toUpperCase(), pad, y + (rowH - nameSize) / 2);
  ctx.fillRect(W - pad - condW, y, condW, rowH);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.font = `bold ${Math.round(18 * scale)}px ${FONT}`;
  ctx.fillText(cond, W - pad - condW / 2, y + (rowH - 18 * scale) / 2);
  ctx.fillStyle = '#000';
  y += rowH + 4;

  // Model (up to 2 lines)
  const modelSize = Math.round(22 * scale);
  ctx.font = `bold ${modelSize}px ${FONT}`;
  for (const line of wrapLines(ctx, s.name, inner, 2)) {
    ctx.fillText(line, W / 2, y);
    y += modelSize + 2;
  }

  // Specs
  const specs = [s.ram, s.storage, s.color].filter(Boolean).join(' / ');
  if (specs) {
    const sz = fitFont(ctx, specs, 'normal', Math.round(18 * scale), 12, inner);
    ctx.fillText(specs, W / 2, y);
    y += sz + 4;
  }

  // Bottom block (drawn upward from the cut line): prices, IMEI, barcode
  const priceSize = Math.round(20 * scale);
  const imeiSize = Math.round(16 * scale);
  const mrp = `MRP ₹${parseFloat(s.mrp || 0).toLocaleString('en-IN')}`;
  const price = `PRICE ₹${parseFloat(s.price || 0).toLocaleString('en-IN')}`;
  let bottom = H - cutZone - 2;

  const priceY = bottom - priceSize;
  ctx.font = `bold ${priceSize}px ${FONT}`;
  const both = `${mrp}   ${price}`;
  const ps = fitFont(ctx, both, 'bold', priceSize, 12, inner);
  ctx.fillText(both, W / 2, priceY + (priceSize - ps));
  bottom = priceY - 4;

  if (s.imei) {
    const iy = bottom - imeiSize;
    ctx.font = `normal ${imeiSize}px ${FONT}`;
    ctx.fillText(`IMEI ${s.imei}`, W / 2, iy);
    bottom = iy - 3;
  }

  // IMEI alone (all digits) packs tightly in CODE128, so bars can be 2 dots wide —
  // much easier to scan from thermal paper. The sale screen looks items up by IMEI.
  const barcodeValue = s.imei || s.sku || '';
  const barH = Math.floor(bottom - y - 2);
  if (barcodeValue && barH >= 24) {
    try {
      const bc = drawBarcode(barcodeValue, inner, Math.min(barH, Math.round(70 * scale)));
      ctx.drawImage(bc, Math.round((W - bc.width) / 2), Math.round(y + (barH - bc.height) / 2));
    } catch {
      // Characters not valid for CODE128 — skip the barcode.
    }
  }

  // Dashed cut line
  ctx.fillStyle = '#000';
  for (let x = 0; x < W; x += 12) ctx.fillRect(x, H - 4, 6, 2);

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
