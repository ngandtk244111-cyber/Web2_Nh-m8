const express = require('express');
const Order = require('../models/Order');
const { createMomoPayment, verifyMomoIpnSignature } = require('../utils/momo');
const { createZaloPayOrder, verifyZaloPayCallbackMac } = require('../utils/zalopay');

const router = express.Router();

router.post('/momo/create', async (req, res) => {
  try {
    const { orderNumber, paymentMethod = 'momo' } = req.body;
    if (!['momo', 'atm'].includes(paymentMethod)) {
      return res.status(400).json({ success: false, error: 'Phương thức thanh toán không hợp lệ' });
    }

    const order = await Order.findOne({ orderNumber });
    if (!order) return res.status(404).json({ success: false, error: 'Không tìm thấy đơn hàng' });

    // Bảo mật giá: lấy amount từ đơn hàng đã lưu ở server, không tin số tiền client gửi lên.
    const result = await createMomoPayment({
      orderId: order.orderNumber,
      amount: order.total,
      orderInfo: `Thanh toan don hang Luméa ${order.orderNumber}`,
      requestType: paymentMethod === 'atm' ? 'payWithATM' : 'captureWallet',
    });

    res.json({ success: true, payUrl: result.payUrl, raw: result });
  } catch (err) {
    console.error('momo/create error', err.response?.data || err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/momo/ipn', async (req, res) => {
  try {
    if (!verifyMomoIpnSignature(req.body)) {
      return res.status(400).json({ success: false, error: 'Chữ ký không hợp lệ' });
    }
    const { orderId, resultCode, transId } = req.body;
    await Order.findOneAndUpdate(
      { orderNumber: orderId },
      { paymentStatus: Number(resultCode) === 0 ? 'PAID' : 'FAILED', paymentTransactionId: String(transId) }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('momo/ipn error', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/zalopay/create', async (req, res) => {
  try {
    const { orderNumber } = req.body;
    const order = await Order.findOne({ orderNumber });
    if (!order) return res.status(404).json({ success: false, error: 'Không tìm thấy đơn hàng' });

    const result = await createZaloPayOrder({
      orderId: order.orderNumber,
      amount: order.total,
      description: `Thanh toan don hang Luméa ${order.orderNumber}`,
    });

    // Lưu app_trans_id để đối chiếu ở callback (ZaloPay không trả lại orderNumber của mình).
    order.paymentTransactionId = result.app_trans_id || '';
    await order.save();

    res.json({ success: true, orderUrl: result.order_url, raw: result });
  } catch (err) {
    console.error('zalopay/create error', err.response?.data || err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/zalopay/callback', async (req, res) => {
  try {
    const { data: dataStr, mac } = req.body;
    if (!verifyZaloPayCallbackMac(dataStr, mac)) {
      return res.json({ return_code: -1, return_message: 'mac not equal' });
    }

    const data = JSON.parse(dataStr);
    await Order.findOneAndUpdate(
      { paymentTransactionId: data.app_trans_id },
      { paymentStatus: 'PAID' }
    );

    res.json({ return_code: 1, return_message: 'success' });
  } catch (err) {
    console.error('zalopay/callback error', err);
    res.json({ return_code: 0, return_message: err.message });
  }
});

module.exports = router;
