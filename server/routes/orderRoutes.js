const express = require('express');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { attachUserId, requireUserId, requireAdminId } = require('../middleware/auth');
const { awardCoins } = require('../utils/coins');
const { verifyAndPriceOrderItems, resolveDiscount, resolveShippingFee } = require('../utils/pricing');

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
      status: hasPOD ? 'IN_PRODUCTION' : 'CONFIRMED',
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

router.patch('/:orderNumber/confirm-payment', async (req, res) => {
  try {
    const order = await Order.findOneAndUpdate(
      { orderNumber: req.params.orderNumber },
      { paymentStatus: 'PAID' },
      { new: true }
    );
    if (!order) return res.status(404).json({ success: false, error: 'Không tìm thấy đơn hàng' });
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/:orderNumber/payment-status', async (req, res) => {
  try {
    const { paymentStatus, paymentTransactionId } = req.body;
    const order = await Order.findOneAndUpdate(
      { orderNumber: req.params.orderNumber },
      { paymentStatus, ...(paymentTransactionId ? { paymentTransactionId } : {}) },
      { new: true }
    );
    if (!order) return res.status(404).json({ success: false, error: 'Không tìm thấy đơn hàng' });
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin: advance production step / update overall status.
router.patch('/:orderNumber/production', requireAdminId, async (req, res) => {
  try {
    const { status, productionProgress } = req.body;
    const update = {};
    if (status) update.status = status;
    if (productionProgress) update.productionProgress = productionProgress;

    const order = await Order.findOneAndUpdate(
      { orderNumber: req.params.orderNumber },
      update,
      { new: true }
    );
    if (!order) return res.status(404).json({ success: false, error: 'Không tìm thấy đơn hàng' });

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
