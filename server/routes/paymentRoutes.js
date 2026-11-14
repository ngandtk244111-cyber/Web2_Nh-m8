const express = require('express');
const { sendError } = require('../utils/http-error');
const Order = require('../models/Order');
const { createMomoPayment, verifyMomoIpnSignature } = require('../utils/momo');
const { createZaloPayOrder, verifyZaloPayCallbackMac, verifyZaloPayRedirectChecksum } = require('../utils/zalopay');
const { releaseCodesForOrder } = require('../utils/vouchers');
const { requireUserId } = require('../middleware/auth');
const {
  settleDepositExpiry, depositGatewayCheck, startGatewayDeposit, confirmGatewayDeposit, failGatewayDeposit,
} = require('../utils/custom-order');
const PaymentTransaction = require('../models/PaymentTransaction');

/** Cổng đang trỏ môi trường thử của MoMo / ZaloPay -> giao dịch không phải tiền thật. */
const isTestGateway = (endpoint) => /test-payment|sandbox|sb-openapi/i.test(String(endpoint || ''));

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
    if (order.orderType === 'CUSTOM_QUOTE') {
      return res.status(400).json({ success: false, error: 'Đơn đặt làm theo báo giá thanh toán cọc bằng chuyển khoản tại trang đơn hàng' });
    }

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

// ------------------------------------------------------------------ Trả cọc đơn đặt làm qua cổng
// Khách (chủ đơn) trả phần cọc còn thiếu qua MoMo / thẻ ATM / ZaloPay. Số tiền do server tính; cổng báo
// thành công (IPN / callback có chữ ký, hoặc chữ ký trên URL quay về) thì hệ thống tự xác nhận cọc.
router.post('/deposit/create', requireUserId, async (req, res) => {
  try {
    const method = String(req.body.method || '');
    if (!['momo', 'atm', 'zalopay'].includes(method)) return res.status(400).json({ success: false, error: 'Phương thức thanh toán không hợp lệ' });
    let order = await Order.findOne({ orderNumber: req.body.orderNumber });
    if (!order || String(order.userId) !== String(req.userId)) return res.status(404).json({ success: false, error: 'Không tìm thấy đơn hàng' });
    order = await settleDepositExpiry(order);
    const check = depositGatewayCheck(order);
    if (check.error) return res.status(check.status).json({ success: false, error: check.error });

    const gateway = method === 'zalopay' ? 'ZALOPAY' : method.toUpperCase();
    const info = `Coc don dat lam Lumea ${order.orderNumber}`;
    try {
      if (gateway === 'ZALOPAY') {
        const result = await createZaloPayOrder({ orderId: order.orderNumber, amount: check.due, description: info });
        if (!result.order_url) throw Object.assign(new Error(result.return_message || 'ZaloPay không tạo được đơn'), { response: { data: result } });
        await startGatewayDeposit({ order, gateway, gatewayRef: result.app_trans_id, amount: check.due, userId: req.userId, sandbox: isTestGateway(process.env.ZALOPAY_ENDPOINT) });
        return res.json({ success: true, orderUrl: result.order_url, amount: check.due });
      }
      // MoMo không nhận trùng orderId -> mỗi lượt trả cọc 1 mã riêng gắn với đơn.
      const gatewayRef = `${order.orderNumber}-C${Date.now().toString(36).toUpperCase()}`;
      await startGatewayDeposit({ order, gateway, gatewayRef, amount: check.due, userId: req.userId, sandbox: isTestGateway(process.env.MOMO_ENDPOINT) });
      try {
        const result = await createMomoPayment({
          orderId: gatewayRef, amount: check.due, orderInfo: info, requestType: gateway === 'ATM' ? 'payWithATM' : 'captureWallet',
        });
        if (!result.payUrl) throw Object.assign(new Error('MoMo không trả payUrl'), { response: { data: result } });
        return res.json({ success: true, payUrl: result.payUrl, amount: check.due });
      } catch (gatewayErr) {
        await failGatewayDeposit(gatewayRef, 'Không tạo được giao dịch ở cổng MoMo');
        throw gatewayErr;
      }
    } catch (err) {
      console.error('deposit/create gateway error', err.response?.data || err.message);
      // Chạy dev / demo: cổng sandbox lỗi -> trang thanh toán thử của shop (không thu tiền thật, giao dịch gắn cờ sandbox).
      if (paymentSandboxEnabled()) {
        const gatewayRef = `SBX-${order.orderNumber}-${Date.now().toString(36).toUpperCase()}`;
        await startGatewayDeposit({ order, gateway, gatewayRef, amount: check.due, userId: req.userId, sandbox: true });
        const url = `${sandboxPayUrl(order.orderNumber, method)}&deposit=${encodeURIComponent(gatewayRef)}`;
        return res.json({ success: true, sandbox: true, payUrl: url, orderUrl: url, amount: check.due });
      }
      // Không huỷ đơn: khách vẫn trả cọc bằng cách khác (cổng còn lại hoặc chuyển khoản).
      res.status(502).json({ success: false, error: 'Cổng thanh toán đang tạm thời không phản hồi. Vui lòng thử cổng khác hoặc chuyển khoản.' });
    }
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/momo/ipn', async (req, res) => {
  try {
    if (!verifyMomoIpnSignature(req.body)) {
      return res.status(400).json({ success: false, error: 'Chữ ký không hợp lệ' });
    }
    const { orderId, resultCode, transId, amount } = req.body;
    const paid = Number(resultCode) === 0;
    // Lượt trả cọc đơn đặt làm (orderId = mã lượt trả, không phải mã đơn).
    if (await PaymentTransaction.exists({ gatewayRef: orderId })) {
      if (paid) await confirmGatewayDeposit({ gatewayRef: orderId, amount, providerTxnId: transId });
      else await failGatewayDeposit(orderId, req.body.message);
      return res.json({ success: true });
    }
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
    if (order.orderType === 'CUSTOM_QUOTE') {
      return res.status(400).json({ success: false, error: 'Đơn đặt làm theo báo giá thanh toán cọc bằng chuyển khoản tại trang đơn hàng' });
    }

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
    const depositTxn = await PaymentTransaction.findOne({ gatewayRef: q.orderId }, { orderNumber: 1 }).lean();
    if (depositTxn) {
      const result = Number(q.resultCode) === 0
        ? await confirmGatewayDeposit({ gatewayRef: q.orderId, amount: q.amount, providerTxnId: q.transId })
        : (await failGatewayDeposit(q.orderId, q.message), null);
      return res.json({ success: true, deposit: true, orderNumber: depositTxn.orderNumber, paid: !!result?.confirmed });
    }
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
    const depositTxn = await PaymentTransaction.findOne({ gatewayRef: q.apptransid }, { orderNumber: 1 }).lean();
    if (depositTxn) {
      const result = String(q.status) === '1'
        ? await confirmGatewayDeposit({ gatewayRef: q.apptransid, amount: q.amount, providerTxnId: q.apptransid })
        : (await failGatewayDeposit(q.apptransid, 'Khách huỷ / giao dịch ZaloPay không thành công'), null);
      return res.json({ success: true, deposit: true, orderNumber: depositTxn.orderNumber, paid: !!result?.confirmed });
    }
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
    const { orderNumber, action, depositRef } = req.body;
    // Lượt trả cọc thử: chỉ nhận lượt do server tạo cho trang thử (mã SBX-, cờ sandbox), đúng đơn.
    if (depositRef) {
      const txn = await PaymentTransaction.findOne({ gatewayRef: String(depositRef), orderNumber, sandbox: true });
      if (!txn || !String(txn.gatewayRef).startsWith('SBX-')) return res.status(404).json({ success: false, error: 'Không tìm thấy lượt thanh toán cọc' });
      if (action === 'cancel') {
        await failGatewayDeposit(txn.gatewayRef, 'Khách huỷ giao dịch (cổng thử)');
        return res.json({ success: true, deposit: true, paid: false });
      }
      const result = await confirmGatewayDeposit({ gatewayRef: txn.gatewayRef, amount: txn.expectedAmount, providerTxnId: txn.gatewayRef, sandbox: true });
      return res.json({ success: true, deposit: true, paid: !!result?.confirmed });
    }
    const order = await Order.findOne({ orderNumber });
    if (!order) return res.status(404).json({ success: false, error: 'Không tìm thấy đơn hàng' });
    if (!ONLINE_METHODS.includes(order.paymentMethod) || order.orderType === 'CUSTOM_QUOTE') {
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
    if (await PaymentTransaction.exists({ gatewayRef: data.app_trans_id })) {
      await confirmGatewayDeposit({ gatewayRef: data.app_trans_id, amount: data.amount, providerTxnId: data.zp_trans_id || data.app_trans_id });
      return res.json({ return_code: 1, return_message: 'success' });
    }
    await markPaid({ paymentTransactionId: data.app_trans_id, total: Number(data.amount) }, data.app_trans_id);

    res.json({ return_code: 1, return_message: 'success' });
  } catch (err) {
    console.error('zalopay/callback error', err);
    res.json({ return_code: 0, return_message: err.message });
  }
});

module.exports = router;
