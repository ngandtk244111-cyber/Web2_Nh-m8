// Integration test P0: xoá tài khoản nhân viên, bảo mật CustomRequest, báo giá có phiên bản, đặt đơn từ báo giá,
// cọc đơn COD đặt làm và chặn sản xuất, thanh toán trước 100% (chuyển khoản / MoMo / ZaloPay), hàng in 3D, huỷ / hoàn tiền.
// Chạy server thật trên DB test riêng (xem harness.js). Chạy: npm run test:integration
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const mongoose = require('mongoose');
const { DEFAULT_TEST_URI, prepareDatabase, seedAccounts, startServer, apiClient, SERVER_DIR } = require('./harness');

const URI = process.env.MONGODB_URI_TEST || DEFAULT_TEST_URI;
const PORT = Number(process.env.TEST_SERVER_PORT || 4399);
const model = (name) => require(path.join(SERVER_DIR, 'models', name));

let server;
let api;
const tok = {}; // token theo tên tài khoản
const BANK = { bankCode: '970436', bankName: 'Vietcombank', accountNumber: '0123456789', accountName: 'CONG TY LUMEA TEST' };

const validRequestBody = (title = 'Kệ treo tường gỗ sồi đặt riêng') => ({
  title,
  customerName: 'Alice Test',
  customerEmail: 'alice@test.local',
  customerPhone: '0900000001',
  brief: {
    productType: 'Khay / hộp đựng',
    printMaterial: 'PLA',
    dimensionsCm: { length: 20, width: 15, height: 10 },
    theme: 'Phong cách tối giản Bắc Âu, tông màu gỗ sáng tự nhiên',
    notes: 'Có ngăn chia nhỏ để đựng đồ trang sức',
    customText: 'Alice',
    estimatedBudget: '500000',
    agreedPrintRules: true,
  },
});

const address = { fullName: 'Alice Test', phone: '0900000001', street: '1 Lê Lợi', district: 'Quận 1', city: 'TP.HCM' };

async function login(kind, username, password) {
  const res = kind === 'admin'
    ? await api('POST', '/admin/auth/login', { body: { username, password } })
    : await api('POST', '/auth/login', { body: { identifier: username, password } });
  assert.equal(res.status, 200, `đăng nhập ${username}: ${JSON.stringify(res.data)}`);
  return res.data.token;
}

/** Tạo yêu cầu + báo giá đã gửi (tổng `unitPrice`) cho Alice; trả về { request, quote }. */
async function requestWithSentQuote(unitPrice = 500000, title) {
  const created = await api('POST', '/custom-requests', { token: tok.alice, body: validRequestBody(title) });
  assert.equal(created.status, 200, JSON.stringify(created.data));
  const request = created.data.request;
  const draft = await api('POST', `/custom-requests/${request.id}/quotes`, {
    token: tok.manager,
    body: { items: [{ name: 'Hộp đựng trang sức', material: 'PLA', size: '20x15x10', quantity: 1, unitPrice }], estimatedDays: 7 },
  });
  assert.equal(draft.status, 200, JSON.stringify(draft.data));
  const sent = await api('POST', `/custom-requests/${request.id}/quotes/${draft.data.quote.version}/send`, { token: tok.manager });
  assert.equal(sent.status, 200, JSON.stringify(sent.data));
  return { request, quote: sent.data.quote };
}

/** Yêu cầu -> báo giá đã gửi -> Alice chấp nhận. Trả về { request, quote }. */
async function acceptedQuote(unitPrice = 500000, title) {
  const { request, quote } = await requestWithSentQuote(unitPrice, title);
  const acc = await api('POST', `/custom-requests/${request.id}/quotes/${quote.version}/accept`, { token: tok.alice, body: { agreeDepositTerms: true } });
  assert.equal(acc.status, 200, JSON.stringify(acc.data));
  return { request, quote: acc.data.quote || quote };
}

/** Yêu cầu -> báo giá -> Alice chấp nhận -> đặt đơn với phương thức thanh toán đã chọn. */
async function createQuoteOrder(unitPrice = 500000, paymentMethod = 'COD') {
  const { request, quote } = await acceptedQuote(unitPrice);
  const co = await api('POST', `/custom-requests/${request.id}/checkout`, {
    token: tok.alice, body: { quoteVersion: quote.version, agreeDepositTerms: true, paymentMethod, shippingAddress: address },
  });
  assert.equal(co.status, 200, JSON.stringify(co.data));
  return { request, quote, order: co.data.order };
}

const freshOrder = (orderNumber) => model('Order').findOne({ orderNumber }).lean();

describe('Đặt đơn từ báo giá', () => {
  let request;
  let quote;

  before(async () => {
    ({ request, quote } = await acceptedQuote(500000, 'Bàn trà mini in 3D theo yêu cầu'));
  });

  it('cấu hình tài khoản: cần payments.config (settings.edit không đủ), có audit giá trị cũ / mới', async () => {
    assert.equal((await api('PUT', '/admin/payment-config', { token: tok.manager, body: { bank: BANK } })).status, 403);
    assert.equal((await api('PUT', '/admin/payment-config', { token: tok.super, body: { bank: { ...BANK, accountNumber: 'abc' } } })).status, 400);
    const ok = await api('PUT', '/admin/payment-config', { token: tok.super, body: { bank: BANK } });
    assert.equal(ok.status, 200);
    const audit = await model('AuditLog').findOne({ action: 'Sửa tài khoản nhận tiền' }).lean();
    assert.match(audit.detail, /Cũ: \(chưa có\) → Mới: Vietcombank/);
  });

  it('thiếu đồng ý / chưa chọn hoặc sai phương thức / có mã giảm giá / khách khác / chưa đăng nhập đều bị từ chối', async () => {
    const body = { quoteVersion: quote.version, agreeDepositTerms: true, paymentMethod: 'COD', shippingAddress: address };
    const url = `/custom-requests/${request.id}/checkout`;
    assert.equal((await api('POST', url, { token: tok.alice, body: { ...body, agreeDepositTerms: false } })).status, 400);
    assert.equal((await api('POST', url, { token: tok.alice, body: { ...body, paymentMethod: undefined } })).status, 400);
    assert.equal((await api('POST', url, { token: tok.alice, body: { ...body, paymentMethod: 'BITCOIN' } })).status, 400);
    assert.equal((await api('POST', url, { token: tok.alice, body: { ...body, couponCode: 'SALE50' } })).status, 400);
    assert.equal((await api('POST', url, { token: tok.bob, body })).status, 404);
    assert.equal((await api('POST', url, { body })).status, 401);
  });

  it('báo giá chưa được chấp nhận thì không đặt được', async () => {
    const { request: r2, quote: q2 } = await requestWithSentQuote(300000, 'Đèn ngủ in 3D chưa chấp nhận');
    const res = await api('POST', `/custom-requests/${r2.id}/checkout`, {
      token: tok.alice, body: { quoteVersion: q2.version, agreeDepositTerms: true, paymentMethod: 'COD', shippingAddress: address },
    });
    assert.equal(res.status, 400);
  });

  it('bấm đặt hàng liên tục (song song) chỉ tạo 1 đơn; giá và tiền cọc lấy từ báo giá, không theo dữ liệu gửi lên', async () => {
    const body = {
      quoteVersion: quote.version, agreeDepositTerms: true, paymentMethod: 'COD', shippingAddress: address,
      total: 1, subtotal: 1, depositAmount: 1, items: [{ product: { id: 'x' }, quantity: 1, unitPrice: 1 }],
    };
    const results = await Promise.all(Array.from({ length: 5 }, () =>
      api('POST', `/custom-requests/${request.id}/checkout`, { token: tok.alice, body })));
    results.forEach(r => assert.equal(r.status, 200, JSON.stringify(r.data)));
    assert.equal(new Set(results.map(r => r.data.order.orderNumber)).size, 1);
    assert.equal(await model('Order').countDocuments({ 'customRequestRef.requestId': request.id }), 1);

    const order = await freshOrder(results[0].data.order.orderNumber);
    const q = await model('Quote').findOne({ customRequestId: request.id, version: quote.version }).lean();
    assert.equal(order.orderType, 'CUSTOM_QUOTE');
    assert.equal(order.subtotal, q.subtotal);
    assert.equal(order.total, q.total + order.shippingFee);
    assert.equal(order.depositAmount, q.deposit.amount);
    assert.equal(order.depositAmount, 250000);
    assert.equal(order.paymentStatus, 'UNPAID');
    assert.equal(order.status, 'PENDING');
    const req2 = await model('CustomRequest').findOne({ id: request.id }).lean();
    assert.equal(req2.status, 'CONVERTED_TO_ORDER');
    assert.equal(req2.orderNumber, order.orderNumber);
  });

  it('không gửi được báo giá mới khi yêu cầu đã có đơn hiệu lực', async () => {
    const res = await api('POST', `/custom-requests/${request.id}/quotes`, { token: tok.manager, body: { items: [{ name: 'A', quantity: 1, unitPrice: 1 }], estimatedDays: 1 } });
    assert.equal(res.status, 400);
  });

  it('chọn chuyển khoản / MoMo / ZaloPay thì không có cọc, phải thanh toán đủ 100%', async () => {
    for (const method of ['BANK_TRANSFER', 'MOMO', 'ZALOPAY']) {
      const { order } = await createQuoteOrder(400000, method);
      assert.equal(order.paymentMethod, method);
      assert.equal(order.depositAmount, 0);
    }
  });

  it('giỏ hàng cũ còn sản phẩm ảo custom-... bị từ chối với hướng dẫn rõ ràng (không còn "không tồn tại")', async () => {
    const res = await api('POST', '/orders', {
      token: tok.alice,
      body: { items: [{ id: 'c1', product: { id: 'custom-req-1', name: '[Custom POD] X' }, quantity: 1 }], shippingAddress: address, paymentMethod: 'COD' },
    });
    assert.equal(res.status, 400);
    assert.match(res.data.error, /trang yêu cầu đặt làm/);
    assert.doesNotMatch(res.data.error, /không tồn tại/);
  });
});

describe('Cọc đơn COD đặt làm + chặn sản xuất', () => {
  let n;

  before(async () => {
    const { order } = await createQuoteOrder(500000, 'COD');
    n = order.orderNumber;
  });

  it('chưa nhận cọc: không xác nhận / gọi chốt / chuyển sản xuất được', async () => {
    assert.equal((await api('PATCH', `/orders/${n}/confirm`, { token: tok.manager })).status, 400);
    assert.equal((await api('PATCH', `/orders/${n}/confirm-phone`, { token: tok.manager })).status, 400);
    assert.equal((await api('PATCH', `/orders/${n}/production`, { token: tok.manager, body: { status: 'IN_PRODUCTION' } })).status, 400);
    assert.equal((await freshOrder(n)).status, 'PENDING');
  });

  it('khách không tự đánh dấu đã cọc / đã thanh toán được', async () => {
    assert.equal((await api('PATCH', `/orders/${n}/deposit-received`, { token: tok.alice })).status, 401);
    assert.equal((await api('PATCH', `/orders/${n}/payment-status`, { token: tok.alice, body: { paymentStatus: 'PAID' } })).status, 401);
    assert.equal((await api('POST', '/payments/sandbox/confirm', { body: { orderNumber: n } })).status, 400);
    const order = await freshOrder(n);
    assert.equal(order.depositPaidAt, null);
    assert.equal(order.paymentStatus, 'UNPAID');
  });

  it('không có quyền orders.approve thì không xác nhận nhận cọc được (Customer Care, Warehouse Lead)', async () => {
    assert.equal((await api('PATCH', `/orders/${n}/deposit-received`, { token: tok.care })).status, 403);
    assert.equal((await api('PATCH', `/orders/${n}/deposit-received`, { token: tok.warehouse })).status, 403);
  });

  it('nhân viên có quyền xác nhận đã nhận cọc; xác nhận lần hai bị từ chối', async () => {
    const amount = (await freshOrder(n)).paymentPlan.depositAmount;
    const ok = await api('POST', `/orders/${n}/deposit/transactions`, {
      token: tok.manager,
      body: { receivedAmount: amount, bankTxnRef: `CODDEP-${n}` },
    });
    assert.equal(ok.status, 200, JSON.stringify(ok.data));
    assert.equal(ok.data.order.depositStatus, 'PAID');
    assert.equal((await api('POST', `/orders/${n}/deposit/transactions`, {
      token: tok.manager,
      body: { receivedAmount: amount, bankTxnRef: `CODDEP-DUP-${n}` },
    })).status, 400);
  });

  it('đủ cọc: gọi chốt với khách thì đơn vào sản xuất, ghi thời điểm bắt đầu và nhật ký', async () => {
    const res = await api('PATCH', `/orders/${n}/confirm-phone`, { token: tok.manager });
    assert.equal(res.status, 200, JSON.stringify(res.data));
    assert.equal(res.data.order.status, 'IN_PRODUCTION');
    assert.ok(res.data.order.productionStartedAt);
    const audit = await model('AuditLog').findOne({ action: 'Bắt đầu sản xuất', detail: new RegExp(n) }).lean();
    assert.ok(audit, 'có dòng nhật ký bắt đầu sản xuất');
  });

  it('không chuyển ngược trạng thái; khách không tự huỷ đơn đang sản xuất', async () => {
    assert.equal((await api('PATCH', `/orders/${n}/production`, { token: tok.manager, body: { status: 'PENDING' } })).status, 400);
    assert.equal((await api('PATCH', `/orders/${n}/production`, { token: tok.manager, body: { status: 'CONFIRMED' } })).status, 400);
    assert.equal((await api('PATCH', `/orders/${n}/cancel`, { token: tok.alice, body: { reason: 'Tôi không có nhu cầu mua nữa' } })).status, 400);
    assert.equal((await freshOrder(n)).status, 'IN_PRODUCTION');
  });
});

describe('Đơn đặt làm thanh toán trước 100%', () => {
  const crypto = require('crypto');
  const hmac = (data, key) => crypto.createHmac('sha256', key).update(data).digest('hex');
  /** Ký giống MoMo (khoá test do harness đặt cho server). */
  function signedMomo(fields) {
    const b = { accessKey: 'test-access', extraData: '', message: 'Successful.', orderInfo: 'Don', orderType: 'momo_wallet', partnerCode: 'TESTPARTNER', payType: 'qr', requestId: 'r1', responseTime: Date.now(), ...fields };
    const raw = `accessKey=${b.accessKey}&amount=${b.amount}&extraData=${b.extraData}&message=${b.message}&orderId=${b.orderId}&orderInfo=${b.orderInfo}` +
      `&orderType=${b.orderType}&partnerCode=${b.partnerCode}&payType=${b.payType}&requestId=${b.requestId}&responseTime=${b.responseTime}` +
      `&resultCode=${b.resultCode}&transId=${b.transId}`;
    return { ...b, signature: hmac(raw, 'test-momo-secret') };
  }

  it('chuyển khoản: khách báo đã chuyển chưa tính là đã nhận; chỉ nhân viên có quyền xác nhận đủ tiền thì mới sản xuất', async () => {
    const { order } = await createQuoteOrder(400000, 'BANK_TRANSFER');
    const n = order.orderNumber;
    assert.equal((await api('PATCH', `/orders/${n}/confirm`, { token: tok.manager })).status, 400);
    assert.equal((await api('PATCH', `/orders/${n}/confirm-payment`, { token: tok.alice, body: {} })).status, 200);
    assert.equal((await freshOrder(n)).paymentStatus, 'UNPAID');
    assert.equal((await api('PATCH', `/orders/${n}/confirm`, { token: tok.manager })).status, 400, 'báo chuyển chưa phải đã nhận');
    assert.equal((await api('PATCH', `/orders/${n}/payment-status`, { token: tok.care, body: { paymentStatus: 'PAID' } })).status, 403);
    assert.equal((await api('PATCH', `/orders/${n}/payment-status`, { token: tok.manager, body: { paymentStatus: 'PAID' } })).status, 200);
    const ok = await api('PATCH', `/orders/${n}/confirm`, { token: tok.manager });
    assert.equal(ok.status, 200, JSON.stringify(ok.data));
    assert.equal(ok.data.order.status, 'IN_PRODUCTION');
  });

  it('MoMo (cổng thử): thanh toán xong đơn thành đã thanh toán; gọi xác nhận lại không đổi gì; sau đó mới sản xuất được', async () => {
    const { order } = await createQuoteOrder(300000, 'MOMO');
    const n = order.orderNumber;
    assert.equal((await api('PATCH', `/orders/${n}/confirm`, { token: tok.manager })).status, 400);
    const created = await api('POST', '/payments/momo/create', { body: { orderNumber: n } });
    assert.equal(created.status, 200, JSON.stringify(created.data));
    assert.ok(created.data.payUrl);
    const paid = await api('POST', '/payments/sandbox/confirm', { body: { orderNumber: n } });
    assert.equal(paid.data.paid, true);
    const again = await api('POST', '/payments/sandbox/confirm', { body: { orderNumber: n } });
    assert.equal(again.status, 200);
    const fresh = await freshOrder(n);
    assert.equal(fresh.paymentStatus, 'PAID');
    assert.equal(fresh.total, order.total);
    const ok = await api('PATCH', `/orders/${n}/confirm`, { token: tok.manager });
    assert.equal(ok.data.order.status, 'IN_PRODUCTION');
  });

  it('IPN MoMo: sai chữ ký bị từ chối; sai số tiền không được ghi nhận; đúng chữ ký và số tiền thì ghi nhận', async () => {
    const { order } = await createQuoteOrder(300000, 'MOMO');
    const n = order.orderNumber;
    const bad = { ...signedMomo({ orderId: n, amount: order.total, resultCode: 0, transId: 9001 }), signature: 'sai' };
    assert.equal((await api('POST', '/payments/momo/ipn', { body: bad })).status, 400);
    assert.equal((await freshOrder(n)).paymentStatus, 'UNPAID');
    await api('POST', '/payments/momo/ipn', { body: signedMomo({ orderId: n, amount: order.total - 1000, resultCode: 0, transId: 9002 }) });
    assert.equal((await freshOrder(n)).paymentStatus, 'UNPAID', 'sai số tiền');
    assert.equal((await api('POST', '/payments/momo/ipn', { body: signedMomo({ orderId: n, amount: order.total, resultCode: 0, transId: 9003 }) })).status, 200);
    assert.equal((await freshOrder(n)).paymentStatus, 'PAID');
  });

  it('callback ZaloPay: sai mac bị từ chối; đúng mac và đúng số tiền thì ghi nhận', async () => {
    const { order } = await createQuoteOrder(300000, 'ZALOPAY');
    const n = order.orderNumber;
    const ref = '261118_LUMEATEST';
    // Giống lúc /zalopay/create thành công: server lưu mã giao dịch của ZaloPay vào đơn.
    await model('Order').updateOne({ orderNumber: n }, { paymentTransactionId: ref });
    const dataStr = JSON.stringify({ app_trans_id: ref, amount: order.total, zp_trans_id: 777 });
    assert.equal((await api('POST', '/payments/zalopay/callback', { body: { data: dataStr, mac: 'sai' } })).data.return_code, -1);
    assert.equal((await freshOrder(n)).paymentStatus, 'UNPAID');
    assert.equal((await api('POST', '/payments/zalopay/callback', { body: { data: dataStr, mac: hmac(dataStr, 'test-zp-key2') } })).data.return_code, 1);
    assert.equal((await freshOrder(n)).paymentStatus, 'PAID');
  });
});

describe('Huỷ và hoàn tiền đơn đặt làm', () => {
  const reason = 'Tôi không có nhu cầu mua nữa';
  const refundBank = { bankName: 'Vietcombank', bankAccount: '0123456789', accountHolder: 'Alice Test' };

  it('khách huỷ đơn chuyển khoản đã báo chuyển: phải nhập tài khoản nhận hoàn; hoàn đủ tổng tiền đơn', async () => {
    const { order } = await createQuoteOrder(400000, 'BANK_TRANSFER');
    const n = order.orderNumber;
    await api('PATCH', `/orders/${n}/confirm-payment`, { token: tok.alice, body: {} });
    assert.equal((await api('PATCH', `/orders/${n}/cancel`, { token: tok.alice, body: { reason } })).status, 400, 'thiếu tài khoản nhận hoàn');
    assert.equal((await api('PATCH', `/orders/${n}/cancel`, { token: tok.bob, body: { reason, refundBank } })).status, 404, 'khách khác');
    const res = await api('PATCH', `/orders/${n}/cancel`, { token: tok.alice, body: { reason, refundBank } });
    assert.equal(res.status, 200, JSON.stringify(res.data));
    assert.equal(res.data.order.status, 'CANCELLED');
    assert.equal(res.data.order.refund.status, 'PENDING');
    assert.equal(res.data.order.refund.amount, order.total);
  });

  it('nhân viên huỷ đơn đã thanh toán: bắt buộc lý do; tạo yêu cầu hoàn; chỉ hoàn xong khi có mã giao dịch; khách không tự đánh dấu', async () => {
    const { order } = await createQuoteOrder(400000, 'BANK_TRANSFER');
    const n = order.orderNumber;
    await api('PATCH', `/orders/${n}/payment-status`, { token: tok.manager, body: { paymentStatus: 'PAID' } });
    assert.equal((await api('PATCH', `/orders/${n}/production`, { token: tok.manager, body: { status: 'CANCELLED' } })).status, 400, 'thiếu lý do');
    const cancelled = await api('PATCH', `/orders/${n}/production`, { token: tok.manager, body: { status: 'CANCELLED', cancelReason: 'Xưởng không nhận được vật liệu' } });
    assert.equal(cancelled.status, 200, JSON.stringify(cancelled.data));
    assert.equal(cancelled.data.order.refund.status, 'PENDING');
    assert.equal(cancelled.data.order.refund.amount, order.total);
    assert.equal((await api('PATCH', `/orders/${n}/refund`, { token: tok.alice, body: { action: 'complete', transactionRef: 'X' } })).status, 401);
    assert.equal((await api('PATCH', `/orders/${n}/refund`, { token: tok.care, body: { action: 'complete', transactionRef: 'X' } })).status, 403);
    assert.equal((await api('PATCH', `/orders/${n}/refund`, { token: tok.manager, body: { action: 'complete' } })).status, 400, 'thiếu mã giao dịch');
    const done = await api('PATCH', `/orders/${n}/refund`, { token: tok.manager, body: { action: 'complete', transactionRef: 'FTREFUND01' } });
    assert.equal(done.status, 200, JSON.stringify(done.data));
    assert.equal(done.data.order.refund.status, 'COMPLETED');
    assert.equal(done.data.order.paymentStatus, 'REFUNDED');
    assert.equal((await api('PATCH', `/orders/${n}/refund`, { token: tok.manager, body: { action: 'complete', transactionRef: 'FTREFUND02' } })).status, 400, 'không hoàn 2 lần');
  });

  it('không hoàn tiền thì bắt buộc ghi lý do', async () => {
    const { order } = await createQuoteOrder(400000, 'BANK_TRANSFER');
    const n = order.orderNumber;
    await api('PATCH', `/orders/${n}/payment-status`, { token: tok.manager, body: { paymentStatus: 'PAID' } });
    await api('PATCH', `/orders/${n}/production`, { token: tok.manager, body: { status: 'CANCELLED', cancelReason: 'Khách đổi ý sau khi đã chuyển' } });
    assert.equal((await api('PATCH', `/orders/${n}/refund`, { token: tok.manager, body: { action: 'void' } })).status, 400);
    const res = await api('PATCH', `/orders/${n}/refund`, { token: tok.manager, body: { action: 'void', adminNote: 'Tiền chưa về tài khoản shop' } });
    assert.equal(res.status, 200);
    assert.equal(res.data.order.refund.status, 'VOID');
  });

  it('đơn COD đã nhận cọc mà bị huỷ: tạo yêu cầu hoàn lại tiền cọc cho khách', async () => {
    const { order } = await createQuoteOrder(500000, 'COD');
    const n = order.orderNumber;
    const deposit = await api('POST', `/orders/${n}/deposit/transactions`, {
      token: tok.manager,
      body: { receivedAmount: order.paymentPlan.depositAmount, bankTxnRef: `CODDEP-${n}` },
    });
    assert.equal(deposit.status, 200, JSON.stringify(deposit.data));
    assert.equal(deposit.data.order.depositReceived, order.paymentPlan.depositAmount);
    const res = await api('PATCH', `/orders/${n}/production`, { token: tok.manager, body: { status: 'CANCELLED', cancelReason: 'Xưởng không nhận được vật liệu' } });
    assert.equal(res.status, 200, JSON.stringify(res.data));
    assert.ok(res.data.order.refund, 'phải có yêu cầu hoàn tiền cọc');
    assert.equal(res.data.order.refund.amount, order.depositAmount);
  });

  it('huỷ đơn thì yêu cầu đặt làm mở lại để nhận báo giá mới', async () => {
    const { request, order } = await createQuoteOrder(400000, 'BANK_TRANSFER');
    await api('PATCH', `/orders/${order.orderNumber}/cancel`, { token: tok.alice, body: { reason } });
    const res = await api('POST', `/custom-requests/${request.id}/quotes`, { token: tok.manager, body: { items: [{ name: 'Bản sửa', quantity: 1, unitPrice: 350000 }], estimatedDays: 5 } });
    assert.equal(res.status, 200, JSON.stringify(res.data));
  });
});

before(async () => {
  await prepareDatabase(URI);
  await seedAccounts();
  server = await startServer(URI, PORT);
  api = apiClient(PORT);
  for (const name of ['super', 'manager', 'care', 'warehouse']) tok[name] = await login('admin', `t_${name}`, 'Test@12345');
  tok.alice = await login('user', 'alice@test.local', 'Test@12345');
  tok.bob = await login('user', 'bob@test.local', 'Test@12345');
});

after(async () => {
  if (server) server.child.kill();
  await mongoose.disconnect();
});

describe('VI. Xoá tài khoản nhân viên', () => {
  let victimId;
  let victimToken;

  before(async () => {
    const created = await api('POST', '/admin/staff', { token: tok.super, body: { username: 't_victim', fullName: 'Victim', password: 'Victim@1234', role: 'Customer Care' } });
    assert.equal(created.status, 200);
    victimId = created.data.staff._id;
    victimToken = await login('admin', 't_victim', 'Victim@1234');
  });

  it('không có quyền staff.delete thì không xoá được (Store Manager, Customer Care)', async () => {
    assert.equal((await api('DELETE', `/admin/staff/${victimId}`, { token: tok.manager })).status, 403);
    assert.equal((await api('DELETE', `/admin/staff/${victimId}`, { token: tok.care })).status, 403);
  });

  it('không tự xoá chính mình', async () => {
    const me = await api('GET', '/admin/auth/me', { token: tok.super });
    const res = await api('DELETE', `/admin/staff/${me.data.admin._id}`, { token: tok.super });
    assert.equal(res.status, 400);
  });

  it('Super Admin xoá được; token cũ hết hiệu lực; mất khỏi danh sách; có audit log', async () => {
    assert.equal((await api('GET', '/admin/auth/me', { token: victimToken })).status, 200);
    const del = await api('DELETE', `/admin/staff/${victimId}`, { token: tok.super });
    assert.equal(del.status, 200);
    assert.equal((await api('GET', '/admin/auth/me', { token: victimToken })).status, 401);
    const list = await api('GET', '/admin/staff', { token: tok.super });
    assert.ok(!list.data.staff.some(s => s._id === victimId));
    const audit = await model('AuditLog').findOne({ action: 'Xoá tài khoản nhân viên', detail: /t_victim/ }).lean();
    assert.ok(audit, 'phải có audit log xoá nhân viên');
    assert.equal(await model('Admin').findById(victimId).lean(), null);
  });

  it('không mở khoá / đổi vai trò / xoá lại tài khoản đã xoá', async () => {
    assert.equal((await api('PATCH', `/admin/staff/${victimId}/active`, { token: tok.super, body: { active: true } })).status, 404);
    assert.equal((await api('PATCH', `/admin/staff/${victimId}/role`, { token: tok.super, body: { role: 'Customer Care' } })).status, 404);
    assert.equal((await api('DELETE', `/admin/staff/${victimId}`, { token: tok.super })).status, 404);
  });

  it('tạo lại nhân viên cùng tên đăng nhập không lỗi unique', async () => {
    const again = await api('POST', '/admin/staff', { token: tok.super, body: { username: 't_victim', fullName: 'Victim 2', password: 'Victim@1234', role: 'Customer Care' } });
    assert.equal(again.status, 200, JSON.stringify(again.data));
  });
});

describe('P0.1 Bảo mật CustomRequest', () => {
  let request;
  before(async () => {
    const res = await api('POST', '/custom-requests', { token: tok.alice, body: validRequestBody() });
    request = res.data.request;
  });

  it('mã yêu cầu ngẫu nhiên khó dò, không nhận trạng thái / giá từ client', async () => {
    assert.match(request.requestCode, /^REQ-\d{4}-[A-Z2-9]{6}$/);
    const sneaky = await api('POST', '/custom-requests', { token: tok.alice, body: { ...validRequestBody(), status: 'APPROVED', quotationPrice: 1, orderNumber: 'X' } });
    assert.equal(sneaky.data.request.status, 'PENDING_REVIEW');
    assert.equal(sneaky.data.request.quotationPrice, null);
    assert.equal(sneaky.data.request.orderNumber, null);
  });

  it('GET chi tiết: khách vãng lai / khách khác 404; chủ và nhân viên xem được', async () => {
    assert.equal((await api('GET', `/custom-requests/${request.id}`)).status, 404);
    assert.equal((await api('GET', `/custom-requests/${request.requestCode}`, { token: tok.bob })).status, 404);
    assert.equal((await api('GET', `/custom-requests/${request.id}`, { token: tok.alice })).status, 200);
    assert.equal((await api('GET', `/custom-requests/${request.id}`, { token: tok.manager })).status, 200);
    assert.equal((await api('GET', `/custom-requests/${request.id}`, { token: tok.warehouse })).status, 404);
  });

  it('gửi tin nhắn: chỉ chủ hoặc nhân viên có quyền', async () => {
    assert.equal((await api('POST', `/custom-requests/${request.id}/messages`, { body: { text: 'hi' } })).status, 404);
    assert.equal((await api('POST', `/custom-requests/${request.id}/messages`, { token: tok.bob, body: { text: 'hi' } })).status, 404);
    assert.equal((await api('POST', `/custom-requests/${request.id}/messages`, { token: tok.alice, body: { text: 'hi' } })).status, 200);
    assert.equal((await api('POST', `/custom-requests/${request.id}/messages`, { token: tok.warehouse, body: { text: 'hi' } })).status, 403);
  });

  it('khách không tự đổi trạng thái; nhân viên không đặt được trạng thái gắn với báo giá / giá', async () => {
    assert.equal((await api('PATCH', `/custom-requests/${request.id}/status`, { token: tok.alice, body: { status: 'APPROVED' } })).status, 401);
    assert.equal((await api('PATCH', `/custom-requests/${request.id}/status`, { body: { status: 'CONVERTED_TO_ORDER' } })).status, 401);
    assert.equal((await api('PATCH', `/custom-requests/${request.id}/status`, { token: tok.manager, body: { status: 'CONVERTED_TO_ORDER' } })).status, 400);
    assert.equal((await api('PATCH', `/custom-requests/${request.id}/status`, { token: tok.manager, body: { quotationPrice: 1 } })).status, 400);
    assert.equal((await api('PATCH', `/custom-requests/${request.id}/status`, { token: tok.manager, body: { status: 'IN_DISCUSSION' } })).status, 200);
  });
});

describe('P0.2 Báo giá có phiên bản', () => {
  let request;
  let draft;
  before(async () => {
    request = (await api('POST', '/custom-requests', { token: tok.alice, body: validRequestBody() })).data.request;
  });

  it('không có quyền custom3d.edit thì không tạo được báo giá', async () => {
    const res = await api('POST', `/custom-requests/${request.id}/quotes`, { token: tok.warehouse, body: { items: [{ name: 'A', quantity: 1, unitPrice: 1000 }], estimatedDays: 3 } });
    assert.equal(res.status, 403);
  });

  it('tạo nháp: server tự tính tổng, bỏ qua tổng client gửi; khách không thấy bản nháp', async () => {
    const res = await api('POST', `/custom-requests/${request.id}/quotes`, {
      token: tok.manager,
      body: { items: [{ name: 'Hộp', quantity: 2, unitPrice: 300000, discount: 100000, lineTotal: 1 }], quoteDiscount: 0, estimatedDays: 5, total: 1, deposit: { amount: 1 } },
    });
    assert.equal(res.status, 200, JSON.stringify(res.data));
    draft = res.data.quote;
    assert.equal(draft.total, 500000);
    assert.equal(draft.deposit, null);
    assert.equal(draft.version, 1);
    const asCustomer = await api('GET', `/custom-requests/${request.id}/quotes`, { token: tok.alice });
    assert.equal(asCustomer.data.quotes.length, 0);
    const second = await api('POST', `/custom-requests/${request.id}/quotes`, { token: tok.manager, body: { items: [{ name: 'B', quantity: 1, unitPrice: 1000 }], estimatedDays: 1 } });
    assert.equal(second.status, 409, 'chỉ 1 bản nháp mỗi yêu cầu');
  });

  it('gửi khách: chốt cọc theo chính sách (500k -> 250k), hạn 7 ngày, không sửa được sau khi gửi', async () => {
    const sent = await api('POST', `/custom-requests/${request.id}/quotes/1/send`, { token: tok.manager });
    assert.equal(sent.status, 200, JSON.stringify(sent.data));
    const q = sent.data.quote;
    assert.equal(q.status, 'SENT');
    assert.equal(q.deposit.amount, 250000);
    assert.equal(q.deposit.remaining, 250000);
    const days = (new Date(q.validUntil) - new Date(q.issuedAt)) / 86400000;
    assert.equal(Math.round(days), 7);
    assert.equal(sent.data.request.status, 'QUOTED');
    const edit = await api('PUT', `/custom-requests/${request.id}/quotes/1`, { token: tok.manager, body: { items: [{ name: 'X', quantity: 1, unitPrice: 1 }], estimatedDays: 1 } });
    assert.equal(edit.status, 400);
    assert.equal((await api('POST', `/custom-requests/${request.id}/quotes/1/send`, { token: tok.manager })).status, 400, 'gửi lại lần 2 không được');
  });

  it('chấp nhận: phải đồng ý chính sách cọc, đúng chủ', async () => {
    assert.equal((await api('POST', `/custom-requests/${request.id}/quotes/1/accept`, { token: tok.alice, body: {} })).status, 400);
    assert.equal((await api('POST', `/custom-requests/${request.id}/quotes/1/accept`, { token: tok.bob, body: { agreeDepositTerms: true } })).status, 404);
    assert.equal((await api('POST', `/custom-requests/${request.id}/quotes/1/accept`, { body: { agreeDepositTerms: true } })).status, 401);
  });

  it('phiên bản mới thay thế bản cũ; không chấp nhận được bản đã bị thay thế', async () => {
    const v2 = await api('POST', `/custom-requests/${request.id}/quotes`, { token: tok.manager, body: { items: [{ name: 'Hộp v2', quantity: 1, unitPrice: 900000 }], estimatedDays: 6 } });
    assert.equal(v2.data.quote.version, 2);
    const sent = await api('POST', `/custom-requests/${request.id}/quotes/2/send`, { token: tok.manager });
    assert.equal(sent.data.quote.deposit.amount, 450000);
    const v1 = await model('Quote').findOne({ customRequestId: request.id, version: 1 }).lean();
    assert.equal(v1.status, 'SUPERSEDED');
    assert.equal((await api('POST', `/custom-requests/${request.id}/quotes/1/accept`, { token: tok.alice, body: { agreeDepositTerms: true } })).status, 400);
    const ok = await api('POST', `/custom-requests/${request.id}/quotes/2/accept`, { token: tok.alice, body: { agreeDepositTerms: true } });
    assert.equal(ok.status, 200);
    assert.equal(ok.data.request.status, 'APPROVED');
    assert.equal((await api('POST', `/custom-requests/${request.id}/quotes/2/accept`, { token: tok.alice, body: { agreeDepositTerms: true } })).status, 400, 'chấp nhận lại lần 2');
  });

  it('khách đã chấp nhận: cấp 3D preview không làm mất quyền đặt hàng; không đổi trạng thái tay', async () => {
    const res = await api('PATCH', `/custom-requests/${request.id}/status`, { token: tok.manager, body: { status: 'PREVIEW_READY', preview3dModelType: 'geometric_vase' } });
    assert.equal(res.status, 200);
    assert.equal(res.data.request.status, 'APPROVED');
    assert.equal(res.data.request.preview3dModelType, 'geometric_vase');
    assert.equal((await api('PATCH', `/custom-requests/${request.id}/status`, { token: tok.manager, body: { status: 'IN_DISCUSSION' } })).status, 400);
  });

  it('báo giá hết hạn (giờ server) thì không chấp nhận được', async () => {
    const { request: r2, quote } = await requestWithSentQuote(300000, 'Đèn ngủ hình mặt trăng in 3D');
    await model('Quote').updateOne({ _id: quote._id }, { $set: { validUntil: new Date(Date.now() - 1000) } });
    const res = await api('POST', `/custom-requests/${r2.id}/quotes/${quote.version}/accept`, { token: tok.alice, body: { agreeDepositTerms: true } });
    assert.equal(res.status, 400);
    assert.match(res.data.error, /hết hạn/);
    const q = await model('Quote').findById(quote._id).lean();
    assert.equal(q.status, 'EXPIRED');
  });

  it('đổi mức cọc phải có lý do; có lý do thì áp dụng', async () => {
    const r = (await api('POST', '/custom-requests', { token: tok.alice, body: validRequestBody() })).data.request;
    const bad = await api('POST', `/custom-requests/${r.id}/quotes`, { token: tok.manager, body: { items: [{ name: 'A', quantity: 1, unitPrice: 1000000 }], estimatedDays: 3, depositOverride: { amount: 700000 } } });
    assert.equal(bad.status, 400);
    const good = await api('POST', `/custom-requests/${r.id}/quotes`, { token: tok.manager, body: { items: [{ name: 'A', quantity: 1, unitPrice: 1000000 }], estimatedDays: 3, depositOverride: { amount: 700000, reason: 'Gỗ óc chó nhập riêng' } } });
    assert.equal(good.status, 200);
    const sent = await api('POST', `/custom-requests/${r.id}/quotes/1/send`, { token: tok.manager });
    assert.equal(sent.data.quote.deposit.amount, 700000);
    assert.equal(sent.data.quote.deposit.overridden, true);
  });
});

describe('P0 Hàng in 3D (PRINT_ON_DEMAND) trong giỏ hàng', () => {
  before(async () => {
    await model('Product').create({
      id: 'pod-test-1', name: 'Đèn in 3D test', slug: 'den-in-3d-test', category: 'lamp', categoryName: 'Đèn',
      categoryGroup: 'DECOR', productionType: 'PRINT_ON_DEMAND', basePrice: 400000,
    });
  });
  const items = [{ id: 'i1', product: { id: 'pod-test-1' }, quantity: 1 }];

  it('không cho COD', async () => {
    const res = await api('POST', '/orders', { token: tok.alice, body: { items, shippingAddress: address, paymentMethod: 'COD' } });
    assert.equal(res.status, 400);
    assert.match(res.data.error, /COD/);
  });

  it('chuyển khoản được; chỉ sản xuất sau khi nhân viên xác nhận đủ 100%; không đổi sang COD', async () => {
    const res = await api('POST', '/orders', { token: tok.alice, body: { items, shippingAddress: address, paymentMethod: 'BANK_TRANSFER' } });
    assert.equal(res.status, 200, JSON.stringify(res.data));
    const n = res.data.order.orderNumber;
    assert.equal(res.data.order.paymentPolicyVersion, 2);
    assert.equal((await api('PATCH', `/orders/${n}/payment-method`, { token: tok.alice, body: { paymentMethod: 'COD' } })).status, 400);
    assert.equal((await api('PATCH', `/orders/${n}/confirm`, { token: tok.manager })).status, 400);
    await api('PATCH', `/orders/${n}/confirm-payment`, { token: tok.alice, body: {} }); // khách báo đã chuyển
    assert.equal((await api('PATCH', `/orders/${n}/confirm`, { token: tok.manager })).status, 400, 'báo chuyển chưa phải đã nhận');
    assert.equal((await api('PATCH', `/orders/${n}/payment-status`, { token: tok.manager, body: { paymentStatus: 'PAID' } })).status, 200);
    const ok = await api('PATCH', `/orders/${n}/confirm`, { token: tok.manager });
    assert.equal(ok.status, 200);
    assert.equal(ok.data.order.status, 'IN_PRODUCTION');
  });
});

