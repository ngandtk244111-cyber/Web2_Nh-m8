// Integration test P0: xoá tài khoản nhân viên, bảo mật CustomRequest, báo giá có phiên bản, checkout đặt làm,
// tính cọc, đối soát cọc (chống trùng), chặn sản xuất, hết hạn cọc, hàng in 3D, huỷ / hoàn tiền.
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

/** Yêu cầu -> báo giá -> Alice chấp nhận -> checkout. Trả về { request, quote, order }. */
async function createDepositOrder(unitPrice = 500000) {
  const { request, quote } = await requestWithSentQuote(unitPrice);
  const acc = await api('POST', `/custom-requests/${request.id}/quotes/${quote.version}/accept`, { token: tok.alice, body: { agreeDepositTerms: true } });
  assert.equal(acc.status, 200, JSON.stringify(acc.data));
  const co = await api('POST', `/custom-requests/${request.id}/checkout`, {
    token: tok.alice, body: { quoteVersion: quote.version, agreeDepositTerms: true, balanceMethod: 'COD', shippingAddress: address },
  });
  assert.equal(co.status, 200, JSON.stringify(co.data));
  return { request, quote, order: co.data.order };
}

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

// ------------------------------------------------------------------------------------------------
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

// ------------------------------------------------------------------------------------------------
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

// ------------------------------------------------------------------------------------------------
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

// ------------------------------------------------------------------------------------------------
describe('P0.3–4 Checkout đơn đặt làm + tính cọc', () => {
  let request;
  let quote;

  before(async () => {
    ({ request, quote } = await requestWithSentQuote(500000, 'Bàn trà mini in 3D theo yêu cầu'));
    await api('POST', `/custom-requests/${request.id}/quotes/${quote.version}/accept`, { token: tok.alice, body: { agreeDepositTerms: true } });
  });

  it('chưa cấu hình tài khoản nhận cọc thì từ chối (không tạo QR giả)', async () => {
    const res = await api('POST', `/custom-requests/${request.id}/checkout`, { token: tok.alice, body: { quoteVersion: quote.version, agreeDepositTerms: true, balanceMethod: 'COD', shippingAddress: address } });
    assert.equal(res.status, 503);
  });

  it('cấu hình tài khoản: cần payments.config (settings.edit không đủ), có audit giá trị cũ / mới', async () => {
    assert.equal((await api('PUT', '/admin/payment-config', { token: tok.manager, body: { bank: BANK } })).status, 403);
    assert.equal((await api('PUT', '/admin/payment-config', { token: tok.super, body: { bank: { ...BANK, accountNumber: 'abc' } } })).status, 400);
    const ok = await api('PUT', '/admin/payment-config', { token: tok.super, body: { bank: BANK } });
    assert.equal(ok.status, 200);
    const audit = await model('AuditLog').findOne({ action: 'Sửa tài khoản nhận tiền' }).lean();
    assert.match(audit.detail, /Cũ: \(chưa có\) → Mới: Vietcombank/);
  });

  it('thiếu đồng ý / có mã giảm giá / khách khác / chưa đăng nhập đều bị từ chối', async () => {
    const body = { quoteVersion: quote.version, agreeDepositTerms: true, balanceMethod: 'COD', shippingAddress: address };
    assert.equal((await api('POST', `/custom-requests/${request.id}/checkout`, { token: tok.alice, body: { ...body, agreeDepositTerms: false } })).status, 400);
    assert.equal((await api('POST', `/custom-requests/${request.id}/checkout`, { token: tok.alice, body: { ...body, couponCode: 'SALE50' } })).status, 400);
    assert.equal((await api('POST', `/custom-requests/${request.id}/checkout`, { token: tok.bob, body })).status, 404);
    assert.equal((await api('POST', `/custom-requests/${request.id}/checkout`, { body })).status, 401);
  });

  it('bấm checkout liên tục (song song) chỉ tạo 1 đơn; giá lấy từ báo giá, không theo payload', async () => {
    const body = {
      quoteVersion: quote.version, agreeDepositTerms: true, balanceMethod: 'COD', shippingAddress: address,
      total: 1, subtotal: 1, depositAmount: 1, items: [{ product: { id: 'x' }, quantity: 1, unitPrice: 1 }],
    };
    const results = await Promise.all(Array.from({ length: 6 }, () => api('POST', `/custom-requests/${request.id}/checkout`, { token: tok.alice, body })));
    for (const r of results) assert.equal(r.status, 200, JSON.stringify(r.data));
    const numbers = new Set(results.map(r => r.data.order.orderNumber));
    assert.equal(numbers.size, 1, 'mọi lần bấm trả về cùng 1 đơn');
    assert.equal(await model('Order').countDocuments({ 'customRequestRef.quoteId': quote._id }), 1);

    const order = results[0].data.order;
    assert.equal(order.orderType, 'CUSTOM_QUOTE');
    assert.equal(order.paymentPlan.goodsTotal, 500000);
    assert.equal(order.paymentPlan.depositAmount, 250000);
    assert.equal(order.total, 500000 + order.shippingFee);
    assert.equal(order.paymentPlan.remainingAmount, 250000 + order.shippingFee);
    assert.equal(order.depositStatus, 'UNPAID');
    assert.deepEqual(order.paymentPlan.bank, BANK);
    assert.match(order.paymentPlan.transferContent, /^LUMEA COC [A-Z2-9]{8}$/);
    const payment = results[0].data.payment;
    assert.equal(payment.amount, 250000);
    assert.match(payment.qrUrl, /^https:\/\/img\.vietqr\.io\/image\/970436-0123456789/);
    const req2 = await model('CustomRequest').findOne({ id: request.id }).lean();
    assert.equal(req2.status, 'CONVERTED_TO_ORDER');
    assert.equal(req2.orderNumber, order.orderNumber);
  });

  it('đổi tài khoản ngân hàng sau khi tạo đơn không làm đổi bản chụp trong đơn', async () => {
    await api('PUT', '/admin/payment-config', { token: tok.super, body: { bank: { ...BANK, accountNumber: '9999999999' } } });
    const order = await model('Order').findOne({ 'customRequestRef.quoteId': quote._id }).lean();
    assert.equal(order.paymentPlan.bank.accountNumber, '0123456789');
    await api('PUT', '/admin/payment-config', { token: tok.super, body: { bank: BANK } });
  });

  it('không gửi được báo giá mới khi yêu cầu đã có đơn hiệu lực', async () => {
    const res = await api('POST', `/custom-requests/${request.id}/quotes`, { token: tok.manager, body: { items: [{ name: 'A', quantity: 1, unitPrice: 1 }], estimatedDays: 1 } });
    assert.equal(res.status, 400);
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

// ------------------------------------------------------------------------------------------------
describe('P0.5 Đối soát cọc + chặn sản xuất', () => {
  let order;

  before(async () => {
    ({ order } = await createDepositOrder(500000));
  });

  it('chưa đủ cọc: không xác nhận / sản xuất / đánh dấu đã thanh toán được', async () => {
    assert.equal((await api('PATCH', `/orders/${order.orderNumber}/confirm`, { token: tok.manager })).status, 400);
    assert.equal((await api('PATCH', `/orders/${order.orderNumber}/production`, { token: tok.manager, body: { status: 'IN_PRODUCTION' } })).status, 400);
    assert.equal((await api('PATCH', `/orders/${order.orderNumber}/payment-status`, { token: tok.manager, body: { paymentStatus: 'PAID' } })).status, 400);
  });

  it('khách không giả mạo được thanh toán', async () => {
    assert.equal((await api('PATCH', `/orders/${order.orderNumber}/payment-status`, { token: tok.alice, body: { paymentStatus: 'PAID' } })).status, 401);
    assert.equal((await api('PATCH', `/orders/${order.orderNumber}/confirm-payment`, { token: tok.alice, body: {} })).status, 400);
    assert.equal((await api('POST', '/payments/momo/create', { body: { orderNumber: order.orderNumber } })).status, 400);
    assert.equal((await api('POST', '/payments/zalopay/create', { body: { orderNumber: order.orderNumber } })).status, 400);
    assert.notEqual((await api('POST', '/payments/sandbox/confirm', { body: { orderNumber: order.orderNumber } })).status, 200);
    assert.equal((await api('PATCH', `/orders/${order.orderNumber}/payment-method`, { token: tok.alice, body: { paymentMethod: 'MOMO' } })).status, 400);
    const fresh = await model('Order').findOne({ orderNumber: order.orderNumber }).lean();
    assert.equal(fresh.depositStatus, 'UNPAID');
    assert.equal(fresh.paymentStatus, 'UNPAID');
  });

  let txn1;
  it('khách báo chuyển -> VERIFYING (chưa coi là đã nhận); không báo chồng; khách khác không báo được', async () => {
    assert.equal((await api('POST', `/orders/${order.orderNumber}/deposit/report`, { token: tok.bob, body: { amount: 200000 } })).status, 404);
    const r = await api('POST', `/orders/${order.orderNumber}/deposit/report`, { token: tok.alice, body: { amount: 200000, note: 'FT123' } });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(r.data.order.depositStatus, 'VERIFYING');
    assert.equal(r.data.order.depositReceived, 0);
    assert.ok(r.data.order.paymentPlan.verifySlaAt);
    assert.equal((await api('POST', `/orders/${order.orderNumber}/deposit/report`, { token: tok.alice, body: { amount: 1 } })).status, 409);
    const ledger = await api('GET', `/orders/${order.orderNumber}/deposit`, { token: tok.manager });
    txn1 = ledger.data.transactions.find(t => t.status === 'REPORTED');
    assert.ok(txn1);
  });

  it('không có quyền orders.approve thì không đối soát được', async () => {
    const res = await api('PATCH', `/orders/${order.orderNumber}/deposit/transactions/${txn1._id}/confirm`, { token: tok.care, body: { receivedAmount: 200000, bankTxnRef: 'FT0001' } });
    assert.equal(res.status, 403);
  });

  it('2 nhân viên xác nhận cùng lúc cùng 1 khoản: chỉ 1 lần thành công; nhận thiếu -> UNPAID, hiện số đã nhận', async () => {
    const body = { receivedAmount: 200000, bankTxnRef: 'ft 0001' };
    const [a, b] = await Promise.all([
      api('PATCH', `/orders/${order.orderNumber}/deposit/transactions/${txn1._id}/confirm`, { token: tok.manager, body }),
      api('PATCH', `/orders/${order.orderNumber}/deposit/transactions/${txn1._id}/confirm`, { token: tok.super, body }),
    ]);
    assert.deepEqual([a.status, b.status].sort(), [200, 409]);
    const fresh = await model('Order').findOne({ orderNumber: order.orderNumber }).lean();
    assert.equal(fresh.depositReceived, 200000);
    assert.equal(fresh.depositStatus, 'UNPAID');
    const audit = await model('AuditLog').findOne({ action: 'Xác nhận tiền cọc', detail: new RegExp(order.orderNumber) }).lean();
    assert.ok(audit);
  });

  it('cùng 1 mã giao dịch ngân hàng không ghi nhận được 2 lần (kể cả ở đơn khác)', async () => {
    await api('POST', `/orders/${order.orderNumber}/deposit/report`, { token: tok.alice, body: { amount: 50000 } });
    const ledger = await api('GET', `/orders/${order.orderNumber}/deposit`, { token: tok.manager });
    const txn2 = ledger.data.transactions.find(t => t.status === 'REPORTED');
    const dup = await api('PATCH', `/orders/${order.orderNumber}/deposit/transactions/${txn2._id}/confirm`, { token: tok.manager, body: { receivedAmount: 50000, bankTxnRef: 'FT0001' } });
    assert.equal(dup.status, 409);
    const { order: other } = await createDepositOrder(300000);
    const dupOther = await api('POST', `/orders/${other.orderNumber}/deposit/transactions`, { token: tok.manager, body: { receivedAmount: 200000, bankTxnRef: 'FT0001' } });
    assert.equal(dupOther.status, 409);
    // Khoản thứ 2 chỉ đủ 250k khi cộng: 200k + 50k
    const ok = await api('PATCH', `/orders/${order.orderNumber}/deposit/transactions/${txn2._id}/confirm`, { token: tok.manager, body: { receivedAmount: 50000, bankTxnRef: 'FT0002' } });
    assert.equal(ok.status, 200);
    assert.equal(ok.data.order.depositStatus, 'PAID');
    assert.equal(ok.data.order.depositReceived, 250000);
  });

  it('đủ cọc mới được sản xuất: ghi thời điểm bắt đầu + audit; không chuyển ngược', async () => {
    const res = await api('PATCH', `/orders/${order.orderNumber}/confirm`, { token: tok.manager });
    assert.equal(res.status, 200, JSON.stringify(res.data));
    assert.equal(res.data.order.status, 'IN_PRODUCTION');
    assert.ok(res.data.order.productionStartedAt);
    assert.ok(await model('AuditLog').findOne({ action: 'Bắt đầu sản xuất', detail: new RegExp(order.orderNumber) }).lean());
    assert.equal((await api('PATCH', `/orders/${order.orderNumber}/production`, { token: tok.manager, body: { status: 'PENDING' } })).status, 400);
    assert.equal((await api('PATCH', `/orders/${order.orderNumber}/production`, { token: tok.manager, body: { status: 'CONFIRMED' } })).status, 400);
  });

  it('khách không tự huỷ được đơn đã vào sản xuất', async () => {
    const res = await api('PATCH', `/orders/${order.orderNumber}/cancel`, { token: tok.alice, body: { reason: 'Tôi không có nhu cầu mua nữa' } });
    assert.equal(res.status, 400);
  });
});

// ------------------------------------------------------------------------------------------------
describe('P0.5 Hết hạn cọc', () => {
  const past = () => new Date(Date.now() - 60 * 1000);

  it('quá hạn, chưa nhận đồng nào -> tự huỷ; yêu cầu quay về đang trao đổi', async () => {
    const { request, order } = await createDepositOrder(300000);
    await model('Order').updateOne({ orderNumber: order.orderNumber }, { $set: { 'paymentPlan.deadlineAt': past() } });
    const mine = await api('GET', '/orders/mine', { token: tok.alice });
    const o = mine.data.orders.find(x => x.orderNumber === order.orderNumber);
    assert.equal(o.status, 'CANCELLED');
    assert.match(o.cancelReason, /quá hạn/);
    const r = await model('CustomRequest').findOne({ id: request.id }).lean();
    assert.equal(r.status, 'IN_DISCUSSION');
    assert.equal(r.orderNumber, null);
    assert.equal((await api('POST', `/orders/${order.orderNumber}/deposit/report`, { token: tok.alice, body: { amount: 200000 } })).status, 400);
  });

  it('đang đối soát (VERIFYING) thì không tự huỷ dù đã quá hạn', async () => {
    const { order } = await createDepositOrder(300000);
    await api('POST', `/orders/${order.orderNumber}/deposit/report`, { token: tok.alice, body: { amount: 200000 } });
    await model('Order').updateOne({ orderNumber: order.orderNumber }, { $set: { 'paymentPlan.deadlineAt': past() } });
    await api('GET', '/orders/mine', { token: tok.alice });
    const o = await model('Order').findOne({ orderNumber: order.orderNumber }).lean();
    assert.equal(o.status, 'PENDING');
    assert.equal(o.depositStatus, 'VERIFYING');
  });

  it('bị từ chối sau hạn -> tự gia hạn 12h đúng 1 lần; lần từ chối sau không gia hạn nữa', async () => {
    const { order } = await createDepositOrder(300000);
    await api('POST', `/orders/${order.orderNumber}/deposit/report`, { token: tok.alice, body: { amount: 200000 } });
    await model('Order').updateOne({ orderNumber: order.orderNumber }, { $set: { 'paymentPlan.deadlineAt': past() } });
    let ledger = await api('GET', `/orders/${order.orderNumber}/deposit`, { token: tok.manager });
    let txn = ledger.data.transactions.find(t => t.status === 'REPORTED');
    assert.equal((await api('PATCH', `/orders/${order.orderNumber}/deposit/transactions/${txn._id}/reject`, { token: tok.manager, body: { reason: '' } })).status, 400, 'bắt buộc lý do');
    const rej = await api('PATCH', `/orders/${order.orderNumber}/deposit/transactions/${txn._id}/reject`, { token: tok.manager, body: { reason: 'Không thấy tiền trên sao kê' } });
    assert.equal(rej.status, 200);
    assert.equal(rej.data.order.depositStatus, 'UNPAID');
    assert.equal(rej.data.order.paymentPlan.graceUsed, true);
    const hoursLeft = (new Date(rej.data.order.paymentPlan.deadlineAt) - Date.now()) / 3600000;
    assert.ok(hoursLeft > 11.9 && hoursLeft <= 12, `còn ${hoursLeft}h`);
    const stillThere = await model('PaymentTransaction').findById(txn._id).lean();
    assert.equal(stillThere.status, 'REJECTED', 'không xoá lịch sử đối soát');

    await api('POST', `/orders/${order.orderNumber}/deposit/report`, { token: tok.alice, body: { amount: 200000 } });
    await model('Order').updateOne({ orderNumber: order.orderNumber }, { $set: { 'paymentPlan.deadlineAt': past() } });
    ledger = await api('GET', `/orders/${order.orderNumber}/deposit`, { token: tok.manager });
    txn = ledger.data.transactions.find(t => t.status === 'REPORTED');
    const rej2 = await api('PATCH', `/orders/${order.orderNumber}/deposit/transactions/${txn._id}/reject`, { token: tok.manager, body: { reason: 'Vẫn không thấy tiền' } });
    assert.ok(new Date(rej2.data.order.paymentPlan.deadlineAt).getTime() < Date.now(), 'không gia hạn tự động lần 2');
    const after2 = await api('GET', `/orders/by-number/${order.orderNumber}`, { token: tok.alice });
    assert.equal(after2.data.order.status, 'CANCELLED');
  });

  it('quá hạn nhưng đã nhận một phần -> KHÔNG huỷ, chờ xử lý thủ công', async () => {
    const { order } = await createDepositOrder(500000);
    await api('POST', `/orders/${order.orderNumber}/deposit/transactions`, { token: tok.manager, body: { receivedAmount: 100000, bankTxnRef: 'FTPART01' } });
    await model('Order').updateOne({ orderNumber: order.orderNumber }, { $set: { 'paymentPlan.deadlineAt': past() } });
    const res = await api('GET', `/orders/by-number/${order.orderNumber}`, { token: tok.alice });
    assert.equal(res.data.order.status, 'PENDING');
    assert.equal(res.data.order.depositReceived, 100000);
    assert.equal(res.data.order.paymentPlan.expiredWithFunds, true);
  });

  it('nhân viên gia hạn: cần quyền + lý do + giới hạn giờ, có audit', async () => {
    const { order } = await createDepositOrder(300000);
    assert.equal((await api('PATCH', `/orders/${order.orderNumber}/deposit/extend`, { token: tok.care, body: { hours: 12, reason: 'Khách xin thêm thời gian' } })).status, 403);
    assert.equal((await api('PATCH', `/orders/${order.orderNumber}/deposit/extend`, { token: tok.manager, body: { hours: 12, reason: '' } })).status, 400);
    assert.equal((await api('PATCH', `/orders/${order.orderNumber}/deposit/extend`, { token: tok.manager, body: { hours: 500, reason: 'Khách xin thêm thời gian' } })).status, 400);
    const ok = await api('PATCH', `/orders/${order.orderNumber}/deposit/extend`, { token: tok.manager, body: { hours: 12, reason: 'Khách xin thêm thời gian' } });
    assert.equal(ok.status, 200);
    assert.equal(ok.data.order.paymentPlan.extensions.length, 1);
    assert.ok(await model('AuditLog').findOne({ action: 'Gia hạn trả cọc', detail: new RegExp(order.orderNumber) }).lean());
  });

  it('khách không báo chuyển quá 5 lần (chặn giữ đơn bằng báo giả)', async () => {
    const { order } = await createDepositOrder(300000);
    for (let i = 0; i < 5; i++) {
      const r = await api('POST', `/orders/${order.orderNumber}/deposit/report`, { token: tok.alice, body: { amount: 200000 } });
      assert.equal(r.status, 200, `lần ${i + 1}`);
      const ledger = await api('GET', `/orders/${order.orderNumber}/deposit`, { token: tok.manager });
      const txn = ledger.data.transactions.find(t => t.status === 'REPORTED');
      await api('PATCH', `/orders/${order.orderNumber}/deposit/transactions/${txn._id}/reject`, { token: tok.manager, body: { reason: 'Không thấy tiền về' } });
    }
    const sixth = await api('POST', `/orders/${order.orderNumber}/deposit/report`, { token: tok.alice, body: { amount: 200000 } });
    assert.equal(sixth.status, 400);
    assert.match(sixth.data.error, /quá số lần/);
  });
});

// ------------------------------------------------------------------------------------------------
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

// ------------------------------------------------------------------------------------------------
describe('P0 Huỷ và hoàn tiền đơn đặt làm', () => {
  it('đang đối soát thì khách chưa huỷ được; đã nhận cọc thì phải nhập tài khoản nhận hoàn; hoàn 100%', async () => {
    const { request, order } = await createDepositOrder(500000);
    await api('POST', `/orders/${order.orderNumber}/deposit/report`, { token: tok.alice, body: { amount: 100000 } });
    const reason = 'Tôi không có nhu cầu mua nữa';
    assert.equal((await api('PATCH', `/orders/${order.orderNumber}/cancel`, { token: tok.alice, body: { reason } })).status, 400);
    const ledger = await api('GET', `/orders/${order.orderNumber}/deposit`, { token: tok.manager });
    const txn = ledger.data.transactions.find(t => t.status === 'REPORTED');
    await api('PATCH', `/orders/${order.orderNumber}/deposit/transactions/${txn._id}/confirm`, { token: tok.manager, body: { receivedAmount: 100000, bankTxnRef: 'FTCANCEL1' } });
    assert.equal((await api('PATCH', `/orders/${order.orderNumber}/cancel`, { token: tok.alice, body: { reason } })).status, 400, 'thiếu tài khoản nhận hoàn');
    const res = await api('PATCH', `/orders/${order.orderNumber}/cancel`, {
      token: tok.alice, body: { reason, refundBank: { bankName: 'ACB', bankAccount: '123456789', accountHolder: 'Alice Test' } },
    });
    assert.equal(res.status, 200, JSON.stringify(res.data));
    assert.equal(res.data.order.status, 'CANCELLED');
    assert.equal(res.data.order.refund.amount, 100000);
    assert.equal(res.data.order.depositStatus, 'REFUND_PENDING');
    const r = await model('CustomRequest').findOne({ id: request.id }).lean();
    assert.equal(r.status, 'IN_DISCUSSION');
  });

  it('nhân viên huỷ đơn đã cọc đủ: tạo hoàn; hoàn ít hơn phải có lý do; REFUNDED chỉ khi hoàn xong; có audit', async () => {
    const { order } = await createDepositOrder(500000);
    await api('POST', `/orders/${order.orderNumber}/deposit/transactions`, { token: tok.manager, body: { receivedAmount: 250000, bankTxnRef: 'FTCANCEL2' } });
    const cancel = await api('PATCH', `/orders/${order.orderNumber}/production`, { token: tok.manager, body: { status: 'CANCELLED', cancelReason: 'Xưởng không làm được vật liệu này' } });
    assert.equal(cancel.status, 200);
    assert.equal(cancel.data.order.depositStatus, 'REFUND_PENDING');
    assert.equal(cancel.data.order.refund.amount, 250000);
    assert.notEqual(cancel.data.order.paymentStatus, 'REFUNDED');
    assert.ok(await model('AuditLog').findOne({ action: 'Huỷ đơn đặt làm', detail: new RegExp(order.orderNumber) }).lean());

    const partialNoReason = await api('PATCH', `/orders/${order.orderNumber}/refund`, { token: tok.manager, body: { action: 'complete', transactionRef: 'RF1', amount: 200000 } });
    assert.equal(partialNoReason.status, 400);
    const over = await api('PATCH', `/orders/${order.orderNumber}/refund`, { token: tok.manager, body: { action: 'complete', transactionRef: 'RF1', amount: 300000 } });
    assert.equal(over.status, 400);
    const done = await api('PATCH', `/orders/${order.orderNumber}/refund`, { token: tok.manager, body: { action: 'complete', transactionRef: 'RF1', amount: 200000, adminNote: 'Giữ 50k phí thiết kế đã thực hiện theo điều khoản' } });
    assert.equal(done.status, 200);
    assert.equal(done.data.order.depositStatus, 'PARTIALLY_REFUNDED');
    assert.ok(await model('AuditLog').findOne({ action: 'Hoàn tiền cọc', detail: new RegExp(order.orderNumber) }).lean());
  });

  it('frontend không tự chuyển được sang đã hoàn tiền', async () => {
    const { order } = await createDepositOrder(300000);
    assert.equal((await api('PATCH', `/orders/${order.orderNumber}/refund`, { token: tok.alice, body: { action: 'complete', transactionRef: 'X' } })).status, 401);
    assert.equal((await api('PATCH', `/orders/${order.orderNumber}/payment-status`, { token: tok.manager, body: { paymentStatus: 'REFUNDED' } })).status, 400);
  });
});

// ------------------------------------------------------------------------------------------------
describe('Trả cọc qua cổng MoMo / ZaloPay (tự động xác nhận, không cần nhân viên)', () => {
  const crypto = require('crypto');
  const hmac = (data, key) => crypto.createHmac('sha256', key).update(data).digest('hex');
  /** Ký giống MoMo (khoá test do harness đặt cho server). */
  function signedMomo(fields) {
    const b = { accessKey: 'test-access', extraData: '', message: 'Successful.', orderInfo: 'Coc', orderType: 'momo_wallet', partnerCode: 'TESTPARTNER', payType: 'qr', requestId: 'r1', responseTime: Date.now(), ...fields };
    const raw = `accessKey=${b.accessKey}&amount=${b.amount}&extraData=${b.extraData}&message=${b.message}&orderId=${b.orderId}&orderInfo=${b.orderInfo}` +
      `&orderType=${b.orderType}&partnerCode=${b.partnerCode}&payType=${b.payType}&requestId=${b.requestId}&responseTime=${b.responseTime}` +
      `&resultCode=${b.resultCode}&transId=${b.transId}`;
    return { ...b, signature: hmac(raw, 'test-momo-secret') };
  }
  const ledger = async (n) => (await api('GET', `/orders/${n}/deposit`, { token: tok.manager })).data;
  const initiated = (order, gateway, gatewayRef, expectedAmount) => model('PaymentTransaction').create({
    orderNumber: order.orderNumber, purpose: 'DEPOSIT', status: 'INITIATED', source: 'GATEWAY', gateway, gatewayRef, expectedAmount,
  });

  it('chỉ chủ đơn mở được lượt trả cọc; số tiền = phần cọc còn thiếu do server tính', async () => {
    const { order } = await createDepositOrder(500000);
    const n = order.orderNumber;
    assert.equal((await api('POST', '/payments/deposit/create', { body: { orderNumber: n, method: 'momo' } })).status, 401);
    assert.equal((await api('POST', '/payments/deposit/create', { token: tok.bob, body: { orderNumber: n, method: 'momo' } })).status, 404);
    assert.equal((await api('POST', '/payments/deposit/create', { token: tok.alice, body: { orderNumber: n, method: 'cash' } })).status, 400);
    await api('POST', `/orders/${n}/deposit/transactions`, { token: tok.manager, body: { receivedAmount: 100000, bankTxnRef: 'FTGW-PART' } });
    const res = await api('POST', '/payments/deposit/create', { token: tok.alice, body: { orderNumber: n, method: 'momo', amount: 1 } });
    assert.equal(res.status, 200, JSON.stringify(res.data));
    assert.equal(res.data.amount, 150000, 'cọc 250k - đã nhận 100k');
  });

  it('cổng thử (demo): thanh toán xong đơn tự chuyển "Đã cọc", gắn cờ giao dịch thử; gọi lại không cộng 2 lần', async () => {
    const { order } = await createDepositOrder(500000);
    const n = order.orderNumber;
    const res = await api('POST', '/payments/deposit/create', { token: tok.alice, body: { orderNumber: n, method: 'momo' } });
    assert.equal(res.data.sandbox, true);
    const depositRef = new URL(res.data.payUrl).searchParams.get('deposit');
    assert.match(depositRef, /^SBX-/);
    assert.equal((await api('POST', '/payments/sandbox/confirm', { body: { orderNumber: 'ORD-KHAC', action: 'pay', depositRef } })).status, 404);
    const paid = await api('POST', '/payments/sandbox/confirm', { body: { orderNumber: n, action: 'pay', depositRef } });
    assert.equal(paid.status, 200);
    assert.equal(paid.data.paid, true);
    await api('POST', '/payments/sandbox/confirm', { body: { orderNumber: n, action: 'pay', depositRef } });
    const data = await ledger(n);
    assert.equal(data.order.depositStatus, 'PAID');
    assert.equal(data.order.depositReceived, 250000);
    const txn = data.transactions.find(t => t.gatewayRef === depositRef);
    assert.equal(txn.status, 'CONFIRMED');
    assert.equal(txn.source, 'GATEWAY');
    assert.equal(txn.sandbox, true);
    assert.match(txn.verifiedByName, /tự động/);
    assert.equal((await api('POST', '/payments/deposit/create', { token: tok.alice, body: { orderNumber: n, method: 'zalopay' } })).status, 400, 'đã đủ cọc');
    assert.equal((await api('PATCH', `/orders/${n}/confirm`, { token: tok.manager })).status, 200, 'đủ cọc qua cổng -> sản xuất được ngay');
  });

  it('khách huỷ ở cổng: lượt trả FAILED, đơn vẫn chờ cọc', async () => {
    const { order } = await createDepositOrder(300000);
    const res = await api('POST', '/payments/deposit/create', { token: tok.alice, body: { orderNumber: order.orderNumber, method: 'zalopay' } });
    const depositRef = new URL(res.data.orderUrl).searchParams.get('deposit');
    const c = await api('POST', '/payments/sandbox/confirm', { body: { orderNumber: order.orderNumber, action: 'cancel', depositRef } });
    assert.equal(c.data.paid, false);
    const data = await ledger(order.orderNumber);
    assert.equal(data.order.depositStatus, 'UNPAID');
    assert.equal(data.transactions.find(t => t.gatewayRef === depositRef).status, 'FAILED');
  });

  it('IPN MoMo: sai chữ ký bị từ chối; sai số tiền không được ghi nhận', async () => {
    const { order } = await createDepositOrder(500000);
    const ref = `${order.orderNumber}-CTEST1`;
    await initiated(order, 'MOMO', ref, 250000);
    const forged = { ...signedMomo({ orderId: ref, amount: 250000, resultCode: 0, transId: 111 }), signature: 'gia-mao' };
    assert.equal((await api('POST', '/payments/momo/ipn', { body: forged })).status, 400);
    await api('POST', '/payments/momo/ipn', { body: signedMomo({ orderId: ref, amount: 1000, resultCode: 0, transId: 112 }) });
    const data = await ledger(order.orderNumber);
    assert.equal(data.order.depositReceived, 0);
    assert.equal(data.order.depositStatus, 'UNPAID');
    assert.equal(data.transactions.find(t => t.gatewayRef === ref).status, 'FAILED');
  });

  it('IPN MoMo hợp lệ -> tự xác nhận; IPN lặp + trang quay về đến cùng lúc vẫn chỉ cộng 1 lần', async () => {
    const { order } = await createDepositOrder(500000);
    const ref = `${order.orderNumber}-CTEST2`;
    await initiated(order, 'MOMO', ref, 250000);
    const ipn = signedMomo({ orderId: ref, amount: 250000, resultCode: 0, transId: 9988 });
    const results = await Promise.all([
      api('POST', '/payments/momo/ipn', { body: ipn }),
      api('POST', '/payments/momo/ipn', { body: ipn }),
      api('POST', '/payments/momo/verify-return', { body: ipn }),
    ]);
    for (const r of results) assert.equal(r.status, 200);
    assert.equal(results[2].data.orderNumber, order.orderNumber, 'trang quay về nhận đúng mã đơn của shop');
    assert.equal(results[2].data.paid, true);
    const data = await ledger(order.orderNumber);
    assert.equal(data.order.depositReceived, 250000);
    assert.equal(data.order.depositStatus, 'PAID');
    assert.equal(data.transactions.filter(t => t.status === 'CONFIRMED').length, 1);
  });

  it('callback ZaloPay hợp lệ -> tự xác nhận; sai mac bị từ chối', async () => {
    const { order } = await createDepositOrder(300000);
    const ref = '261110_TEST01';
    await initiated(order, 'ZALOPAY', ref, 200000);
    const dataStr = JSON.stringify({ app_trans_id: ref, amount: 200000, zp_trans_id: 777 });
    assert.equal((await api('POST', '/payments/zalopay/callback', { body: { data: dataStr, mac: 'sai' } })).data.return_code, -1);
    assert.equal((await api('POST', '/payments/zalopay/callback', { body: { data: dataStr, mac: hmac(dataStr, 'test-zp-key2') } })).data.return_code, 1);
    const data = await ledger(order.orderNumber);
    assert.equal(data.order.depositStatus, 'PAID');
    assert.equal(data.order.depositReceived, 200000);
  });

  it('đang có khoản chuyển khoản chờ đối soát thì không mở thêm lượt trả qua cổng (tránh trả 2 lần)', async () => {
    const { order } = await createDepositOrder(300000);
    await api('POST', `/orders/${order.orderNumber}/deposit/report`, { token: tok.alice, body: { amount: 200000 } });
    assert.equal((await api('POST', '/payments/deposit/create', { token: tok.alice, body: { orderNumber: order.orderNumber, method: 'momo' } })).status, 409);
  });

  it('tiền qua cổng về sau khi đơn đã huỷ -> vẫn ghi nhận và tự tạo yêu cầu hoàn tiền', async () => {
    const { order } = await createDepositOrder(300000);
    const ref = `${order.orderNumber}-CLATE`;
    await initiated(order, 'MOMO', ref, 200000);
    await api('PATCH', `/orders/${order.orderNumber}/cancel`, { token: tok.alice, body: { reason: 'Tôi không có nhu cầu mua nữa' } });
    await api('POST', '/payments/momo/ipn', { body: signedMomo({ orderId: ref, amount: 200000, resultCode: 0, transId: 5555 }) });
    const o = await model('Order').findOne({ orderNumber: order.orderNumber }).lean();
    assert.equal(o.status, 'CANCELLED');
    assert.equal(o.depositReceived, 200000);
    assert.equal(o.depositStatus, 'REFUND_PENDING');
    assert.equal(o.refund.amount, 200000);
  });
});
