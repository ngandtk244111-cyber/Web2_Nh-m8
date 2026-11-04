// Hoá đơn điện tử dạng PDF cho đơn hàng Luméa (pdfkit + font Roboto để hiển thị đủ tiếng Việt).
// Bố cục tham khảo hoá đơn của AuraPC, đổi sang nhận diện Luméa (đỏ rượu).
// Thông tin người mua lấy đúng như khách nhập lúc đặt hàng (cá nhân: người nhận; công ty: tên/MST/địa chỉ công ty).
const PDFDocument = require('pdfkit');
const path = require('path');

const FONT_DIR = path.join(__dirname, '..', 'fonts');

const COLOR_PRIMARY = '#8E1530';
const COLOR_DARK = '#3a2326';
const COLOR_TEXT = '#1f1a1b';
const COLOR_MUTED = '#7a6266';
const COLOR_BORDER = '#eadde0';
const COLOR_ROW = '#fbf3f4';

const PAYMENT_LABELS = {
  COD: 'Thanh toán khi nhận hàng (COD)',
  BANK_TRANSFER: 'Chuyển khoản ngân hàng',
  MOMO: 'Ví MoMo',
  ZALOPAY: 'ZaloPay',
  ATM: 'Thẻ ATM nội địa',
};

function formatPrice(price) {
  return `${Number(price || 0).toLocaleString('vi-VN')}đ`;
}

function drawLine(doc, x1, y, x2, color = COLOR_BORDER, width = 0.6) {
  doc.strokeColor(color).lineWidth(width).moveTo(x1, y).lineTo(x2, y).stroke();
}

/** Dòng "Nhãn: giá trị" (giá trị in đậm), tự xuống dòng trong cột; trả về y kế tiếp. */
function labelValue(doc, label, value, x, y, width) {
  doc.font('Regular').fontSize(9).fillColor(COLOR_MUTED).text(`${label}: `, x, y, { width, continued: true });
  doc.font('Bold').fillColor(COLOR_TEXT).text(value || '—');
  return doc.y + 4;
}

function itemName(item) {
  const name = item.product?.name || 'Sản phẩm';
  const c = item.selectedCustomization;
  if (!c) return name;
  const parts = [c.color?.name, c.material?.name, c.size?.label, c.customText ? `Khắc: "${c.customText}"` : ''].filter(Boolean);
  return parts.length ? `${name}\n(${parts.join(' · ')})` : name;
}

/**
 * @param {object} order  đơn hàng (plain object)
 * @returns {Promise<Buffer>}
 */
function buildInvoicePdf(order) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4', info: { Title: `Hoa don ${order.orderNumber}`, Author: 'Luméa' } });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.registerFont('Regular', path.join(FONT_DIR, 'Roboto-Regular.ttf'));
    doc.registerFont('Bold', path.join(FONT_DIR, 'Roboto-Bold.ttf'));
    doc.registerFont('Italic', path.join(FONT_DIR, 'Roboto-Italic.ttf'));

    const pageW = doc.page.width;
    const margin = 50;
    const contentW = pageW - margin * 2;
    const addr = order.shippingAddress || {};
    const invoice = order.invoice || {};
    const isCompany = invoice.type === 'company';
    const created = order.createdAt ? new Date(order.createdAt) : new Date();
    const tz = { timeZone: 'Asia/Ho_Chi_Minh' };
    const orderDate = `${created.toLocaleDateString('vi-VN', { ...tz, day: '2-digit', month: '2-digit', year: 'numeric' })} `
      + created.toLocaleTimeString('vi-VN', { ...tz, hour: '2-digit', minute: '2-digit' });

    // ===== Thanh tiêu đề =====
    doc.rect(0, 0, pageW, 84).fill(COLOR_PRIMARY);
    doc.font('Bold').fontSize(24).fillColor('#ffffff').text('LUMÉA', margin, 20, { width: contentW });
    doc.font('Regular').fontSize(9).fillColor('#f5cdd4').text('Interior & 3D — Nội thất, decor & sản phẩm in 3D', margin, 50, { width: contentW });
    doc.font('Bold').fontSize(15).fillColor('#ffffff').text('HÓA ĐƠN ĐIỆN TỬ', margin, 22, { width: contentW, align: 'right' });
    doc.font('Regular').fontSize(9).fillColor('#f5cdd4').text(`Số: ${order.orderNumber}`, margin, 44, { width: contentW, align: 'right' });
    doc.text(`Ngày lập: ${orderDate}`, margin, 57, { width: contentW, align: 'right' });

    // ===== Người bán / Người mua =====
    const top = 106;
    const colW = contentW / 2 - 12;
    const colL = margin;
    const colR = margin + contentW / 2 + 12;

    doc.font('Bold').fontSize(10).fillColor(COLOR_PRIMARY).text('ĐƠN VỊ BÁN HÀNG', colL, top);
    let yL = top + 18;
    yL = labelValue(doc, 'Tên đơn vị', 'Luméa Interior & 3D', colL, yL, colW);
    yL = labelValue(doc, 'Hotline', '1800 6928', colL, yL, colW);
    yL = labelValue(doc, 'Website', 'lumea.vn', colL, yL, colW);
    yL = labelValue(doc, 'Thanh toán', PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod, colL, yL, colW);
    yL = labelValue(doc, 'Trạng thái', order.paymentStatus === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán', colL, yL, colW);

    doc.font('Bold').fontSize(10).fillColor(COLOR_PRIMARY).text(isCompany ? 'ĐƠN VỊ MUA HÀNG' : 'THÔNG TIN NGƯỜI MUA', colR, top);
    let yR = top + 18;
    if (isCompany) {
      yR = labelValue(doc, 'Tên công ty', invoice.companyName, colR, yR, colW);
      yR = labelValue(doc, 'Mã số thuế', invoice.taxCode, colR, yR, colW);
      yR = labelValue(doc, 'Địa chỉ', invoice.companyAddress, colR, yR, colW);
      yR = labelValue(doc, 'Người nhận hàng', `${addr.fullName || '—'} · ${addr.phone || ''}`, colR, yR, colW);
    } else {
      yR = labelValue(doc, 'Họ tên', addr.fullName, colR, yR, colW);
      yR = labelValue(doc, 'Điện thoại', addr.phone, colR, yR, colW);
      const fullAddress = [addr.street, addr.district, addr.city].filter(Boolean).join(', ');
      yR = labelValue(doc, 'Địa chỉ', fullAddress, colR, yR, colW);
    }
    yR = labelValue(doc, 'Email nhận hóa đơn', invoice.email || addr.email, colR, yR, colW);

    let y = Math.max(yL, yR) + 16;

    // ===== Bảng sản phẩm =====
    doc.font('Bold').fontSize(10).fillColor(COLOR_PRIMARY).text('CHI TIẾT SẢN PHẨM', margin, y);
    y += 18;
    const cols = { stt: 30, name: 235, price: 85, qty: 40, total: contentW - 30 - 235 - 85 - 40 };
    const head = (yy) => {
      doc.rect(margin, yy, contentW, 22).fill(COLOR_DARK);
      doc.font('Bold').fontSize(8.5).fillColor('#ffffff');
      let cx = margin + 8;
      doc.text('STT', cx, yy + 7, { width: cols.stt }); cx += cols.stt;
      doc.text('Tên sản phẩm', cx, yy + 7, { width: cols.name }); cx += cols.name;
      doc.text('Đơn giá', cx, yy + 7, { width: cols.price, align: 'right' }); cx += cols.price;
      doc.text('SL', cx, yy + 7, { width: cols.qty, align: 'center' }); cx += cols.qty;
      doc.text('Thành tiền', cx, yy + 7, { width: cols.total - 16, align: 'right' });
      return yy + 22;
    };
    y = head(y);

    (order.items || []).forEach((item, idx) => {
      const name = itemName(item);
      doc.font('Regular').fontSize(8.5);
      const rowH = Math.max(22, doc.heightOfString(name, { width: cols.name - 6 }) + 12);
      if (y + rowH > doc.page.height - 160) {
        doc.addPage();
        y = head(50);
      }
      if (idx % 2 === 0) doc.rect(margin, y, contentW, rowH).fill(COLOR_ROW);
      let cx = margin + 8;
      doc.font('Regular').fontSize(8.5).fillColor(COLOR_TEXT);
      doc.text(String(idx + 1), cx, y + 6, { width: cols.stt }); cx += cols.stt;
      doc.text(name, cx, y + 6, { width: cols.name - 6 }); cx += cols.name;
      doc.text(formatPrice(item.unitPrice), cx, y + 6, { width: cols.price, align: 'right' }); cx += cols.price;
      doc.text(String(item.quantity || 1), cx, y + 6, { width: cols.qty, align: 'center' }); cx += cols.qty;
      doc.font('Bold').text(formatPrice(item.totalPrice), cx, y + 6, { width: cols.total - 16, align: 'right' });
      y += rowH;
    });
    drawLine(doc, margin, y, margin + contentW, COLOR_DARK, 1);

    // ===== Tổng tiền =====
    y += 12;
    const tx = margin + contentW - 240;
    const lw = 140;
    const vw = 100;
    const row = (label, value, color = COLOR_TEXT) => {
      doc.font('Regular').fontSize(9.5).fillColor(COLOR_MUTED).text(label, tx, y, { width: lw, align: 'right' });
      doc.fillColor(color).text(value, tx + lw, y, { width: vw, align: 'right' });
      y += 18;
    };
    row('Tạm tính:', formatPrice(order.subtotal));
    if (Number(order.discount) > 0) row('Giảm giá voucher:', `-${formatPrice(order.discount)}`, '#15803d');
    row('Phí vận chuyển:', Number(order.shippingFee) > 0 ? formatPrice(order.shippingFee) : 'Miễn phí');
    drawLine(doc, tx, y, tx + lw + vw, COLOR_PRIMARY, 1);
    y += 8;
    doc.font('Bold').fontSize(13).fillColor(COLOR_DARK).text('TỔNG CỘNG:', tx, y, { width: lw, align: 'right' });
    doc.fillColor(COLOR_PRIMARY).text(formatPrice(order.total), tx + lw, y, { width: vw, align: 'right' });
    y += 24;
    if (order.notes) {
      doc.font('Italic').fontSize(8.5).fillColor(COLOR_MUTED).text(`Ghi chú đơn hàng: ${order.notes}`, margin, y, { width: contentW });
      y = doc.y + 6;
    }

    // ===== Chân trang =====
    y += 24;
    if (y > doc.page.height - 90) {
      doc.addPage();
      y = 50;
    }
    drawLine(doc, margin, y, margin + contentW);
    y += 12;
    doc.font('Italic').fontSize(8).fillColor(COLOR_MUTED).text(
      'Hóa đơn điện tử được lập tự động bởi hệ thống Luméa dựa trên thông tin khách hàng cung cấp khi đặt hàng.',
      margin, y, { width: contentW, align: 'center' }
    );
    doc.font('Regular').fontSize(8.5).fillColor(COLOR_MUTED).text('Cảm ơn quý khách đã tin chọn Luméa!', margin, doc.y + 4, { width: contentW, align: 'center' });
    doc.font('Bold').fontSize(9).fillColor(COLOR_PRIMARY).text('Luméa — Interior & 3D', margin, doc.y + 6, { width: contentW, align: 'center' });

    doc.end();
  });
}

module.exports = { buildInvoicePdf };
