// Hoá đơn điện tử dạng PDF cho đơn hàng Luméa (pdfkit + font Roboto để hiển thị đủ tiếng Việt).
// Bố cục theo mẫu hoá đơn giá trị gia tăng (VAT invoice): khung viền, nhãn song ngữ Việt/Anh, bảng hàng hoá
// có dòng đánh số cột, thuế GTGT, số tiền bằng chữ và ô chữ ký điện tử của người bán.
// Thông tin người mua lấy đúng như khách nhập lúc đặt hàng (cá nhân: người nhận; công ty: tên/MST/địa chỉ công ty).
const PDFDocument = require('pdfkit');
const path = require('path');
const crypto = require('crypto');

const FONT_DIR = path.join(__dirname, '..', 'fonts');

const COLOR_FRAME = '#1f3b8f';
const COLOR_TITLE = '#1a2f80';
const COLOR_VALUE = '#13277a';
const COLOR_TEXT = '#1f1f1f';
const COLOR_MUTED = '#555555';
const COLOR_SIGN = '#b3261e';

// Đơn vị bán in trên hoá đơn — dữ liệu demo của đồ án, thay bằng thông tin pháp nhân thật trước khi dùng.
const SELLER = {
  name: 'CÔNG TY TNHH LUMÉA INTERIOR & 3D',
  taxCode: '0109123456',
  address: 'Số 669 Đỗ Mười, Khu phố 13, Phường Linh Xuân, Thành phố Hồ Chí Minh, Việt Nam',
  phone: '1800 6928',
  account: '0988123456 tại Ngân hàng MB Bank (Quân Đội)',
};

// Giá bán trên web đã gồm thuế GTGT; hoá đơn tách ngược ra tiền hàng chưa thuế + tiền thuế.
const VAT_RATE = 0.08;
const ITEM_UNIT = 'Cái';
const MIN_TABLE_ROWS = 5;

const PAYMENT_LABELS = {
  COD: 'Tiền mặt (COD)',
  BANK_TRANSFER: 'Chuyển khoản',
  MOMO: 'Ví điện tử MoMo',
  ZALOPAY: 'Ví điện tử ZaloPay',
  ATM: 'Thẻ ATM nội địa',
};

const MARGIN = 28;
const PAD = 10;

// Cột bảng hàng hoá — tổng độ rộng bằng bề ngang khung (A4 trừ lề).
const COLS = [
  { vi: 'STT', en: 'No.', w: 34, align: 'center' },
  { vi: 'Tên hàng hóa, dịch vụ', en: 'Description', w: 205, align: 'left' },
  { vi: 'Đơn vị tính', en: 'Unit', w: 50, align: 'center' },
  { vi: 'Số lượng', en: 'Quantity', w: 55, align: 'center' },
  { vi: 'Đơn giá', en: 'Unit Price', w: 90, align: 'right' },
  { vi: 'Thành tiền', en: 'Amount', w: 105, align: 'right' },
];

function formatMoney(value) {
  return Math.round(Number(value) || 0).toLocaleString('vi-VN');
}

// ===== Số tiền bằng chữ =====
const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

/** Đọc 1 nhóm 3 chữ số; full = đọc đủ "không trăm/linh" khi đứng sau nhóm lớn hơn. */
function readTriple(n, full) {
  const h = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const u = n % 10;
  const words = [];
  if (full || h > 0) words.push(DIGITS[h], 'trăm');
  if (t === 0) {
    if (u > 0 && (full || h > 0)) words.push('linh');
  } else if (t === 1) {
    words.push('mười');
  } else {
    words.push(DIGITS[t], 'mươi');
  }
  if (u === 1 && t > 1) words.push('mốt');
  else if (u === 5 && t > 0) words.push('lăm');
  else if (u > 0) words.push(DIGITS[u]);
  return words.join(' ');
}

function readBelowBillion(n, leading) {
  const groups = [Math.floor(n / 1e6), Math.floor(n / 1e3) % 1000, n % 1000];
  const names = ['triệu', 'nghìn', ''];
  const words = [];
  let started = !leading;
  groups.forEach((g, i) => {
    if (g === 0) return;
    words.push(readTriple(g, started));
    if (names[i]) words.push(names[i]);
    started = true;
  });
  return words.join(' ');
}

function readNumber(n, leading = true) {
  if (n >= 1e9) {
    const rest = n % 1e9;
    return `${readNumber(Math.floor(n / 1e9), leading)} tỷ${rest ? ` ${readBelowBillion(rest, false)}` : ''}`;
  }
  return readBelowBillion(n, leading);
}

function amountInWords(amount) {
  const n = Math.round(Math.abs(Number(amount) || 0));
  const words = n === 0 ? 'không' : readNumber(n);
  return `${words.charAt(0).toUpperCase()}${words.slice(1)} đồng chẵn.`;
}

// ===== Vẽ chữ =====
function setFont(doc, seg) {
  return doc.font(seg.font || 'Regular').fontSize(seg.size || 9);
}

function segmentsWidth(doc, segments) {
  return segments.reduce((sum, seg) => sum + setFont(doc, seg).widthOfString(seg.text), 0);
}

/** Vẽ nhiều đoạn chữ khác font trên cùng 1 dòng (không xuống dòng); trả về x kết thúc. */
function drawSegments(doc, segments, x, y) {
  let cx = x;
  segments.forEach(seg => {
    setFont(doc, seg).fillColor(seg.color || COLOR_TEXT).text(seg.text, cx, y, { lineBreak: false });
    cx += setFont(doc, seg).widthOfString(seg.text);
  });
  return cx;
}

function drawSegmentsAligned(doc, segments, x, width, y, align) {
  const total = segmentsWidth(doc, segments);
  const startX = align === 'center' ? x + (width - total) / 2 : x + width - total;
  return drawSegments(doc, segments, startX, y);
}

/** Dòng "Nhãn (English): giá trị"; giá trị dài tự xuống dòng thẳng cột giá trị. Trả về y kế tiếp. */
function field(doc, vi, en, value, x, y, width, valueStyle = {}) {
  const vx = drawSegments(doc, [{ text: `${vi} ` }, { text: `(${en})`, font: 'Italic' }, { text: ': ' }], x, y);
  const style = { font: valueStyle.font || 'Regular', size: valueStyle.size || 9 };
  const vw = x + width - vx;
  let h = 0;
  if (value) {
    setFont(doc, style).fillColor(valueStyle.color || COLOR_TEXT);
    h = doc.heightOfString(value, { width: vw });
    doc.text(value, vx, y - (style.size - 9) / 2, { width: vw });
  }
  return y + Math.max(h, 11) + 4;
}

function hLine(doc, y, x1, x2) {
  doc.strokeColor(COLOR_FRAME).lineWidth(0.6).moveTo(x1, y).lineTo(x2, y).stroke();
}

function cell(doc, x, y, w, h) {
  doc.strokeColor(COLOR_FRAME).lineWidth(0.6).rect(x, y, w, h).stroke();
}

function itemName(item) {
  const name = item.product?.name || 'Sản phẩm';
  const c = item.selectedCustomization;
  if (!c) return name;
  const parts = [c.color?.name, c.material?.name, c.size?.label, c.customText ? `Khắc: "${c.customText}"` : ''].filter(Boolean);
  return parts.length ? `${name}\n(${parts.join(' · ')})` : name;
}

/** Ký hiệu, số hoá đơn và mã CQT (demo) suy ra từ mã đơn để cùng 1 đơn luôn ra cùng 1 hoá đơn. */
function invoiceIdentity(order, year) {
  // Mã đơn gồm cả chữ lẫn số (vd ORD-25RRFZ62) — đọc như số hệ 36 rồi lấy 8 chữ số cuối.
  const code = String(order.orderNumber || '').replace(/^ORD-/i, '').replace(/[^0-9a-z]/gi, '');
  const hash = crypto.createHash('md5').update(String(order.orderNumber || '')).digest('hex').toUpperCase();
  return {
    serial: `1C${String(year).slice(-2)}TLM`,
    number: String(parseInt(code || '0', 36) % 1e8).padStart(8, '0'),
    authorityCode: `00${hash}`,
  };
}

/** Dòng bảng: dòng hàng hoá, phí vận chuyển, chiết khấu — tiền đã tách thuế GTGT. */
function tableRows(order) {
  const exVat = value => Math.round((Number(value) || 0) / (1 + VAT_RATE));
  const rows = (order.items || []).map(item => {
    const qty = Number(item.quantity) || 1;
    const price = exVat(item.unitPrice);
    return { name: itemName(item), unit: ITEM_UNIT, qty: String(qty), price: formatMoney(price), amount: price * qty };
  });
  if (Number(order.shippingFee) > 0) {
    const fee = exVat(order.shippingFee);
    rows.push({ name: 'Phí vận chuyển', unit: 'Lần', qty: '1', price: formatMoney(fee), amount: fee });
  }
  if (Number(order.discount) > 0) {
    rows.push({ name: 'Chiết khấu thương mại (mã giảm giá)', unit: '', qty: '', price: '', amount: -exVat(order.discount) });
  }
  return rows;
}

/**
 * @param {object} order  đơn hàng (plain object)
 * @returns {Promise<Buffer>}
 */
function buildInvoicePdf(order) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: MARGIN, bottom: 10, left: MARGIN, right: MARGIN },
      bufferPages: true,
      info: { Title: `Hoa don ${order.orderNumber}`, Author: 'Luméa' },
    });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.registerFont('Regular', path.join(FONT_DIR, 'Roboto-Regular.ttf'));
    doc.registerFont('Bold', path.join(FONT_DIR, 'Roboto-Bold.ttf'));
    doc.registerFont('Italic', path.join(FONT_DIR, 'Roboto-Italic.ttf'));

    const pageH = doc.page.height;
    const X0 = MARGIN;
    const X1 = doc.page.width - MARGIN;
    const W = X1 - X0;
    const contentBottom = pageH - 66;
    const innerX = X0 + PAD;
    const innerW = W - PAD * 2;

    const addr = order.shippingAddress || {};
    const invoice = order.invoice || {};
    const isCompany = invoice.type === 'company';
    const created = order.createdAt ? new Date(order.createdAt) : new Date();
    const date = Object.fromEntries(
      new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' })
        .formatToParts(created)
        .map(p => [p.type, p.value])
    );
    const id = invoiceIdentity(order, date.year);

    // ===== Tiêu đề =====
    const titleW = 345;
    let y = MARGIN + 12;
    doc.font('Bold').fontSize(16).fillColor(COLOR_TITLE).text('HÓA ĐƠN GIÁ TRỊ GIA TĂNG', X0, y, { width: titleW, align: 'center' });
    doc.font('Italic').fontSize(11).fillColor(COLOR_TITLE).text('(VAT INVOICE)', X0, y + 21, { width: titleW, align: 'center' });
    drawSegmentsAligned(doc, [
      { text: 'Ngày ' }, { text: '(day) ', font: 'Italic' }, { text: date.day, font: 'Bold' },
      { text: '  tháng ' }, { text: '(month) ', font: 'Italic' }, { text: date.month, font: 'Bold' },
      { text: '  năm ' }, { text: '(year) ', font: 'Italic' }, { text: date.year, font: 'Bold' },
    ], X0, titleW, y + 40, 'center');

    const rx = X0 + titleW + 6;
    drawSegments(doc, [
      { text: 'Mẫu số - Ký hiệu ', size: 8.5 }, { text: '(Serial No.)', font: 'Italic', size: 8.5 },
      { text: ': ', size: 8.5 }, { text: id.serial, font: 'Bold', size: 8.5, color: COLOR_VALUE },
    ], rx, y + 2);
    drawSegments(doc, [
      { text: 'Số ', size: 8.5 }, { text: '(Invoice No.)', font: 'Italic', size: 8.5 },
      { text: ': ', size: 8.5 }, { text: id.number, font: 'Bold', size: 10, color: COLOR_SIGN },
    ], rx, y + 17);

    y = MARGIN + 72;
    hLine(doc, y, X0, X1);
    y += 6;
    drawSegments(doc, [{ text: 'Mã của Cơ quan thuế: ' }, { text: id.authorityCode, font: 'Bold', color: COLOR_VALUE }], innerX, y);
    y += 17;
    hLine(doc, y, X0, X1);

    // ===== Người bán =====
    y += 7;
    const strong = { font: 'Bold', size: 11, color: COLOR_VALUE };
    y = field(doc, 'Đơn vị bán', 'Seller', SELLER.name, innerX, y, innerW, strong);
    y = field(doc, 'Mã số thuế', 'Tax code', SELLER.taxCode.split('').join(' '), innerX, y, innerW, strong);
    y = field(doc, 'Địa chỉ', 'Address', SELLER.address, innerX, y, innerW);
    y = field(doc, 'Điện thoại', 'Tel', SELLER.phone, innerX, y, innerW);
    y = field(doc, 'Số tài khoản', 'Account No.', SELLER.account, innerX, y, innerW);
    y += 2;
    hLine(doc, y, X0, X1);

    // ===== Người mua =====
    y += 7;
    const buyerValue = { font: 'Bold', color: COLOR_VALUE };
    const buyerAddress = isCompany
      ? invoice.companyAddress
      : [addr.street, addr.district, addr.city].filter(Boolean).join(', ');
    y = field(doc, 'Người mua', 'Buyer', addr.fullName, innerX, y, innerW);
    y = field(doc, 'Đơn vị', 'Company name', isCompany ? invoice.companyName : '', innerX, y, innerW, buyerValue);
    y = field(doc, 'Mã số thuế', 'Tax code', isCompany ? invoice.taxCode : '', innerX, y, innerW, buyerValue);
    y = field(doc, 'Địa chỉ', 'Address', buyerAddress, innerX, y, innerW);
    y = field(doc, 'Hình thức thanh toán', 'Payment method', PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod, innerX, y, innerW);
    y = field(doc, 'Số tài khoản', 'Account No.', '', innerX, y, innerW);
    y += 4;

    // ===== Bảng hàng hoá =====
    const tableHead = (yy) => {
      const h = Math.max(...COLS.map(c =>
        doc.font('Bold').fontSize(9).heightOfString(c.vi, { width: c.w - 6 })
        + doc.font('Italic').fontSize(8.5).heightOfString(`(${c.en})`, { width: c.w - 6 })
      )) + 12;
      let cx = X0;
      COLS.forEach(c => {
        cell(doc, cx, yy, c.w, h);
        doc.font('Bold').fontSize(9).fillColor(COLOR_TEXT).text(c.vi, cx + 3, yy + 6, { width: c.w - 6, align: 'center' });
        doc.font('Italic').fontSize(8.5).text(`(${c.en})`, cx + 3, doc.y, { width: c.w - 6, align: 'center' });
        cx += c.w;
      });
      yy += h;
      cx = X0;
      ['1', '2', '3', '4', '5', '6 = 4 x 5'].forEach((label, i) => {
        cell(doc, cx, yy, COLS[i].w, 15);
        doc.font('Regular').fontSize(8).fillColor(COLOR_MUTED).text(label, cx, yy + 4, { width: COLS[i].w, align: 'center' });
        cx += COLS[i].w;
      });
      return yy + 15;
    };
    const drawRow = (yy, values) => {
      doc.font('Regular').fontSize(9);
      const h = Math.max(19, doc.heightOfString(values[1] || ' ', { width: COLS[1].w - 12 }) + 9);
      if (yy + h > contentBottom) {
        doc.addPage();
        yy = tableHead(MARGIN + 8);
      }
      let cx = X0;
      COLS.forEach((c, i) => {
        cell(doc, cx, yy, c.w, h);
        doc.font('Regular').fontSize(9).fillColor(COLOR_TEXT)
          .text(values[i] || '', cx + 6, yy + 5, { width: c.w - 12, align: c.align });
        cx += c.w;
      });
      return yy + h;
    };

    y = tableHead(y);
    const rows = tableRows(order);
    rows.forEach((r, idx) => {
      y = drawRow(y, [String(idx + 1), r.name, r.unit, r.qty, r.price, formatMoney(r.amount)]);
    });
    for (let i = rows.length; i < MIN_TABLE_ROWS; i++) y = drawRow(y, []);

    // ===== Cộng tiền, thuế, tổng thanh toán =====
    const subtotal = rows.reduce((sum, r) => sum + r.amount, 0);
    const total = Math.round(Number(order.total) || 0);
    const vat = total - subtotal;
    const amountW = COLS[5].w;
    const labelW = W - amountW;
    const ensureSpace = (h) => {
      if (y + h <= contentBottom) return;
      doc.addPage();
      y = MARGIN + 8;
    };
    const totalRow = (segments, value, leftSegments) => {
      ensureSpace(20);
      if (leftSegments) {
        const leftW = COLS[0].w + COLS[1].w;
        cell(doc, X0, y, leftW, 20);
        drawSegments(doc, leftSegments, X0 + 6, y + 5);
        cell(doc, X0 + leftW, y, labelW - leftW, 20);
        drawSegmentsAligned(doc, segments, X0 + leftW, labelW - leftW - 8, y + 5, 'right');
      } else {
        cell(doc, X0, y, labelW, 20);
        drawSegmentsAligned(doc, segments, X0, labelW - 8, y + 5, 'right');
      }
      cell(doc, X0 + labelW, y, amountW, 20);
      doc.font('Bold').fontSize(9.5).fillColor(COLOR_TEXT).text(value, X0 + labelW + 6, y + 5, { width: amountW - 12, align: 'right' });
      y += 20;
    };
    totalRow([{ text: 'Cộng tiền hàng ' }, { text: '(Sub total)', font: 'Italic' }, { text: ':' }], formatMoney(subtotal));
    totalRow(
      [{ text: 'Tiền thuế GTGT ' }, { text: '(VAT amount)', font: 'Italic' }, { text: ':' }],
      formatMoney(vat),
      [{ text: 'Thuế suất GTGT ' }, { text: '(Tax rate)', font: 'Italic' }, { text: ': ' }, { text: `${Math.round(VAT_RATE * 100)}%`, font: 'Bold' }]
    );
    totalRow([{ text: 'Tổng cộng tiền thanh toán ' }, { text: '(Total payment)', font: 'Italic' }, { text: ':' }], formatMoney(total));

    ensureSpace(30);
    y += 6;
    y = field(doc, 'Số tiền viết bằng chữ', 'Amount in words', amountInWords(total), X0 + 6, y, W - 12, { font: 'Bold', color: COLOR_VALUE });
    y += 2;
    hLine(doc, y, X0, X1);

    // ===== Chữ ký =====
    ensureSpace(140);
    y += 12;
    const halfW = W / 2;
    drawSegmentsAligned(doc, [{ text: 'Người mua hàng ', font: 'Bold', size: 10 }, { text: '(Buyer)', font: 'Italic', size: 10 }], X0, halfW, y, 'center');
    drawSegmentsAligned(doc, [{ text: 'Người bán hàng ', font: 'Bold', size: 10 }, { text: '(Seller)', font: 'Italic', size: 10 }], X0 + halfW, halfW, y, 'center');
    y += 20;

    const bw = 210;
    const bx = X0 + halfW + (halfW - bw) / 2;
    const nameH = doc.font('Bold').fontSize(9).heightOfString(SELLER.name, { width: bw - 16 });
    const bh = 52 + nameH;
    doc.rect(bx, y, bw, bh).fillAndStroke('#e8f5ea', '#7cc48b');
    doc.save();
    doc.opacity(0.35).lineWidth(12).strokeColor('#3fa34d').lineJoin('round').lineCap('round')
      .moveTo(bx + bw / 2 - 34, y + bh / 2).lineTo(bx + bw / 2 - 8, y + bh - 12).lineTo(bx + bw / 2 + 40, y + 10).stroke();
    doc.restore();
    doc.font('Bold').fontSize(8.5).fillColor(COLOR_SIGN).text('Đã được ký điện tử bởi', bx, y + 7, { width: bw, align: 'center' });
    doc.font('Italic').fontSize(8).text('(Signed digitally by)', bx, doc.y, { width: bw, align: 'center' });
    doc.font('Bold').fontSize(9).text(SELLER.name, bx + 8, doc.y + 3, { width: bw - 16, align: 'center' });
    doc.font('Regular').fontSize(8.5).text(`Ngày: ${date.day}/${date.month}/${date.year}`, bx, doc.y + 3, { width: bw, align: 'center' });
    y += bh + 14;

    doc.font('Italic').fontSize(8).fillColor(COLOR_MUTED)
      .text('(Cần kiểm tra, đối chiếu khi lập, giao, nhận hóa đơn)', X0, y, { width: W, align: 'center', lineBreak: false });
    const lastBottom = y + 16;

    // ===== Khung viền + chân trang mỗi trang =====
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const isLast = i === range.start + range.count - 1;
      const frameBottom = isLast ? lastBottom : contentBottom + 6;
      doc.strokeColor(COLOR_FRAME).lineWidth(1).rect(X0, MARGIN, W, frameBottom - MARGIN).stroke();
      doc.font('Bold').fontSize(7.5).fillColor(COLOR_TEXT)
        .text('Hóa đơn điện tử được lập tự động bởi hệ thống Luméa — Interior & 3D · Hotline 1800 6928 · lumea.vn',
          X0, frameBottom + 6, { width: W, align: 'center', lineBreak: false });
      if (range.count > 1) {
        doc.font('Regular').fontSize(7.5).fillColor(COLOR_MUTED)
          .text(`Trang ${i - range.start + 1}/${range.count}`, X0, frameBottom + 17, { width: W, align: 'center', lineBreak: false });
      }
    }

    doc.end();
  });
}

module.exports = { buildInvoicePdf, amountInWords };
