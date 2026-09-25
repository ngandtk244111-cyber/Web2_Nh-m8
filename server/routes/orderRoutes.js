const express = require('express');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { attachUserId, requireUserId, requireAdminId } = require('../middleware/auth');
const { awardCoins } = require('../utils/coins');
const { verifyAndPriceOrderItems, resolveDiscount, resolveShippingFee } = require('../utils/pricing');
const { shippingOptions, findCarrier, trackingUrlFor, isDevMode, devTrackingCode } = require('../utils/shipping');

const DELIVERY_REWARD_RATE = 0.01; // 1% giá trị đơn hàng, quy đổi thẳng sang Xu (1 xu = 1đ khi giảm giá)

const router = express.Router();

function generateOrderNumber() {
  return 'ORD-' + Math.floor(100000 + Math.random() * 900000);
}

function nowLabel() {
  const now = new Date();
  return now.toLocaleDateString('vi-VN') + ' ' + now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

// Admin: danh sách toàn bộ đơn hàng của mọi khách — chỉ my-admin (dashboard tab "Đơn Hàng") gọi,
// không phải endpoint công khai (khách tự tra đơn dùng /mine hoặc /by-number/:orderNumber).
router.get('/', requireAdminId, async (_req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', attachUserId, async (req, res) => {
  try {
    const { items, shippingAddress, paymentMethod, couponCode, notes } = req.body;

    if (!Array.isArray(items) || items.length === 0 || !shippingAddress || !paymentMethod) {
      return res.status(400).json({ success: false, error: 'Thiếu thông tin đơn hàng' });
    }

    // Bảo mật giá: tính lại toàn bộ đơn từ sản phẩm THẬT trong DB, không tin subtotal/discount/
    // shippingFee/total mà client gửi lên (trước đây tin thẳng, có thể sửa qua DevTools).
    let pricedItems, subtotal;
    try {
      ({ pricedItems, subtotal } = await verifyAndPriceOrderItems(items, Product));
    } catch (priceErr) {
      return res.status(400).json({ success: false, error: priceErr.message });
    }

    const discount = resolveDiscount(subtotal, couponCode);
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

    const order = await Order.create({
      orderNumber: generateOrderNumber(),
      userId: req.userId || null,
      createdAtLabel: nowLabel(),
      // COD: chờ nhân viên gọi xác nhận (PENDING) rồi mới sản xuất/giao — tránh in đồ khắc tên
      // riêng cho đơn ảo. Đơn trả trước (chuyển khoản, ví) vào thẳng sản xuất/xác nhận.
      status: paymentMethod === 'COD' ? 'PENDING' : hasPOD ? 'IN_PRODUCTION' : 'CONFIRMED',
      hasPrintOnDemandItems: hasPOD,
      productionProgress,
      items: pricedItems,
      shippingAddress,
      paymentMethod,
      paymentStatus: 'UNPAID',
      subtotal,
      discount,
      shippingFee,
      total,
      notes: notes || '',
    });

    res.json({ success: true, order });
  } catch (err) {
    console.error('create order error', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/by-number/:orderNumber', async (req, res) => {
  try {
    const order = await Order.findOne({ orderNumber: req.params.orderNumber });
    if (!order) return res.status(404).json({ success: false, error: 'Không tìm thấy đơn hàng' });
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Order history for a logged-in user (used by the account page).
router.get('/mine', requireUserId, async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Khách bấm "Tôi đã chuyển khoản" ở trang checkout: chỉ GHI NHẬN là khách báo đã chuyển, không tự
// đánh dấu PAID — trước đây khách bấm là thành "Đã thanh toán" dù tiền chưa về. Nhân viên đối soát
// sao kê rồi xác nhận ở my-admin (PATCH /payment-status).
router.patch('/:orderNumber/confirm-payment', async (req, res) => {
  try {
    const order = await Order.findOneAndUpdate(
      { orderNumber: req.params.orderNumber, paymentStatus: { $ne: 'PAID' } },
      { transferReportedAt: new Date() },
      { new: true }
    ) || await Order.findOne({ orderNumber: req.params.orderNumber });
    if (!order) return res.status(404).json({ success: false, error: 'Không tìm thấy đơn hàng' });
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin: xác nhận đã nhận tiền (đối soát chuyển khoản / đã thu COD) hoặc hoàn tác.
// MoMo/ZaloPay tự cập nhật qua IPN có chữ ký ở paymentRoutes.js, không đi qua route này.
router.patch('/:orderNumber/payment-status', requireAdminId, async (req, res) => {
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
    res.status(500).json({ success: false, error: err.message });
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
  // Đơn đã hoàn thành / huỷ / hoàn hàng thì khoá, tránh bấm nhầm làm sai lịch sử và thưởng Xu.
  if (FINAL_STATUSES.includes(order.status)) {
    res.status(400).json({ success: false, error: 'Đơn đã kết thúc (hoàn thành / huỷ / hoàn hàng), không thể cập nhật thêm' });
    return null;
  }
  return order;
}

// Admin: gọi điện xác nhận đơn với khách — bắt buộc trước khi giao đơn COD.
router.patch('/:orderNumber/confirm-phone', requireAdminId, async (req, res) => {
  try {
    const order = await loadOpenOrder(req, res);
    if (!order) return;
    order.phoneConfirmedAt = new Date();
    order.phoneConfirmedBy = req.adminId;
    if (order.status === 'PENDING') order.status = order.hasPrintOnDemandItems ? 'IN_PRODUCTION' : 'CONFIRMED';
    await order.save();
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin: hãng vận chuyển phù hợp cho đơn (hàng cồng kềnh? nội thành hay liên tỉnh?).
router.get('/:orderNumber/shipping-options', requireAdminId, async (req, res) => {
  try {
    const order = await Order.findOne({ orderNumber: req.params.orderNumber }).lean();
    if (!order) return res.status(404).json({ success: false, error: 'Không tìm thấy đơn hàng' });
    res.json({ success: true, devMode: isDevMode(), ...shippingOptions(order) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin: tạo vận đơn với hãng vận chuyển và chuyển đơn sang "Đang giao".
router.patch('/:orderNumber/ship', requireAdminId, async (req, res) => {
  try {
    const order = await loadOpenOrder(req, res);
    if (!order) return;
    if (order.status === 'SHIPPED') return res.status(400).json({ success: false, error: 'Đơn đang được giao rồi' });
    if (order.paymentMethod === 'COD' && !order.phoneConfirmedAt) {
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
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin: cập nhật tiến độ sản xuất / kết quả giao (thành công, hoàn hàng) / huỷ.
router.patch('/:orderNumber/production', requireAdminId, async (req, res) => {
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
    if (status === 'CANCELLED') Object.assign(order, { cancelReason: String(cancelReason).trim(), cancelledAt: new Date() });
    if (status === 'RETURNED') Object.assign(order, { returnReason: String(returnReason).trim(), returnedAt: new Date() });
    if (status === 'DELIVERED') {
      order.deliveredAt = new Date();
      // COD: shipper đã thu tiền, còn chờ đối soát với hãng mới tính là đã thanh toán.
      if (order.paymentMethod === 'COD') order.codCollectedAt = new Date();
    }
    await order.save();

    // Đơn giao thành công -> thưởng Xu 1 lần cho khách (chỉ áp dụng nếu đơn gắn với tài khoản thật).
    if (order.status === 'DELIVERED' && order.userId) {
      await awardCoins({
        userId: order.userId,
        reason: 'ORDER_DELIVERED',
        refId: order.orderNumber,
        amount: Math.round(order.total * DELIVERY_REWARD_RATE),
        note: `Nhận thưởng từ đơn hàng ${order.orderNumber} đã giao thành công`,
      });
    }

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
