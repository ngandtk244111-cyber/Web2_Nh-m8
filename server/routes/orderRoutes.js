const crypto = require('crypto');
const express = require('express');
const { sendError } = require('../utils/http-error');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { attachUserId, requireUserId, requirePermission, userIdFromRequest, userIdFromToken } = require('../middleware/auth');
const { awardVoucher, reserveDiscountCode, releaseCodesForOrder, VoucherError } = require('../utils/vouchers');
const { verifyAndPriceOrderItems, resolveShippingFee } = require('../utils/pricing');
const { shippingOptions, findCarrier, trackingUrlFor, isDevMode, devTrackingCode } = require('../utils/shipping');
const { buildInvoicePdf } = require('../utils/invoicePdf');
const { isEmailConfigured, getMailTransporter } = require('../utils/otp');
const { issueWarrantiesForOrder, ensureOrderWarranties } = require('../utils/warranty');
const { needsRefund, buildRefund } = require('../utils/refund-policy');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Đổi trả: khách gửi yêu cầu trong 7 ngày kể từ khi nhận hàng (theo Chính sách đổi trả).
const RETURN_WINDOW_DAYS = 7;
const RETURN_REASONS = [
  'Sản phẩm bị lỗi, hư hỏng',
  'Giao sai mẫu / sai màu / sai kích thước',
  'Thiếu sản phẩm hoặc phụ kiện',
  'Sản phẩm khác với mô tả',
  'Khác',
];

/** Hạn cuối được gửi yêu cầu trả hàng của 1 đơn đã giao (null nếu đơn chưa giao). */
function returnDeadline(order) {
  if (order.status !== 'DELIVERED') return null;
  const delivered = order.deliveredAt || order.updatedAt;
  return delivered ? new Date(new Date(delivered).getTime() + RETURN_WINDOW_DAYS * 86400000) : null;
}

/** Chuẩn hoá yêu cầu xuất hoá đơn từ client; trả về { invoice } hoặc { error }. */
function readInvoiceRequest(body) {
  const raw = body?.invoice;
  if (!raw || !raw.requested) return { invoice: null };
  const type = raw.type === 'company' ? 'company' : 'personal';
  const email = String(raw.email || '').trim();
  if (!EMAIL_REGEX.test(email)) return { error: 'Email nhận hoá đơn không hợp lệ' };
  const invoice = { requested: true, type, email, companyName: '', taxCode: '', companyAddress: '' };
  if (type === 'company') {
    invoice.companyName = String(raw.companyName || '').trim();
    invoice.taxCode = String(raw.taxCode || '').trim();
    invoice.companyAddress = String(raw.companyAddress || '').trim();
    if (!invoice.companyName || !invoice.companyAddress) return { error: 'Vui lòng nhập tên và địa chỉ công ty để xuất hoá đơn' };
    if (!/^\d{10}(-\d{3})?$/.test(invoice.taxCode)) return { error: 'Mã số thuế gồm 10 số (hoặc 10 số-3 số cho chi nhánh)' };
  }
  return { invoice };
}

/** Gửi PDF hoá đơn tới email khách đã nhập (chỉ khi đã cấu hình SMTP; lỗi gửi mail không làm hỏng đơn). */
async function emailInvoice(order) {
  if (!order.invoice?.requested || !isEmailConfigured()) return;
  try {
    const pdf = await buildInvoicePdf(order.toObject ? order.toObject() : order);
    await getMailTransporter().sendMail({
      from: process.env.MAIL_FROM || `"Luméa" <${process.env.SMTP_USER}>`,
      to: order.invoice.email,
      subject: `Hoá đơn điện tử đơn hàng ${order.orderNumber} — Luméa`,
      html: `<p>Xin chào ${order.shippingAddress?.fullName || 'quý khách'},</p>
        <p>Luméa gửi kèm hoá đơn điện tử cho đơn hàng <strong>${order.orderNumber}</strong>.</p>
        <p>Cảm ơn quý khách đã mua sắm tại Luméa!</p>`,
      attachments: [{ filename: `HoaDon_${order.orderNumber}.pdf`, content: pdf }],
    });
    await Order.updateOne({ orderNumber: order.orderNumber }, { $set: { 'invoice.sentAt': new Date() } });
  } catch (err) {
    console.error('send invoice email error', err.message);
  }
}
const { StockError, reserveStock, restoreStockForOrder } = require('../utils/stock');
const { canViewOrder, isLocked, recordFailure } = require('../utils/order-access');
const { codNeedsPhoneConfirm } = require('../utils/cod-policy');

/** Lý do khách được tự chọn khi huỷ đơn (trang đơn hàng phía khách). */
// Giữ khớp với CANCEL_REASONS ở projects/my-client/src/app/core/data/cancel-reasons.ts
const CUSTOMER_CANCEL_REASONS = [
  'Tôi muốn cập nhật địa chỉ/số điện thoại nhận hàng',
  'Tôi muốn thêm/thay đổi mã giảm giá',
  'Tôi muốn thay đổi sản phẩm (màu sắc, kích thước, số lượng...)',
  'Thủ tục thanh toán quá rắc rối',
  'Tôi tìm thấy chỗ mua khác tốt hơn (rẻ hơn, uy tín hơn, giao nhanh hơn...)',
  'Thời gian giao hàng quá lâu',
  'Tôi đặt nhầm / đặt trùng đơn',
  'Tôi không có nhu cầu mua nữa',
  'Tôi không tìm thấy lý do huỷ phù hợp',
];
/** Khách chỉ tự huỷ được khi nhân viên chưa xác nhận đơn — đã xác nhận là bắt đầu chuẩn bị/đóng gói. */
const CUSTOMER_CANCELLABLE = ['PENDING'];

const router = express.Router();

// Bỏ các ký tự dễ nhầm (0/O, 1/I). 8 ký tự ngẫu nhiên từ crypto nên không dò được như mã 6 chữ số cũ.
const ORDER_NUMBER_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateOrderNumber() {
  return 'ORD-' + Array.from(crypto.randomBytes(8), byte => ORDER_NUMBER_CHARS[byte % ORDER_NUMBER_CHARS.length]).join('');
}

// Mã đơn ngẫu nhiên có thể trùng đơn cũ (unique index) — sinh lại mã thay vì báo lỗi 500.
async function createWithUniqueNumber(data, attempts = 5) {
  for (let i = 1; ; i++) {
    try {
      return await Order.create({ ...data, orderNumber: generateOrderNumber() });
    } catch (err) {
      if (err.code !== 11000 || !err.keyPattern?.orderNumber || i >= attempts) throw err;
    }
  }
}

function nowLabel() {
  const now = new Date();
  return now.toLocaleDateString('vi-VN') + ' ' + now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

// Admin: danh sách toàn bộ đơn hàng của mọi khách — chỉ my-admin (dashboard tab "Đơn Hàng") gọi,
// không phải endpoint công khai (khách tự tra đơn dùng /mine hoặc /by-number/:orderNumber).
router.get('/', requirePermission('orders.view', 'customers.view', 'inventory.view'), async (_req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json({ success: true, orders });
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/', attachUserId, async (req, res) => {
  try {
    const { items, shippingAddress, paymentMethod, couponCode, notes } = req.body;

    if (!Array.isArray(items) || items.length === 0 || !shippingAddress || !paymentMethod) {
      return res.status(400).json({ success: false, error: 'Thiếu thông tin đơn hàng' });
    }
    const { invoice, error: invoiceError } = readInvoiceRequest(req.body);
    if (invoiceError) return res.status(400).json({ success: false, error: invoiceError });

    // Bảo mật giá: tính lại toàn bộ đơn từ sản phẩm THẬT trong DB, không tin subtotal/discount/
    // shippingFee/total mà client gửi lên (trước đây tin thẳng, có thể sửa qua DevTools).
    let pricedItems, subtotal;
    try {
      ({ pricedItems, subtotal } = await verifyAndPriceOrderItems(items, Product));
    } catch (priceErr) {
      return res.status(400).json({ success: false, error: priceErr.message });
    }

    let stock;
    try {
      stock = await reserveStock(pricedItems);
    } catch (stockErr) {
      if (stockErr instanceof StockError) return res.status(400).json({ success: false, error: stockErr.message });
      throw stockErr;
    }

    // Giữ chỗ mã giảm giá trước khi tạo đơn: mỗi mã chỉ dùng 1 lần, dùng rồi là hết.
    let reserved;
    try {
      reserved = await reserveDiscountCode({ code: couponCode, userId: req.userId, phone: shippingAddress.phone, subtotal });
    } catch (codeErr) {
      await stock.release();
      if (codeErr instanceof VoucherError) return res.status(400).json({ success: false, error: codeErr.message });
      throw codeErr;
    }
    const discount = reserved.discount;
    const shippingFee = resolveShippingFee(subtotal);
    const total = Math.max(0, subtotal - discount + shippingFee);

    const hasPOD = pricedItems.some(i => i.product?.productionType === 'PRINT_ON_DEMAND');
    let productionProgress = null;
    if (hasPOD) {
      productionProgress = {
        currentStep: 'FILE_PREPARATION',
        percentage: 15,
        stepTitle: 'Tiếp nhận đơn in 3D & Kiểm tra file Slicing',
        notes: 'Kỹ thuật viên đang kiểm tra thông số lớp in, hướng đặt layer và hỗ trợ support.',
        updatedAt: nowLabel(),
      };
    }

    // Mọi đơn mới đều chờ nhân viên xác nhận (PENDING) — trong lúc này khách còn tự huỷ được.
    // COD lớn hoặc có hàng in 3D: nhân viên phải gọi khách khi xác nhận, tránh in đồ khắc tên riêng cho đơn ảo.
    const phoneConfirmRequired = paymentMethod === 'COD' && await codNeedsPhoneConfirm(total, hasPOD);

    let order;
    try {
      order = await createWithUniqueNumber({
      userId: req.userId || null,
      createdAtLabel: nowLabel(),
      status: 'PENDING',
      phoneConfirmRequired,
      hasPrintOnDemandItems: hasPOD,
      productionProgress,
      items: pricedItems,
      shippingAddress,
      invoice,
      paymentMethod,
      paymentStatus: 'UNPAID',
      subtotal,
      discount,
      shippingFee,
      total,
      notes: notes || '',
      stockReserved: true,
      });
    } catch (createErr) {
      await Promise.all([reserved.release(), stock.release()]); // tạo đơn lỗi -> trả lại mã và tồn kho
      throw createErr;
    }
    await reserved.attach(order.orderNumber);

    res.json({ success: true, order });
    emailInvoice(order); // gửi sau khi đã trả kết quả, không bắt khách chờ
  } catch (err) {
    console.error('create order error', err);
    sendError(res, err);
  }
});

// Hoá đơn PDF của 1 đơn — mở thẳng trong trình duyệt (inline), ?download=1 để tải về.
// Đơn của tài khoản chỉ chủ đơn xem được: token qua header, hoặc ?token= khi mở PDF bằng link (thẻ <a> không gửi header).
router.get('/:orderNumber/invoice', async (req, res) => {
  try {
    const order = await Order.findOne({ orderNumber: req.params.orderNumber }).lean();
    if (!order) return res.status(404).json({ success: false, error: 'Không tìm thấy đơn hàng' });
    const viewerId = (await userIdFromRequest(req)) || (await userIdFromToken(String(req.query.token || '')));
    if (order.userId && String(order.userId) !== String(viewerId || '')) {
      return res.status(403).json({ success: false, error: 'Bạn không có quyền xem hoá đơn này' });
    }
    const pdf = await buildInvoicePdf(order);
    const filename = `HoaDon_${order.orderNumber}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${req.query.download ? 'attachment' : 'inline'}; filename="${filename}"`);
    res.send(pdf);
  } catch (err) {
    console.error('invoice pdf error', err);
    sendError(res, err);
  }
});

// Không đủ quyền trả cùng lỗi với mã không tồn tại, để không dò được mã nào là đơn thật.
router.get('/by-number/:orderNumber', async (req, res) => {
  try {
    if (isLocked(req.ip)) {
      return res.status(429).json({ success: false, error: 'Bạn đã thử quá nhiều lần, vui lòng thử lại sau 15 phút.' });
    }
    const order = await Order.findOne({ orderNumber: req.params.orderNumber });
    if (!order || !(await canViewOrder(req, order, req.query.phone))) {
      recordFailure(req.ip);
      return res.status(404).json({ success: false, error: 'Không tìm thấy đơn hàng hoặc số điện thoại không khớp' });
    }
    await ensureOrderWarranties([order]);
    res.json({ success: true, order });
  } catch (err) {
    sendError(res, err);
  }
});

// Order history for a logged-in user (used by the account page).
router.get('/mine', requireUserId, async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.userId }).sort({ createdAt: -1 });
    await ensureOrderWarranties(orders);
    res.json({ success: true, orders });
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/return-reasons', (_req, res) => {
  res.json({ success: true, reasons: RETURN_REASONS, windowDays: RETURN_WINDOW_DAYS });
});

// Khách gửi yêu cầu trả hàng / hoàn tiền cho đơn đã giao của chính mình.
router.post('/:orderNumber/return-request', requireUserId, async (req, res) => {
  try {
    const reason = String(req.body.reason || '').trim();
    const description = String(req.body.description || '').trim().slice(0, 500);
    if (!RETURN_REASONS.includes(reason)) return res.status(400).json({ success: false, error: 'Vui lòng chọn lý do trả hàng' });
    if (reason === 'Khác' && !description) return res.status(400).json({ success: false, error: 'Vui lòng mô tả chi tiết lý do trả hàng' });
    const order = await Order.findOne({ orderNumber: req.params.orderNumber, userId: req.userId });
    if (!order) return res.status(404).json({ success: false, error: 'Không tìm thấy đơn hàng' });
    if (order.status !== 'DELIVERED') return res.status(400).json({ success: false, error: 'Chỉ yêu cầu trả hàng cho đơn đã giao thành công' });
    if (order.returnRequest) return res.status(409).json({ success: false, error: 'Đơn này đã có yêu cầu trả hàng' });
    const deadline = returnDeadline(order);
    if (deadline && deadline < new Date()) {
      return res.status(400).json({ success: false, error: `Đã quá ${RETURN_WINDOW_DAYS} ngày kể từ khi nhận hàng — vui lòng liên hệ hỗ trợ` });
    }
    order.returnRequest = { status: 'PENDING', reason, description, refundAmount: order.total, requestedAt: new Date() };
    await order.save();
    res.json({ success: true, order });
  } catch (err) {
    sendError(res, err);
  }
});

// Khách huỷ yêu cầu trả hàng khi shop chưa duyệt.
router.patch('/:orderNumber/return-request/cancel', requireUserId, async (req, res) => {
  try {
    const order = await Order.findOne({ orderNumber: req.params.orderNumber, userId: req.userId });
    if (!order?.returnRequest) return res.status(404).json({ success: false, error: 'Không tìm thấy yêu cầu trả hàng' });
    if (order.returnRequest.status !== 'PENDING') {
      return res.status(400).json({ success: false, error: 'Yêu cầu đã được shop xử lý, không thể huỷ' });
    }
    order.returnRequest = null;
    await order.save();
    res.json({ success: true, order });
  } catch (err) {
    sendError(res, err);
  }
});

// Khách xác nhận đã nhận lại tiền hoàn -> hoàn tất đổi trả.
router.patch('/:orderNumber/return-request/received', requireUserId, async (req, res) => {
  try {
    const order = await Order.findOne({ orderNumber: req.params.orderNumber, userId: req.userId });
    if (!order?.returnRequest) return res.status(404).json({ success: false, error: 'Không tìm thấy yêu cầu trả hàng' });
    if (order.returnRequest.status !== 'APPROVED') {
      return res.status(400).json({ success: false, error: 'Yêu cầu chưa ở bước hoàn tiền' });
    }
    order.returnRequest.status = 'COMPLETED';
    order.returnRequest.completedAt = new Date();
    await order.save();
    res.json({ success: true, order });
  } catch (err) {
    sendError(res, err);
  }
});

// Admin duyệt / từ chối / hoàn tất yêu cầu trả hàng.
router.patch('/:orderNumber/return-request/review', requirePermission('orders.approve'), async (req, res) => {
  try {
    const action = String(req.body.action || '');
    const adminNote = String(req.body.adminNote || '').trim().slice(0, 500);
    const order = await Order.findOne({ orderNumber: req.params.orderNumber });
    if (!order?.returnRequest) return res.status(404).json({ success: false, error: 'Không tìm thấy yêu cầu trả hàng' });
    const rr = order.returnRequest;
    const now = new Date();
    if (action === 'approve' && rr.status === 'PENDING') {
      Object.assign(rr, { status: 'APPROVED', approvedAt: now, adminNote: adminNote || rr.adminNote });
    } else if (action === 'reject' && rr.status === 'PENDING') {
      if (!adminNote) return res.status(400).json({ success: false, error: 'Vui lòng nhập lý do từ chối' });
      Object.assign(rr, { status: 'REJECTED', rejectedAt: now, adminNote });
    } else if (action === 'complete' && rr.status === 'APPROVED') {
      Object.assign(rr, { status: 'COMPLETED', completedAt: now, adminNote: adminNote || rr.adminNote });
    } else {
      return res.status(400).json({ success: false, error: 'Thao tác không hợp lệ với trạng thái hiện tại' });
    }
    await order.save();
    res.json({ success: true, order });
  } catch (err) {
    sendError(res, err);
  }
});

// Khách đổi phương thức thanh toán của đơn CHƯA trả tiền (vd: chọn MoMo rồi muốn quay lại chuyển khoản / COD).
// Giữ nguyên đơn, giá và mã giảm giá đã dùng — chỉ đổi cách trả tiền.
const SWITCHABLE_METHODS = ['COD', 'BANK_TRANSFER', 'MOMO', 'ZALOPAY', 'ATM'];
router.patch('/:orderNumber/payment-method', attachUserId, async (req, res) => {
  try {
    const paymentMethod = String(req.body.paymentMethod || '');
    if (!SWITCHABLE_METHODS.includes(paymentMethod)) {
      return res.status(400).json({ success: false, error: 'Phương thức thanh toán không hợp lệ' });
    }
    const order = await Order.findOne({ orderNumber: req.params.orderNumber });
    if (!order) return res.status(404).json({ success: false, error: 'Không tìm thấy đơn hàng' });
    if (order.userId && String(order.userId) !== String(req.userId || '')) {
      return res.status(403).json({ success: false, error: 'Bạn không có quyền đổi đơn hàng này' });
    }
    if (order.paymentStatus === 'PAID') return res.status(400).json({ success: false, error: 'Đơn đã thanh toán, không thể đổi phương thức' });
    if (!['PENDING', 'CONFIRMED', 'IN_PRODUCTION'].includes(order.status)) {
      return res.status(400).json({ success: false, error: 'Đơn đã giao hoặc đã huỷ, không thể đổi phương thức' });
    }
    if (order.paymentMethod !== paymentMethod) {
      order.paymentMethod = paymentMethod;
      order.paymentStatus = 'UNPAID';
      order.transferReportedAt = null;
      order.paymentTransactionId = '';
      await order.save();
    }
    res.json({ success: true, order });
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/cancel-reasons', (_req, res) => {
  res.json({ success: true, reasons: CUSTOMER_CANCEL_REASONS });
});

// Khách tự huỷ đơn của chính mình (chỉ khi nhân viên chưa xác nhận) — bắt buộc chọn lý do.
// Đơn đã trả trước thì tạo yêu cầu hoàn tiền; chuyển khoản ngân hàng cần tài khoản nhận tiền hoàn của khách.
router.patch('/:orderNumber/cancel', requireUserId, async (req, res) => {
  try {
    const reason = String(req.body.reason || '').trim();
    const detail = String(req.body.detail || '').trim().slice(0, 300);
    if (!CUSTOMER_CANCEL_REASONS.includes(reason)) {
      return res.status(400).json({ success: false, error: 'Vui lòng chọn lý do huỷ đơn' });
    }
    const order = await Order.findOne({ orderNumber: req.params.orderNumber, userId: req.userId });
    if (!order) return res.status(404).json({ success: false, error: 'Không tìm thấy đơn hàng' });
    if (!CUSTOMER_CANCELLABLE.includes(order.status)) {
      return res.status(400).json({ success: false, error: 'Đơn đã được xác nhận và đang chuẩn bị hàng, không thể tự huỷ. Vui lòng liên hệ hỗ trợ.' });
    }
    if (needsRefund(order)) {
      const bank = req.body.refundBank || {};
      if (order.paymentMethod === 'BANK_TRANSFER') {
        bank.bankAccount = String(bank.bankAccount || '').replace(/\s/g, '');
        if (!String(bank.bankName || '').trim() || !String(bank.accountHolder || '').trim()) {
          return res.status(400).json({ success: false, error: 'Vui lòng nhập ngân hàng và tên chủ tài khoản để nhận tiền hoàn' });
        }
        if (!/^\d{6,20}$/.test(bank.bankAccount)) {
          return res.status(400).json({ success: false, error: 'Số tài khoản nhận tiền hoàn gồm 6–20 chữ số' });
        }
      }
      order.refund = buildRefund(order, order.paymentMethod === 'BANK_TRANSFER' ? bank : {});
    }
    order.status = 'CANCELLED';
    order.cancelReason = detail ? `${reason}: ${detail}` : reason;
    order.cancelledAt = new Date();
    await order.save();
    // Trả lại mã đã dùng cho đơn này (voucher còn hạn thì khách dùng lại được).
    await releaseCodesForOrder(order.orderNumber);
    await restoreStockForOrder(order.orderNumber);
    res.json({ success: true, order });
  } catch (err) {
    sendError(res, err);
  }
});

// Khách bấm "Tôi đã chuyển khoản" ở trang checkout: chỉ GHI NHẬN là khách báo đã chuyển, không tự
// đánh dấu PAID — trước đây khách bấm là thành "Đã thanh toán" dù tiền chưa về. Nhân viên đối soát
// sao kê rồi xác nhận ở my-admin (PATCH /payment-status).
router.patch('/:orderNumber/confirm-payment', async (req, res) => {
  try {
    const existing = await Order.findOne({ orderNumber: req.params.orderNumber });
    if (!existing || !(await canViewOrder(req, existing, req.body.phone))) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy đơn hàng' });
    }
    const order = await Order.findOneAndUpdate(
      { orderNumber: req.params.orderNumber, paymentStatus: { $ne: 'PAID' } },
      { transferReportedAt: new Date() },
      { new: true }
    ) || existing;
    res.json({ success: true, order });
  } catch (err) {
    sendError(res, err);
  }
});

// Admin: xác nhận đã nhận tiền (đối soát chuyển khoản / đã thu COD) hoặc hoàn tác.
// MoMo/ZaloPay tự cập nhật qua IPN có chữ ký ở paymentRoutes.js, không đi qua route này.
router.patch('/:orderNumber/payment-status', requirePermission('orders.approve'), async (req, res) => {
  try {
    const { paymentStatus } = req.body;
    if (!['PAID', 'UNPAID'].includes(paymentStatus)) {
      return res.status(400).json({ success: false, error: 'Trạng thái thanh toán không hợp lệ' });
    }
    const existing = await Order.findOne({ orderNumber: req.params.orderNumber });
    if (!existing) return res.status(404).json({ success: false, error: 'Không tìm thấy đơn hàng' });
    // COD: tiền do shipper thu và hãng vận chuyển giữ — chỉ xác nhận đã nhận khi đơn đã giao xong
    // và đã đối soát với hãng.
    if (paymentStatus === 'PAID' && existing.paymentMethod === 'COD' && existing.status !== 'DELIVERED') {
      return res.status(400).json({ success: false, error: 'Đơn COD chỉ xác nhận đã nhận tiền sau khi giao thành công và đối soát với hãng vận chuyển' });
    }
    const order = await Order.findOneAndUpdate(
      { orderNumber: req.params.orderNumber },
      { paymentStatus, paidConfirmedBy: paymentStatus === 'PAID' ? req.adminId : null },
      { new: true }
    );
    res.json({ success: true, order });
  } catch (err) {
    sendError(res, err);
  }
});

const ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'IN_PRODUCTION', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED'];
const FINAL_STATUSES = ['DELIVERED', 'CANCELLED', 'RETURNED'];

async function loadOpenOrder(req, res) {
  const order = await Order.findOne({ orderNumber: req.params.orderNumber });
  if (!order) {
    res.status(404).json({ success: false, error: 'Không tìm thấy đơn hàng' });
    return null;
  }
  // Đơn đã hoàn thành / huỷ / hoàn hàng thì khoá, tránh bấm nhầm làm sai lịch sử và voucher thưởng.
  if (FINAL_STATUSES.includes(order.status)) {
    res.status(400).json({ success: false, error: 'Đơn đã kết thúc (hoàn thành / huỷ / hoàn hàng), không thể cập nhật thêm' });
    return null;
  }
  return order;
}

// Admin: xác nhận đơn -> bắt đầu chuẩn bị/đóng gói (đơn in 3D thì vào sản xuất). Sau bước này khách
// không tự huỷ được nữa. Đơn COD phải gọi khách thì dùng "confirm-phone" bên dưới.
router.patch('/:orderNumber/confirm', requirePermission('orders.edit'), async (req, res) => {
  try {
    const order = await loadOpenOrder(req, res);
    if (!order) return;
    if (order.status !== 'PENDING') return res.status(400).json({ success: false, error: 'Đơn đã được xác nhận rồi' });
    if (order.paymentMethod === 'COD' && order.phoneConfirmRequired !== false && !order.phoneConfirmedAt) {
      return res.status(400).json({ success: false, error: 'Đơn COD này cần gọi xác nhận với khách trước' });
    }
    order.status = order.hasPrintOnDemandItems ? 'IN_PRODUCTION' : 'CONFIRMED';
    await order.save();
    res.json({ success: true, order });
  } catch (err) {
    sendError(res, err);
  }
});

// Admin: gọi điện xác nhận đơn với khách — bắt buộc trước khi giao đơn COD.
router.patch('/:orderNumber/confirm-phone', requirePermission('orders.edit'), async (req, res) => {
  try {
    const order = await loadOpenOrder(req, res);
    if (!order) return;
    order.phoneConfirmedAt = new Date();
    order.phoneConfirmedBy = req.adminId;
    if (order.status === 'PENDING') order.status = order.hasPrintOnDemandItems ? 'IN_PRODUCTION' : 'CONFIRMED';
    await order.save();
    res.json({ success: true, order });
  } catch (err) {
    sendError(res, err);
  }
});

// Admin: hãng vận chuyển phù hợp cho đơn (hàng cồng kềnh? nội thành hay liên tỉnh?).
router.get('/:orderNumber/shipping-options', requirePermission('orders.view'), async (req, res) => {
  try {
    const order = await Order.findOne({ orderNumber: req.params.orderNumber }).lean();
    if (!order) return res.status(404).json({ success: false, error: 'Không tìm thấy đơn hàng' });
    res.json({ success: true, devMode: isDevMode(), ...shippingOptions(order) });
  } catch (err) {
    sendError(res, err);
  }
});

// Admin: tạo vận đơn với hãng vận chuyển và chuyển đơn sang "Đang giao".
router.patch('/:orderNumber/ship', requirePermission('orders.edit'), async (req, res) => {
  try {
    const order = await loadOpenOrder(req, res);
    if (!order) return;
    if (order.status === 'SHIPPED') return res.status(400).json({ success: false, error: 'Đơn đang được giao rồi' });
    if (order.status === 'PENDING') return res.status(400).json({ success: false, error: 'Xác nhận đơn trước khi tạo vận đơn' });
    if (order.paymentMethod === 'COD' && order.phoneConfirmRequired !== false && !order.phoneConfirmedAt) {
      return res.status(400).json({ success: false, error: 'Đơn COD phải gọi xác nhận với khách trước khi giao' });
    }

    if (order.status === 'IN_PRODUCTION' && !['PACKAGING', 'DISPATCHED'].includes(order.productionProgress?.currentStep)) {
      return res.status(400).json({ success: false, error: 'Đơn in 3D chưa hoàn tất — cập nhật tới bước "Đóng gói" rồi mới giao' });
    }

    const carrier = findCarrier(req.body.carrier);
    if (!carrier) return res.status(400).json({ success: false, error: 'Vui lòng chọn đơn vị vận chuyển' });

    let trackingCode = String(req.body.trackingCode || '').trim();
    if (!trackingCode && carrier.id !== 'LUMEA_FLEET') {
      if (!isDevMode()) return res.status(400).json({ success: false, error: 'Vui lòng nhập mã vận đơn do hãng vận chuyển cấp' });
      trackingCode = devTrackingCode(carrier.id);
    }
    const fee = Math.max(0, Number(req.body.fee) || 0);

    order.shipment = {
      carrier: carrier.id,
      carrierName: carrier.name,
      trackingCode,
      trackingUrl: String(req.body.trackingUrl || '').trim() || trackingUrlFor(carrier, trackingCode),
      fee,
      note: String(req.body.note || '').trim(),
      shippedAt: new Date(),
      createdBy: req.adminId,
    };
    order.status = 'SHIPPED';
    if (order.hasPrintOnDemandItems) {
      order.productionProgress = {
        currentStep: 'DISPATCHED',
        percentage: 100,
        stepTitle: `Đã bàn giao ${carrier.name}`,
        notes: 'Đã dán tem bảo hành Luméa',
        updatedAt: nowLabel(),
      };
    }
    await order.save();
    res.json({ success: true, order });
  } catch (err) {
    sendError(res, err);
  }
});

// Admin: cập nhật tiến độ sản xuất / kết quả giao (thành công, hoàn hàng) / huỷ.
router.patch('/:orderNumber/production', requirePermission('orders.edit'), async (req, res) => {
  try {
    const { status, productionProgress, cancelReason, returnReason } = req.body;
    if (status && !ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, error: 'Trạng thái đơn không hợp lệ' });
    }
    const order = await loadOpenOrder(req, res);
    if (!order) return;

    if (status === 'SHIPPED') {
      return res.status(400).json({ success: false, error: 'Dùng "Tạo vận đơn" để giao hàng (cần chọn đơn vị vận chuyển)' });
    }
    if ((status === 'DELIVERED' || status === 'RETURNED') && order.status !== 'SHIPPED') {
      return res.status(400).json({ success: false, error: 'Chỉ cập nhật kết quả giao cho đơn đang giao' });
    }
    if (status === 'CANCELLED') {
      if (order.status === 'SHIPPED') {
        return res.status(400).json({ success: false, error: 'Đơn đang giao — nếu khách không nhận, chọn "Giao thất bại / hoàn hàng"' });
      }
      if (!String(cancelReason || '').trim()) return res.status(400).json({ success: false, error: 'Vui lòng nhập lý do huỷ đơn' });
    }
    if (status === 'RETURNED' && !String(returnReason || '').trim()) {
      return res.status(400).json({ success: false, error: 'Vui lòng nhập lý do giao thất bại' });
    }

    if (status) order.status = status;
    if (productionProgress) order.productionProgress = productionProgress;
    if (status === 'CANCELLED') {
      Object.assign(order, { cancelReason: String(cancelReason).trim(), cancelledAt: new Date() });
      // Nhân viên huỷ đơn đã trả trước: tạo yêu cầu hoàn tiền (chuyển khoản thì liên hệ khách lấy tài khoản nhận).
      if (needsRefund(order) && !order.refund) order.refund = buildRefund(order);
    }
    if (status === 'RETURNED') Object.assign(order, { returnReason: String(returnReason).trim(), returnedAt: new Date() });
    if (status === 'DELIVERED') {
      order.deliveredAt = new Date();
      // COD: shipper đã thu tiền, còn chờ đối soát với hãng mới tính là đã thanh toán.
      if (order.paymentMethod === 'COD') order.codCollectedAt = new Date();
      await issueWarrantiesForOrder(order);
    }
    await order.save();
    if (status === 'CANCELLED') await releaseCodesForOrder(order.orderNumber);
    if (status === 'CANCELLED' || status === 'RETURNED') await restoreStockForOrder(order.orderNumber);

    // Đơn giao thành công -> tặng 1 voucher cho lần mua sau (chỉ áp dụng nếu đơn gắn với tài khoản thật).
    if (order.status === 'DELIVERED' && order.userId) {
      await awardVoucher({
        userId: order.userId,
        tierKey: 'P5',
        source: 'ORDER_DELIVERED',
        refId: order.orderNumber,
        note: `Cảm ơn bạn đã mua đơn ${order.orderNumber}`,
      });
    }

    res.json({ success: true, order });
  } catch (err) {
    sendError(res, err);
  }
});

// Admin: hoàn tất hoàn tiền (kèm mã giao dịch) hoặc huỷ yêu cầu hoàn (vd. khách báo CK nhưng tiền chưa về).
router.patch('/:orderNumber/refund', requirePermission('orders.approve'), async (req, res) => {
  try {
    const { action } = req.body;
    const transactionRef = String(req.body.transactionRef || '').trim().slice(0, 100);
    const adminNote = String(req.body.adminNote || '').trim().slice(0, 300);
    const order = await Order.findOne({ orderNumber: req.params.orderNumber });
    if (!order) return res.status(404).json({ success: false, error: 'Không tìm thấy đơn hàng' });
    if (!order.refund || order.refund.status !== 'PENDING') {
      return res.status(400).json({ success: false, error: 'Đơn không có yêu cầu hoàn tiền đang chờ' });
    }
    if (action === 'complete') {
      if (!transactionRef) return res.status(400).json({ success: false, error: 'Vui lòng nhập mã giao dịch hoàn tiền' });
      Object.assign(order.refund, { status: 'COMPLETED', completedAt: new Date(), transactionRef, adminNote });
      order.paymentStatus = 'REFUNDED';
    } else if (action === 'void') {
      if (!adminNote) return res.status(400).json({ success: false, error: 'Vui lòng ghi lý do không hoàn tiền' });
      Object.assign(order.refund, { status: 'VOID', completedAt: new Date(), adminNote });
    } else {
      return res.status(400).json({ success: false, error: 'Thao tác không hợp lệ' });
    }
    await order.save();
    res.json({ success: true, order });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
