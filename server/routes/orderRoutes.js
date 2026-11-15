const express = require('express');
const { sendError } = require('../utils/http-error');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Admin = require('../models/Admin');
const CustomRequest = require('../models/CustomRequest');
const PaymentTransaction = require('../models/PaymentTransaction');
const {
  attachUserId, requireUserId, requirePermission, userIdFromRequest, userIdFromToken, adminIdFromRequest, validId,
} = require('../middleware/auth');
const { adminHasPermission } = require('../utils/permissions');
const { writeAudit } = require('../utils/audit');
const {
  isDepositOrder, productionBlockReason, refreshDepositState, settleDepositExpiry, settleExpiredInList, paymentInstructions,
  afterLedgerChange,
} = require('../utils/custom-order');
const {
  VERIFY_SLA_HOURS, MAX_CUSTOMER_REPORTS, MAX_STAFF_EXTENSION_HOURS, depositFor, awaitingDeposit,
} = require('../utils/deposit');
const { awardVoucher, reserveDiscountCode, releaseCodesForOrder, VoucherError } = require('../utils/vouchers');
const { verifyAndPriceOrderItems, resolveShippingFee } = require('../utils/pricing');
const { shippingOptions, findCarrier, trackingUrlFor, isDevMode, devTrackingCode } = require('../utils/shipping');
const { buildInvoicePdf } = require('../utils/invoicePdf');
const { isEmailConfigured, getMailTransporter } = require('../utils/otp');
const { issueWarrantiesForOrder, ensureOrderWarranties } = require('../utils/warranty');
const { needsRefund, buildRefund } = require('../utils/refund-policy');
const { assignProductionWorkshops } = require('../utils/workshops');

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

const { generateOrderNumber } = require('../utils/order-number');

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
    const orders = await settleExpiredInList(await Order.find().sort({ createdAt: -1 }));
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
    // Hàng đặt làm theo báo giá không đi qua giỏ hàng (giỏ cũ có thể còn sản phẩm ảo "custom-...").
    if (items.some(i => /^(custom-|quote:)/.test(String(i?.product?.id || '')))) {
      return res.status(400).json({
        success: false,
        error: 'Sản phẩm đặt làm theo báo giá được thanh toán riêng tại trang yêu cầu đặt làm. Vui lòng xoá khỏi giỏ hàng và đặt hàng riêng.',
      });
    }

    // Bảo mật giá: tính lại toàn bộ đơn từ sản phẩm THẬT trong DB, không tin subtotal/discount/
    // shippingFee/total mà client gửi lên (trước đây tin thẳng, có thể sửa qua DevTools).
    let pricedItems, subtotal;
    try {
      ({ pricedItems, subtotal } = await verifyAndPriceOrderItems(items, Product));
    } catch (priceErr) {
      return res.status(400).json({ success: false, error: priceErr.message });
    }

    // Hàng in 3D theo yêu cầu: phải trả trước 100% (MoMo / ZaloPay / ATM qua cổng, hoặc chuyển khoản
    // nhân viên đối soát), không COD — in xong khách bỏ là không bán lại được.
    if (paymentMethod === 'COD' && pricedItems.some(i => i.product?.productionType === 'PRINT_ON_DEMAND')) {
      return res.status(400).json({ success: false, error: 'Đơn có hàng in 3D theo yêu cầu cần thanh toán trước 100%, không hỗ trợ COD' });
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
      paymentPolicyVersion: 2,
      phoneConfirmRequired,
      hasPrintOnDemandItems: hasPOD,
      productionProgress,
      items: pricedItems,
      shippingAddress,
      invoice,
      paymentMethod,
      paymentStatus: 'UNPAID',
      depositAmount: depositFor(total, paymentMethod),
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
    let order = await Order.findOne({ orderNumber: req.params.orderNumber });
    if (!order || !(await canViewOrder(req, order, req.query.phone))) {
      recordFailure(req.ip);
      return res.status(404).json({ success: false, error: 'Không tìm thấy đơn hàng hoặc số điện thoại không khớp' });
    }
    order = await settleDepositExpiry(order);
    await ensureOrderWarranties([order]);
    res.json({ success: true, order, payment: paymentInstructions(order) });
  } catch (err) {
    sendError(res, err);
  }
});

// Order history for a logged-in user (used by the account page).
router.get('/mine', requireUserId, async (req, res) => {
  try {
    const orders = await settleExpiredInList(await Order.find({ userId: req.userId }).sort({ createdAt: -1 }));
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
    if (order.orderType === 'CUSTOM_QUOTE') {
      return res.status(400).json({ success: false, error: 'Đơn đặt làm theo báo giá thanh toán cọc bằng chuyển khoản, không đổi phương thức được' });
    }
    if (paymentMethod === 'COD' && order.hasPrintOnDemandItems && (order.paymentPolicyVersion || 1) >= 2) {
      return res.status(400).json({ success: false, error: 'Đơn có hàng in 3D theo yêu cầu cần thanh toán trước 100%, không hỗ trợ COD' });
    }
    if (order.paymentStatus === 'PAID') return res.status(400).json({ success: false, error: 'Đơn đã thanh toán, không thể đổi phương thức' });
    if (!['PENDING', 'CONFIRMED', 'IN_PRODUCTION'].includes(order.status)) {
      return res.status(400).json({ success: false, error: 'Đơn đã giao hoặc đã huỷ, không thể đổi phương thức' });
    }
    if (order.paymentMethod !== paymentMethod) {
      order.paymentMethod = paymentMethod;
      // Đổi sang / khỏi COD thì tính lại tiền cọc bắt buộc (chưa nhận cọc mới đổi).
      if (!order.depositPaidAt) order.depositAmount = depositFor(order.total, paymentMethod);
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
    if (isDepositOrder(order)) {
      // Đơn đặt làm chưa sản xuất (PENDING): hoàn 100% tiền cọc đã XÁC NHẬN nhận được.
      if (order.depositStatus === 'VERIFYING') {
        return res.status(400).json({ success: false, error: 'Shop đang đối soát khoản chuyển khoản của bạn. Vui lòng chờ đối soát xong (hoặc liên hệ hỗ trợ) rồi mới huỷ.' });
      }
      if ((order.depositReceived || 0) > 0) {
        const bank = req.body.refundBank || {};
        bank.bankAccount = String(bank.bankAccount || '').replace(/\s/g, '');
        if (!String(bank.bankName || '').trim() || !String(bank.accountHolder || '').trim() || !/^\d{6,20}$/.test(bank.bankAccount)) {
          return res.status(400).json({ success: false, error: 'Vui lòng nhập ngân hàng, số tài khoản (6–20 số) và tên chủ tài khoản để nhận lại tiền cọc' });
        }
        order.refund = { ...buildRefund(order, bank), amount: order.depositReceived, channel: 'Chuyển khoản hoàn tiền cọc về tài khoản khách cung cấp' };
        order.depositStatus = 'REFUND_PENDING';
      }
      order.status = 'CANCELLED';
      order.cancelReason = detail ? `${reason}: ${detail}` : reason;
      order.cancelledAt = new Date();
      await order.save();
      await CustomRequest.updateOne(
        { id: order.customRequestRef?.requestId, orderNumber: order.orderNumber },
        { $set: { status: 'IN_DISCUSSION', orderNumber: null, acceptedQuoteId: null } }
      );
      return res.json({ success: true, order });
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
    if (isDepositOrder(existing)) {
      return res.status(400).json({ success: false, error: 'Đơn đặt làm: vui lòng báo chuyển khoản cọc ở mục Thanh toán cọc của đơn' });
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
const ONLINE_GATEWAYS = ['MOMO', 'ZALOPAY', 'VNPAY'];
router.patch('/:orderNumber/payment-status', requirePermission('orders.approve'), async (req, res) => {
  try {
    const { paymentStatus } = req.body;
    if (!['PAID', 'UNPAID'].includes(paymentStatus)) {
      return res.status(400).json({ success: false, error: 'Trạng thái thanh toán không hợp lệ' });
    }
    const existing = await Order.findOne({ orderNumber: req.params.orderNumber });
    if (!existing) return res.status(404).json({ success: false, error: 'Không tìm thấy đơn hàng' });
    // Đơn đặt làm: "đã thanh toán" = đã nhận đủ cả cọc lẫn phần còn lại; cọc đối soát ở sổ giao dịch riêng.
    if (paymentStatus === 'PAID' && isDepositOrder(existing) && existing.depositStatus !== 'PAID') {
      return res.status(400).json({ success: false, error: 'Đơn đặt làm chưa xác nhận đủ tiền cọc — đối soát cọc trước' });
    }
    if (paymentStatus === 'UNPAID' && isDepositOrder(existing) && (existing.depositReceived || 0) >= existing.total) {
      return res.status(400).json({ success: false, error: 'Toàn bộ tiền đơn đã được ghi nhận qua sổ cọc, không chuyển về chưa thanh toán được' });
    }
    // COD: tiền do shipper thu và hãng vận chuyển giữ — chỉ xác nhận đã nhận khi đơn đã giao xong
    // và đã đối soát với hãng.
    if (paymentStatus === 'PAID' && existing.paymentMethod === 'COD' && existing.status !== 'DELIVERED') {
      return res.status(400).json({ success: false, error: 'Đơn COD chỉ xác nhận đã nhận tiền sau khi giao thành công và đối soát với hãng vận chuyển' });
    }
    // Đơn trả qua cổng (MoMo/ZaloPay/VNPay): tiền đã thực nhận, không chuyển ngược về chưa thanh toán —
    // muốn trả tiền cho khách thì đi qua luồng hoàn tiền.
    if (paymentStatus === 'UNPAID' && existing.paymentStatus === 'PAID' && ONLINE_GATEWAYS.includes(existing.paymentMethod)) {
      return res.status(400).json({ success: false, error: 'Đơn đã thanh toán qua cổng online, không thể chuyển về chưa thanh toán. Dùng chức năng hoàn tiền nếu cần trả tiền cho khách.' });
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
    if (awaitingDeposit(order)) return res.status(400).json({ success: false, error: 'Đơn chưa nhận tiền cọc — xác nhận đã nhận cọc trước' });
    if (order.paymentMethod === 'COD' && order.phoneConfirmRequired !== false && !order.phoneConfirmedAt) {
      return res.status(400).json({ success: false, error: 'Đơn COD này cần gọi xác nhận với khách trước' });
    }
    if (order.hasPrintOnDemandItems) {
      const blocked = productionBlockReason(order);
      if (blocked) return res.status(400).json({ success: false, error: blocked });
      await startProduction(req, order);
    } else {
      order.status = 'CONFIRMED';
    }
    await assignProductionWorkshops(order);
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
    if (awaitingDeposit(order)) return res.status(400).json({ success: false, error: 'Đơn chưa nhận tiền cọc — xác nhận đã nhận cọc trước khi chốt đơn với khách' });
    order.phoneConfirmedAt = new Date();
    order.phoneConfirmedBy = req.adminId;
    if (order.status === 'PENDING') {
      // Gọi xác nhận được ghi nhận, nhưng đơn in 3D chưa đủ điều kiện thanh toán thì vẫn ở PENDING.
      if (!order.hasPrintOnDemandItems) order.status = 'CONFIRMED';
      else if (!productionBlockReason(order)) await startProduction(req, order);
    }
    await assignProductionWorkshops(order);
    await order.save();
    res.json({ success: true, order });
  } catch (err) {
    sendError(res, err);
  }
});

// Admin: đã nhận tiền cọc của đơn COD lớn (đối soát sao kê). Sau đó mới chốt đơn / gọi xác nhận được.
router.patch('/:orderNumber/deposit-received', requirePermission('orders.approve'), async (req, res) => {
  try {
    const order = await loadOpenOrder(req, res);
    if (!order) return;
    if (!(order.depositAmount > 0)) return res.status(400).json({ success: false, error: 'Đơn này không cần đặt cọc' });
    if (order.depositPaidAt) return res.status(400).json({ success: false, error: 'Đã xác nhận nhận cọc rồi' });
    order.depositPaidAt = new Date();
    await order.save();
    res.json({ success: true, order });
  } catch (err) {
    sendError(res, err);
  }
});

// Admin: gọi xác nhận nhưng khách không nghe máy — ghi lại để gọi lại sau, chưa huỷ đơn ngay.
router.patch('/:orderNumber/call-failed', requirePermission('orders.edit'), async (req, res) => {
  try {
    const order = await loadOpenOrder(req, res);
    if (!order) return;
    if (order.status !== 'PENDING' || order.phoneConfirmedAt) {
      return res.status(400).json({ success: false, error: 'Đơn này không còn chờ gọi xác nhận' });
    }
    order.failedCallsAt.push(new Date());
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
    // Không cho chuyển ngược trạng thái (vd. đang sản xuất -> chờ xác nhận) qua route này.
    if (status === 'PENDING' && order.status !== 'PENDING') {
      return res.status(400).json({ success: false, error: 'Không thể chuyển đơn về trạng thái chờ xác nhận' });
    }
    if (status === 'CONFIRMED' && order.status === 'IN_PRODUCTION') {
      return res.status(400).json({ success: false, error: 'Đơn đang sản xuất, không chuyển ngược về đã xác nhận' });
    }
    const startingProduction = status === 'IN_PRODUCTION' && order.status !== 'IN_PRODUCTION';
    if (startingProduction) {
      const blocked = productionBlockReason(order);
      if (blocked) return res.status(400).json({ success: false, error: blocked });
    }
    // Đơn đặt làm (cọc) chỉ được xác nhận / sản xuất qua luồng có kiểm tra cọc.
    if (status === 'CONFIRMED' && isDepositOrder(order)) {
      return res.status(400).json({ success: false, error: 'Đơn đặt làm chuyển thẳng sang sản xuất sau khi đủ cọc' });
    }

    if (startingProduction) await startProduction(req, order);
    else if (status) order.status = status;
    if (productionProgress) order.productionProgress = productionProgress;
    if (status === 'CANCELLED') {
      Object.assign(order, { cancelReason: String(cancelReason).trim(), cancelledAt: new Date() });
      if (isDepositOrder(order)) {
        // Đơn đặt làm: hoàn lại tiền cọc đã xác nhận (mặc định 100%; giữ một phần sau khi đã sản xuất
        // được xử lý ở bước hoàn tiền, bắt buộc ghi lý do).
        if ((order.depositReceived || 0) > 0 && !order.refund) {
          order.refund = { ...buildRefund(order), amount: order.depositReceived, channel: 'Chuyển khoản hoàn tiền cọc về tài khoản khách cung cấp' };
          order.depositStatus = 'REFUND_PENDING';
        }
      } else if (needsRefund(order) && !order.refund) {
        // Nhân viên huỷ đơn đã trả trước: tạo yêu cầu hoàn tiền (chuyển khoản thì liên hệ khách lấy tài khoản nhận).
        order.refund = buildRefund(order);
      }
    }
    if (status === 'RETURNED') Object.assign(order, { returnReason: String(returnReason).trim(), returnedAt: new Date() });
    await assignProductionWorkshops(order);
    if (status === 'DELIVERED') {
      order.deliveredAt = new Date();
      // COD: shipper đã thu tiền, còn chờ đối soát với hãng mới tính là đã thanh toán.
      if (order.paymentMethod === 'COD') order.codCollectedAt = new Date();
      await issueWarrantiesForOrder(order);
    }
    await order.save();
    if (status === 'CANCELLED') await releaseCodesForOrder(order.orderNumber);
    if (status === 'CANCELLED' || status === 'RETURNED') await restoreStockForOrder(order.orderNumber);
    if (status === 'CANCELLED' && isDepositOrder(order)) {
      await CustomRequest.updateOne(
        { id: order.customRequestRef?.requestId, orderNumber: order.orderNumber },
        { $set: { status: 'IN_DISCUSSION', orderNumber: null, acceptedQuoteId: null } }
      );
      const actor = await Admin.findById(req.adminId);
      await writeAudit(req, actor, {
        module: 'Đặt Làm', action: 'Huỷ đơn đặt làm',
        detail: `${order.orderNumber}: ${order.cancelReason}. Cọc đã nhận ${order.depositReceived || 0}đ${order.refund ? `, chờ hoàn ${order.refund.amount}đ` : ''}`,
        level: 'WARNING',
      });
    }

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
    const deposit = isDepositOrder(order);
    if (action === 'complete') {
      if (!transactionRef) return res.status(400).json({ success: false, error: 'Vui lòng nhập mã giao dịch hoàn tiền' });
      if (deposit) {
        // Đơn đặt làm: được hoàn ít hơn số đã nhận (giữ chi phí thực tế) nhưng bắt buộc ghi lý do.
        const amount = req.body.amount === undefined ? order.refund.amount : Number(req.body.amount);
        if (!Number.isInteger(amount) || amount <= 0 || amount > (order.depositReceived || 0)) {
          return res.status(400).json({ success: false, error: 'Số tiền hoàn phải là số nguyên dương, không vượt số tiền cọc đã nhận (không hoàn đồng nào thì chọn "Không hoàn tiền" kèm lý do)' });
        }
        if (amount < (order.depositReceived || 0) && adminNote.length < 5) {
          return res.status(400).json({ success: false, error: 'Hoàn ít hơn số tiền đã nhận: vui lòng ghi rõ lý do giữ lại' });
        }
        order.refund.amount = amount;
        order.depositStatus = amount >= (order.depositReceived || 0) ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
      }
      Object.assign(order.refund, { status: 'COMPLETED', completedAt: new Date(), transactionRef, adminNote });
      order.paymentStatus = 'REFUNDED';
    } else if (action === 'void') {
      if (!adminNote) return res.status(400).json({ success: false, error: 'Vui lòng ghi lý do không hoàn tiền' });
      Object.assign(order.refund, { status: 'VOID', completedAt: new Date(), adminNote });
    } else {
      return res.status(400).json({ success: false, error: 'Thao tác không hợp lệ' });
    }
    await order.save();
    if (deposit) {
      const actor = await Admin.findById(req.adminId);
      await writeAudit(req, actor, {
        module: 'Đặt Làm',
        action: action === 'complete' ? 'Hoàn tiền cọc' : 'Không hoàn tiền cọc',
        detail: `${order.orderNumber}: ${action === 'complete' ? `${order.refund.amount}đ / đã nhận ${order.depositReceived}đ, mã GD ${transactionRef}` : ''}${adminNote ? ` — ${adminNote}` : ''}`,
        level: 'WARNING',
      });
    }
    res.json({ success: true, order });
  } catch (err) {
    sendError(res, err);
  }
});

// ------------------------------------------------------------------ Tiền cọc đơn đặt làm

/** Chuyển đơn sang sản xuất (đã kiểm tra điều kiện trước): ghi thời điểm, người bắt đầu, nhật ký. */
async function startProduction(req, order) {
  order.status = 'IN_PRODUCTION';
  order.productionStartedAt = new Date();
  order.productionStartedBy = req.adminId;
  if (!order.productionProgress) {
    order.productionProgress = {
      currentStep: 'FILE_PREPARATION',
      percentage: 15,
      stepTitle: 'Tiếp nhận đơn & chuẩn bị file sản xuất',
      notes: '',
      updatedAt: nowLabel(),
    };
  }
  const actor = await Admin.findById(req.adminId);
  if (actor) {
    await writeAudit(req, actor, {
      module: 'Đơn Hàng', action: 'Bắt đầu sản xuất',
      detail: `${order.orderNumber}${isDepositOrder(order) ? ` (cọc đã nhận ${order.depositReceived}đ / ${order.paymentPlan.depositAmount}đ)` : ''}`,
      level: 'INFO',
    });
  }
}

const parseMoney = (v) => (v === undefined || v === null || v === '' ? NaN : Number(v));

/** Tải đơn cọc + kiểm tra hết hạn theo giờ server trước khi thao tác. */
async function loadDepositOrder(orderNumber) {
  const order = await Order.findOne({ orderNumber });
  if (!order || !isDepositOrder(order)) return null;
  return settleDepositExpiry(order);
}

// Khách báo đã chuyển khoản cọc: chỉ ghi nhận "chờ đối soát", KHÔNG coi là đã nhận tiền.
// Chặn báo liên tục: chỉ 1 khoản chờ đối soát tại một thời điểm, tối đa N lần báo / đơn, phải còn hạn.
router.post('/:orderNumber/deposit/report', requireUserId, async (req, res) => {
  try {
    const amount = parseMoney(req.body.amount);
    const note = String(req.body.note || '').trim().slice(0, 300);
    if (!Number.isInteger(amount) || amount <= 0) return res.status(400).json({ success: false, error: 'Vui lòng nhập số tiền đã chuyển' });
    const order = await loadDepositOrder(req.params.orderNumber);
    if (!order || String(order.userId) !== String(req.userId)) return res.status(404).json({ success: false, error: 'Không tìm thấy đơn hàng' });
    if (order.status === 'CANCELLED') return res.status(400).json({ success: false, error: 'Đơn đã huỷ (quá hạn cọc hoặc do yêu cầu huỷ)' });
    if (order.depositStatus === 'VERIFYING') return res.status(409).json({ success: false, error: 'Bạn đã báo chuyển khoản, shop đang đối soát. Vui lòng chờ kết quả.' });
    if (order.depositStatus !== 'UNPAID') return res.status(400).json({ success: false, error: 'Đơn không còn chờ thanh toán cọc' });

    const now = new Date();
    const claimed = await Order.findOneAndUpdate(
      {
        orderNumber: order.orderNumber,
        status: 'PENDING',
        depositStatus: 'UNPAID',
        'paymentPlan.deadlineAt': { $gt: now },
        'paymentPlan.customerReportCount': { $lt: MAX_CUSTOMER_REPORTS },
      },
      {
        $set: { depositStatus: 'VERIFYING', 'paymentPlan.verifySlaAt': new Date(now.getTime() + VERIFY_SLA_HOURS * 3600000) },
        $inc: { 'paymentPlan.customerReportCount': 1 },
      },
      { new: true }
    );
    if (!claimed) {
      const fresh = await Order.findOne({ orderNumber: order.orderNumber }).lean();
      const msg = (fresh?.paymentPlan?.customerReportCount || 0) >= MAX_CUSTOMER_REPORTS
        ? 'Bạn đã báo chuyển khoản quá số lần cho phép, vui lòng liên hệ hỗ trợ'
        : 'Đã quá hạn thanh toán cọc của đơn này';
      return res.status(400).json({ success: false, error: msg });
    }
    try {
      await PaymentTransaction.create({
        orderNumber: order.orderNumber, purpose: 'DEPOSIT', status: 'REPORTED', source: 'CUSTOMER',
        reportedAmount: amount, reportedNote: note, reportedAt: now, reporterUserId: String(req.userId),
      });
    } finally {
      await refreshDepositState(order.orderNumber); // tạo giao dịch lỗi -> tự quay về UNPAID
    }
    const updated = await Order.findOne({ orderNumber: order.orderNumber });
    res.json({ success: true, order: updated, payment: paymentInstructions(updated) });
  } catch (err) {
    sendError(res, err);
  }
});

// Sổ giao dịch cọc của 1 đơn: nhân viên xem đầy đủ; chủ đơn xem trạng thái các lần báo của mình.
router.get('/:orderNumber/deposit', attachUserId, async (req, res) => {
  try {
    const order = await loadDepositOrder(req.params.orderNumber);
    const adminId = await adminIdFromRequest(req);
    const isStaff = !!adminId && await adminHasPermission(adminId, 'orders.view');
    if (!order || (!isStaff && String(order.userId) !== String(req.userId || ''))) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy đơn hàng' });
    }
    const transactions = await PaymentTransaction.find({ orderNumber: order.orderNumber }).sort({ createdAt: 1 });
    res.json({ success: true, order, transactions, payment: paymentInstructions(order) });
  } catch (err) {
    sendError(res, err);
  }
});

function readVerification(body) {
  const receivedAmount = parseMoney(body.receivedAmount);
  const bankTxnRef = PaymentTransaction.normalizeRef(body.bankTxnRef);
  const receivedAt = body.receivedAt ? new Date(body.receivedAt) : new Date();
  if (!Number.isInteger(receivedAmount) || receivedAmount <= 0) return { error: 'Số tiền thực nhận phải là số nguyên dương' };
  if (bankTxnRef.length < 4) return { error: 'Vui lòng nhập mã giao dịch trên sao kê ngân hàng' };
  if (Number.isNaN(receivedAt.getTime()) || receivedAt.getTime() > Date.now() + 5 * 60000) return { error: 'Thời điểm nhận tiền không hợp lệ' };
  return { receivedAmount, bankTxnRef, receivedAt, staffNote: String(body.note || '').trim().slice(0, 300) };
}

const duplicateRefError = { success: false, error: 'Mã giao dịch ngân hàng này đã được xác nhận cho một khoản khác' };

// Nhân viên xác nhận 1 khoản khách báo: ghi số tiền THỰC NHẬN theo sao kê + mã giao dịch.
// Chỉ khoản đang REPORTED mới xác nhận được (bấm 2 lần / 2 người cùng lúc chỉ 1 lần thành công).
router.patch('/:orderNumber/deposit/transactions/:txnId/confirm', requirePermission('orders.approve'), async (req, res) => {
  try {
    const v = readVerification(req.body);
    if (v.error) return res.status(400).json({ success: false, error: v.error });
    const id = validId(req.params.txnId);
    if (!id) return res.status(404).json({ success: false, error: 'Không tìm thấy giao dịch' });
    const actor = await Admin.findById(req.adminId);
    let txn;
    try {
      txn = await PaymentTransaction.findOneAndUpdate(
        { _id: id, orderNumber: req.params.orderNumber, status: 'REPORTED' },
        {
          $set: {
            status: 'CONFIRMED', receivedAmount: v.receivedAmount, bankTxnRef: v.bankTxnRef, receivedAt: v.receivedAt,
            staffNote: v.staffNote, verifiedBy: req.adminId, verifiedByName: actor?.fullName || actor?.username || '', verifiedAt: new Date(),
          },
        },
        { new: true }
      );
    } catch (err) {
      if (err.code === 11000) return res.status(409).json(duplicateRefError);
      throw err;
    }
    if (!txn) return res.status(409).json({ success: false, error: 'Giao dịch không còn ở trạng thái chờ đối soát (có thể đã được xử lý)' });
    const order = await afterLedgerChange(req.params.orderNumber);
    await writeAudit(req, actor, {
      module: 'Đặt Làm', action: 'Xác nhận tiền cọc',
      detail: `${req.params.orderNumber}: nhận ${v.receivedAmount}đ (khách báo ${txn.reportedAmount}đ), mã GD ${v.bankTxnRef}. Tổng đã nhận ${order.depositReceived}đ / cọc ${order.paymentPlan.depositAmount}đ → ${order.depositStatus}`,
      level: 'SUCCESS',
    });
    res.json({ success: true, order, transaction: txn });
  } catch (err) {
    sendError(res, err);
  }
});

// Nhân viên từ chối 1 khoản khách báo (không thấy tiền, sai nội dung...) — bắt buộc lý do, không xoá lịch sử.
router.patch('/:orderNumber/deposit/transactions/:txnId/reject', requirePermission('orders.approve'), async (req, res) => {
  try {
    const reason = String(req.body.reason || '').trim().slice(0, 300);
    if (reason.length < 5) return res.status(400).json({ success: false, error: 'Vui lòng ghi lý do từ chối (ít nhất 5 ký tự)' });
    const id = validId(req.params.txnId);
    if (!id) return res.status(404).json({ success: false, error: 'Không tìm thấy giao dịch' });
    const actor = await Admin.findById(req.adminId);
    const txn = await PaymentTransaction.findOneAndUpdate(
      { _id: id, orderNumber: req.params.orderNumber, status: 'REPORTED' },
      { $set: { status: 'REJECTED', rejectReason: reason, verifiedBy: req.adminId, verifiedByName: actor?.fullName || actor?.username || '', verifiedAt: new Date() } },
      { new: true }
    );
    if (!txn) return res.status(409).json({ success: false, error: 'Giao dịch không còn ở trạng thái chờ đối soát (có thể đã được xử lý)' });
    const order = await afterLedgerChange(req.params.orderNumber);
    await writeAudit(req, actor, {
      module: 'Đặt Làm', action: 'Từ chối khoản báo chuyển cọc',
      detail: `${req.params.orderNumber}: khách báo ${txn.reportedAmount}đ — ${reason}. Hạn cọc mới: ${order.paymentPlan.deadlineAt?.toISOString() || ''}`,
      level: 'WARNING',
    });
    res.json({ success: true, order, transaction: txn });
  } catch (err) {
    sendError(res, err);
  }
});

// Nhân viên ghi nhận trực tiếp 1 khoản tiền đã về (khách chuyển mà không báo). Cùng kiểm tra trùng mã GD.
router.post('/:orderNumber/deposit/transactions', requirePermission('orders.approve'), async (req, res) => {
  try {
    const v = readVerification(req.body);
    if (v.error) return res.status(400).json({ success: false, error: v.error });
    const existing = await Order.findOne({ orderNumber: req.params.orderNumber });
    if (!existing || !isDepositOrder(existing)) return res.status(404).json({ success: false, error: 'Không tìm thấy đơn đặt làm' });
    if (['REFUNDED', 'PARTIALLY_REFUNDED'].includes(existing.depositStatus)) {
      return res.status(400).json({ success: false, error: 'Đơn đã hoàn tiền xong, không ghi thêm khoản cọc' });
    }
    const actor = await Admin.findById(req.adminId);
    let txn;
    try {
      txn = await PaymentTransaction.create({
        orderNumber: existing.orderNumber, purpose: 'DEPOSIT', status: 'CONFIRMED', source: 'STAFF',
        receivedAmount: v.receivedAmount, bankTxnRef: v.bankTxnRef, receivedAt: v.receivedAt, staffNote: v.staffNote,
        verifiedBy: req.adminId, verifiedByName: actor?.fullName || actor?.username || '', verifiedAt: new Date(),
      });
    } catch (err) {
      if (err.code === 11000) return res.status(409).json(duplicateRefError);
      throw err;
    }
    const order = await afterLedgerChange(existing.orderNumber);
    await writeAudit(req, actor, {
      module: 'Đặt Làm', action: 'Ghi nhận tiền cọc',
      detail: `${existing.orderNumber}: nhận ${v.receivedAmount}đ, mã GD ${v.bankTxnRef}. Tổng đã nhận ${order.depositReceived}đ / cọc ${order.paymentPlan.depositAmount}đ → ${order.depositStatus}`,
      level: 'SUCCESS',
    });
    res.json({ success: true, order, transaction: txn });
  } catch (err) {
    sendError(res, err);
  }
});

// Nhân viên gia hạn thời gian trả cọc (bắt buộc lý do, có giới hạn giờ, ghi nhật ký).
router.patch('/:orderNumber/deposit/extend', requirePermission('orders.approve'), async (req, res) => {
  try {
    const hours = Number(req.body.hours);
    const reason = String(req.body.reason || '').trim().slice(0, 300);
    if (!Number.isInteger(hours) || hours < 1 || hours > MAX_STAFF_EXTENSION_HOURS) {
      return res.status(400).json({ success: false, error: `Số giờ gia hạn phải là số nguyên từ 1 đến ${MAX_STAFF_EXTENSION_HOURS}` });
    }
    if (reason.length < 5) return res.status(400).json({ success: false, error: 'Vui lòng ghi lý do gia hạn (ít nhất 5 ký tự)' });
    const order = await Order.findOne({ orderNumber: req.params.orderNumber });
    if (!order || !isDepositOrder(order)) return res.status(404).json({ success: false, error: 'Không tìm thấy đơn đặt làm' });
    // Gia hạn trước khi xét hết hạn: nhân viên chủ động giữ đơn cho khách.
    if (order.status !== 'PENDING' || !['UNPAID', 'VERIFYING'].includes(order.depositStatus)) {
      return res.status(400).json({ success: false, error: 'Chỉ gia hạn được đơn đang chờ thanh toán cọc' });
    }
    const now = new Date();
    const previous = order.paymentPlan.deadlineAt;
    const base = previous && previous.getTime() > now.getTime() ? previous.getTime() : now.getTime();
    const actor = await Admin.findById(req.adminId);
    order.paymentPlan.deadlineAt = new Date(base + hours * 3600000);
    order.paymentPlan.extensions.push({ hours, reason, byName: actor?.fullName || actor?.username || '', at: now, previousDeadline: previous });
    order.paymentPlan.expiredWithFunds = false;
    await order.save();
    await writeAudit(req, actor, {
      module: 'Đặt Làm', action: 'Gia hạn trả cọc',
      detail: `${order.orderNumber}: +${hours}h (${previous?.toISOString() || '—'} → ${order.paymentPlan.deadlineAt.toISOString()}) — ${reason}`,
      level: 'WARNING',
    });
    res.json({ success: true, order });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
