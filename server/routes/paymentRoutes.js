const express = require('express');
const { sendError } = require('../utils/http-error');
const Order = require('../models/Order');
const { createMomoPayment, verifyMomoIpnSignature } = require('../utils/momo');
const { createZaloPayOrder, verifyZaloPayCallbackMac, verifyZaloPayRedirectChecksum } = require('../utils/zalopay');
const { releaseCodesForOrder } = require('../utils/vouchers');

/**
 * Không tạo được giao dịch ở cổng thanh toán: đơn vừa tạo chưa trả tiền -> huỷ luôn và trả lại mã
 * giảm giá, để khách đặt lại (chọn phương thức khác) vẫn dùng được mã đó.
 */
async function cancelUnpaidOrder(orderNumber, gateway) {
  const order = await Order.findOneAndUpdate(
    { orderNumber, paymentStatus: { $ne: 'PAID' }, status: { $ne: 'CANCELLED' } },
    { status: 'CANCELLED', cancelReason: `Không tạo được thanh toán ${gateway}`, cancelledAt: new Date() },
    { new: true }
  );
  if (order) await releaseCodesForOrder(orderNumber);
}

const router = express.Router();

/**
 * Cổng thanh toán thử (chỉ khi chạy dev): tài khoản sandbox MoMo dùng chung hay bị MoMo khoá
 * (resultCode 13) -> thay vì báo lỗi, chuyển khách sang trang /thanh-toan-thu của shop để mô phỏng
 * bước thanh toán và hoàn tất đơn. Tắt bằng PAYMENT_SANDBOX=false; luôn tắt khi NODE_ENV=production.
 */
function paymentSandboxEnabled() {
  return process.env.NODE_ENV !== 'production' && process.env.PAYMENT_SANDBOX !== 'false';
}

function clientOrigin() {
  try {
    return new URL(process.env.MOMO_REDIRECT_URL || process.env.ZALOPAY_REDIRECT_URL).origin;
  } catch {
    return 'http://localhost:4200';
  }
}

function sandboxPayUrl(orderNumber, method) {
  return `${clientOrigin()}/thanh-toan-thu?orderNumber=${encodeURIComponent(orderNumber)}&method=${method}`;
}

const ONLINE_METHODS = ['MOMO', 'ATM', 'ZALOPAY'];

/** Đánh dấu đơn đã thanh toán (bỏ qua nếu đã PAID / đã huỷ hoặc số tiền không khớp). */
async function markPaid(filter, transactionId) {
  return Order.findOneAndUpdate(
    { ...filter, paymentStatus: { $ne: 'PAID' }, status: { $ne: 'CANCELLED' } },
    { paymentStatus: 'PAID', paymentTransactionId: String(transactionId || '') },
    { new: true }
  );
}

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
    if (paymentSandboxEnabled() && req.body.orderNumber) {
      const method = req.body.paymentMethod === 'atm' ? 'atm' : 'momo';
      return res.json({ success: true, sandbox: true, payUrl: sandboxPayUrl(req.body.orderNumber, method) });
    }
    await cancelUnpaidOrder(req.body.orderNumber, 'MoMo').catch(() => {});
    // MoMo trả lỗi nghiệp vụ (sai cấu hình merchant, số tiền ngoài hạn mức...) -> báo rõ cho khách thay vì "status code 400".
    if (err.response?.data?.resultCode != null) {
      return res.status(502).json({
        success: false,
        error: `Cổng MoMo đang từ chối giao dịch (mã ${err.response.data.resultCode}). Vui lòng chọn ZaloPay, chuyển khoản hoặc COD.`,
      });
    }
    // Cổng không phản hồi / chặn kết nối (403, hết hạn chờ...) -> thông báo dễ hiểu thay vì lỗi kỹ thuật.
    res.status(502).json({ success: false, error: 'Cổng MoMo đang tạm thời không phản hồi. Vui lòng chọn ZaloPay, chuyển khoản hoặc COD.' });
  }
});

router.post('/momo/ipn', async (req, res) => {
  try {
    if (!verifyMomoIpnSignature(req.body)) {
      return res.status(400).json({ success: false, error: 'Chữ ký không hợp lệ' });
    }
    const { orderId, resultCode, transId, amount } = req.body;
    const paid = Number(resultCode) === 0;
    // Chỉ nhận PAID khi số tiền khớp tổng đơn; IPN thất bại đến sau không được ghi đè đơn đã PAID.
    await Order.findOneAndUpdate(
      paid
        ? { orderNumber: orderId, total: Number(amount) }
        : { orderNumber: orderId, paymentStatus: { $ne: 'PAID' } },
      { paymentStatus: paid ? 'PAID' : 'FAILED', paymentTransactionId: String(transId) }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('momo/ipn error', err);
    sendError(res, err);
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

    if (!result.order_url) {
      const e = new Error(result.return_message || result.sub_return_message || 'ZaloPay không tạo được đơn');
      e.response = { data: result };
      throw e;
    }

    // Lưu app_trans_id để đối chiếu ở callback (ZaloPay không trả lại orderNumber của mình).
    order.paymentTransactionId = result.app_trans_id || '';
    await order.save();

    res.json({ success: true, orderUrl: result.order_url, raw: result });
  } catch (err) {
    console.error('zalopay/create error', err.response?.data || err.message);
    if (paymentSandboxEnabled() && req.body.orderNumber) {
      return res.json({ success: true, sandbox: true, orderUrl: sandboxPayUrl(req.body.orderNumber, 'zalopay') });
    }
    await cancelUnpaidOrder(req.body.orderNumber, 'ZaloPay').catch(() => {});
    res.status(502).json({ success: false, error: 'Cổng ZaloPay đang tạm thời không phản hồi. Vui lòng chọn MoMo, chuyển khoản hoặc COD.' });
  }
});

// Khách quay về từ MoMo: callback IPN không gọi được về localhost nên xác minh chữ ký trên redirect URL
// (cùng bộ trường với IPN) rồi ghi nhận thanh toán. Số tiền phải khớp tổng đơn.
router.post('/momo/verify-return', async (req, res) => {
  try {
    const q = req.body || {};
    if (!verifyMomoIpnSignature(q)) return res.status(400).json({ success: false, error: 'Chữ ký MoMo không hợp lệ' });
    let paid = false;
    if (Number(q.resultCode) === 0) {
      paid = !!(await markPaid({ orderNumber: q.orderId, total: Number(q.amount) }, q.transId));
    }
    const order = await Order.findOne({ orderNumber: q.orderId }).lean();
    res.json({ success: true, orderNumber: q.orderId, paid: order?.paymentStatus === 'PAID' || paid });
  } catch (err) {
    sendError(res, err);
  }
});

// Khách quay về từ ZaloPay: xác minh checksum trên redirect URL, tìm đơn theo app_trans_id đã lưu.
router.post('/zalopay/verify-return', async (req, res) => {
  try {
    const q = req.body || {};
    if (!verifyZaloPayRedirectChecksum(q)) return res.status(400).json({ success: false, error: 'Checksum ZaloPay không hợp lệ' });
    const order = await Order.findOne({ paymentTransactionId: q.apptransid }).lean();
    if (!order) return res.status(404).json({ success: false, error: 'Không tìm thấy đơn hàng' });
    if (String(q.status) === '1') await markPaid({ orderNumber: order.orderNumber, total: Number(q.amount) }, q.apptransid);
    const fresh = await Order.findOne({ orderNumber: order.orderNumber }).lean();
    res.json({ success: true, orderNumber: order.orderNumber, paid: fresh.paymentStatus === 'PAID' });
  } catch (err) {
    sendError(res, err);
  }
});

// Cổng thanh toán thử: khách bấm "Xác nhận thanh toán" / "Huỷ giao dịch" trên trang /thanh-toan-thu.
router.post('/sandbox/confirm', async (req, res) => {
  try {
    if (!paymentSandboxEnabled()) return res.status(403).json({ success: false, error: 'Cổng thanh toán thử đang tắt' });
    const { orderNumber, action } = req.body;
    const order = await Order.findOne({ orderNumber });
    if (!order) return res.status(404).json({ success: false, error: 'Không tìm thấy đơn hàng' });
    if (!ONLINE_METHODS.includes(order.paymentMethod)) {
      return res.status(400).json({ success: false, error: 'Đơn này không thanh toán online' });
    }
    // Huỷ giao dịch ở cổng (như khách bấm huỷ trên MoMo/ZaloPay thật): đơn giữ nguyên, chưa thanh toán —
    // khách có thể chọn phương thức khác cho đơn này.
    if (action === 'cancel') return res.json({ success: true, paid: false });
    if (order.status === 'CANCELLED') return res.status(400).json({ success: false, error: 'Đơn hàng đã bị huỷ' });
    await markPaid({ orderNumber }, `SANDBOX-${Date.now()}`);
    res.json({ success: true, paid: true });
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/zalopay/callback', async (req, res) => {
  try {
    const { data: dataStr, mac } = req.body;
    if (!verifyZaloPayCallbackMac(dataStr, mac)) {
      return res.json({ return_code: -1, return_message: 'mac not equal' });
    }

    // Như IPN MoMo: chỉ ghi PAID khi số tiền khớp tổng đơn, bỏ qua đơn đã huỷ / đã PAID.
    const data = JSON.parse(dataStr);
    await markPaid({ paymentTransactionId: data.app_trans_id, total: Number(data.amount) }, data.app_trans_id);

    res.json({ return_code: 1, return_message: 'success' });
  } catch (err) {
    console.error('zalopay/callback error', err);
    res.json({ return_code: 0, return_message: err.message });
  }
});

module.exports = router;
