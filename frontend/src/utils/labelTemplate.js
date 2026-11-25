// Sticker as a label-designer template file (the format saved by the T8D label printer's
// own software: page 48 × 30 mm, one "Text" item per line). Sizes in the file are in mm,
// font sizes and wrap widths in printer dots (203 dpi ≈ 8 dots per mm).
// The QR code is not included yet — its item format is unknown — so its area is left empty.
import { priceCode } from './thermalSticker';

const DOTS = 8;
const PAGE_W = 48;
const PAGE_H = 30;
const MARGIN = 1.5;
const QR_SIZE = 14; // mm, area kept free on the right for the QR
const FONT = 'Arial, Helvetica, sans-serif';

const uuid = () => `{${(crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`)}}`;
const mm = n => Number(n).toFixed(6);

let measureCtx;
function textWidthMm(text, sizeDots, bold) {
  measureCtx = measureCtx || document.createElement('canvas').getContext('2d');
  measureCtx.font = `${bold ? 'bold ' : ''}${sizeDots}px ${FONT}`;
  return measureCtx.measureText(text).width / DOTS;
}
// Largest font (≤ max) at which the text fits the width.
function fitSize(text, max, min, bold, widthMm) {
  let size = max;
  while (size > min && textWidthMm(text, size, bold) > widthMm) size -= 1;
  return size;
}

function textItem(text, { x, y, size, bold = false }) {
  const w = Math.min(PAGE_W - x, textWidthMm(text, size, bold) + 0.6);
  const h = (size * 1.25) / DOTS;
  return {
    itemType: 'Text',
    itemXMM: mm(x), itemYMM: mm(y), itemWidthMM: mm(w), itemHeightMM: mm(h),
    itemBackgroundColor: '0x00000000', itemBackgroundImage: '', itemRotation: mm(0),
    itemUUID: uuid(), itemName: '', itemInteraction: '', itemInteractionEnabledMode: '',
    itemProperties: {},
    contentAlignment: '17',
    textDrawOptions: {
      fontType: '2', fontName: '', fontSize: String(size),
      minimumWidth: '0', minimumHeight: '0',
      paddingLeft: '0', paddingTop: '0', paddingRight: '0', paddingBottom: '0',
      charSpacing: '0', lineSpacing: '0', scaleWidth: '1', scaleHeight: '1',
      textAlignment: '0', bold: bold ? '1' : '0', italic: '0', underline: '0', deleteline: '0', inverse: '0',
      horizontalMirror: '0', verticalMirror: '0', alpha: mm(0), textColor: '0xFF000000',
      lineWrapMode: '0', lineWrapWidth: String(Math.ceil(w * DOTS)),
    },
    dataFieldList: [{ dataType: '0', dataUUID: uuid(), dataName: '', dataProperties: { ConstantValue: text } }],
  };
}

/** Template JSON (as a string) for one sticker — same content as the printed sticker, minus the QR. */
export function labelTemplate(s, { shopName, date = new Date() }) {
  const items = [];
  const colL = MARGIN;
  const colR = PAGE_W - MARGIN - QR_SIZE - 1;
  const colW = colR - colL;
  // centred in [l, r]
  const centred = (text, size, bold, y, l = colL, r = colR) => {
    const fit = fitSize(text, size, Math.min(size, 8), bold, r - l);
    const x = l + Math.max(0, (r - l - textWidthMm(text, fit, bold)) / 2);
    items.push(textItem(text, { x, y, size: fit, bold }));
    return (fit * 1.25) / DOTS;
  };

  // top line: purchase-price code (left corner) + shop name
  const buy = priceCode(s.purchase_price);
  let shopL = colL;
  if (buy) {
    items.push(textItem(buy, { x: MARGIN, y: MARGIN, size: 14, bold: true }));
    shopL = MARGIN + textWidthMm(buy, 14, true) + 1;
  }
  const topH = centred(String(shopName || '').toUpperCase(), 16, true, MARGIN, shopL);

  // middle lines, spread between the top line and the bottom margin
  const d = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getFullYear()).slice(2)}`;
  const specs = ([s.ram, s.storage].filter(Boolean).join(' / ') + (s.color ? `  ${String(s.color).toUpperCase()}` : '')).trim();
  const mrp = parseFloat(s.mrp || 0);
  const lines = [
    [`${d}  ${s.condition === 'new' ? 'NEW' : 'USED'}`, 13, true],
    [String(s.name || ''), 16, true],
    specs && [specs, 14, false],
    s.imei && [`IMEI ${s.imei}`, 12, false],
    mrp > 0 && [`MRP: ₹${mrp.toLocaleString('en-IN')}`, 15, true],
  ].filter(Boolean);
  const top = MARGIN + topH + 1.5;
  const bottom = PAGE_H - MARGIN;
  const heights = lines.map(([t, size, bold]) => (fitSize(t, size, Math.min(size, 8), bold, colW) * 1.25) / DOTS);
  const gap = Math.max(0.3, (bottom - top - heights.reduce((a, b) => a + b, 0)) / Math.max(1, lines.length - 1));
  let y = top;
  lines.forEach(([t, size, bold], i) => { centred(t, size, bold, y); y += heights[i] + gap; });

  // bottom-right corner: selling-price code, under the QR area
  const sell = priceCode(s.price);
  if (sell) {
    const size = 18;
    const x = PAGE_W - MARGIN - textWidthMm(sell, size, true) - 0.6;
    items.push(textItem(sell, { x, y: PAGE_H - MARGIN - (size * 1.25) / DOTS, size, bold: true }));
  }

  const page = {
    PageItem: {
      pageWidthMM: mm(PAGE_W), pageHeightMM: mm(PAGE_H),
      pageWidthDPI: '203.200000', pageHeightDPI: '203.200000',
      pageBackgroundColor: '0xFFFFFFFF', pageBackgroundImage: '',
      pageShape: '0', pageRectCornerRadiusMM: '3.200000', pageShowShapeBorder: '0',
      pageShapeBorderLineWidthMM: '0.250000', pageShapeBorderLineColor: '0x7F000000',
      pageUUID: uuid(), pageName: '',
      pageProperties: {
        'printOptions.horizontalMirroredPrint': '0', 'printOptions.inversePrint': '0',
        'printOptions.printDensity': '-1', 'printOptions.printSpeed': '0.000000',
        'printOptions.upsideDownPrint': '0', 'printOptions.verticalMirroredPrint': '0',
        'printerProperties.dpi': '203.200000', 'printerProperties.maxPaperLength': '0.000000',
        'printerProperties.maxPaperWidth': '0.000000', 'printerProperties.maxPrintableHeight': '0',
        'printerProperties.maxPrintableWidth': '0', 'printerProperties.model': '',
        'printerProperties.name': '', 'printerProperties.port': '',
        'stock.ellipseTemplateContainsHole': '0', 'stock.ellipseTemplateHoleDiameter': '0.000000',
        'stock.itemColumns': '1', 'stock.itemPrintPrimaryDirection': '0', 'stock.itemPrintStartingCorner': '0',
        'stock.itemRows': '1', 'stock.itemShape': '0',
        'stock.pageBottomMargin': '0.000000', 'stock.pageHeight': mm(PAGE_H), 'stock.pageLeftMargin': '0.000000',
        'stock.pageOrientation': '1', 'stock.pageRightMargin': '0.000000', 'stock.pageTopMargin': '0.000000',
        'stock.pageWidth': mm(PAGE_W), 'stock.rectangleTemplateCornerRadius': '3.200000',
        'stock.stockCategory': '', 'stock.stockName': '',
        'stock.templateBorderLineColor': '0x7F000000', 'stock.templateBorderLineWidth': '0.250000',
        'stock.templateGapManually': '0', 'stock.templateHeight': mm(PAGE_H),
        'stock.templateHorizontalGap': '0.000000', 'stock.templatePrintBorders': '0',
        'stock.templateSizeManually': '0', 'stock.templateVerticalGap': '0.000000',
        'stock.templateWidth': mm(PAGE_W),
      },
      childItems: items,
    },
  };
  return JSON.stringify(page, null, '\t');
}

/** Download one template file per sticker (spaced out so the browser allows several downloads). */
export function downloadLabelTemplates(stickers, opts) {
  stickers.forEach((s, i) => {
    setTimeout(() => {
      const blob = new Blob([labelTemplate(s, opts)], { type: 'text/plain' });
      const a = document.createElement('a');
      const name = `${String(s.name || 'Sticker').replace(/[^\w-]+/g, '_')}${s.imei ? `_${String(s.imei).slice(-4)}` : ''}`;
      a.href = URL.createObjectURL(blob);
      a.download = `${name}.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }, i * 400);
  });
}
