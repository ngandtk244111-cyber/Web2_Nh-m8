// Unit test luật trạng thái cọc / hết hạn / chặn sản xuất — hàm thuần, không cần database.
const test = require('node:test');
const assert = require('node:assert/strict');
const { computeDepositState, isDepositExpired, productionBlockReason } = require('../../utils/custom-order');

const HOUR = 3600 * 1000;
const now = new Date('2026-11-10T10:00:00Z');
const plan = (extra = {}) => ({ type: 'DEPOSIT', depositAmount: 500000, deadlineAt: new Date(now.getTime() + 20 * HOUR), graceUsed: false, ...extra });

test('ví dụ chuyển nhiều lần: 200k -> 350k -> 500k thì mới PAID', () => {
  let s = computeDepositState({ plan: plan(), depositStatus: 'VERIFYING', received: 200000, now });
  assert.equal(s.depositStatus, 'UNPAID');
  assert.equal(s.depositReceived, 200000);
  s = computeDepositState({ plan: plan(), depositStatus: 'UNPAID', received: 350000, now });
  assert.equal(s.depositStatus, 'UNPAID');
  s = computeDepositState({ plan: plan(), depositStatus: 'VERIFYING', received: 500000, now });
  assert.equal(s.depositStatus, 'PAID');
  assert.ok(s['paymentPlan.depositPaidAt']);
});

test('đang có khoản chờ đối soát -> VERIFYING, giữ số đã xác nhận, SLA 48h từ lần báo sớm nhất', () => {
  const reportedAt = new Date(now.getTime() - 2 * HOUR);
  const s = computeDepositState({ plan: plan(), depositStatus: 'UNPAID', received: 200000, pendingReportedAts: [reportedAt, now], now });
  assert.equal(s.depositStatus, 'VERIFYING');
  assert.equal(s.depositReceived, 200000);
  assert.equal(s['paymentPlan.verifySlaAt'].getTime(), reportedAt.getTime() + 48 * HOUR);
});

test('bị từ chối / chưa đủ sau đối soát: tự gia hạn 12h đúng 1 lần, chỉ khi hạn cũ còn ít hơn 12h', () => {
  const late = plan({ deadlineAt: new Date(now.getTime() - HOUR) });
  const s = computeDepositState({ plan: late, depositStatus: 'VERIFYING', received: 0, now });
  assert.equal(s['paymentPlan.deadlineAt'].getTime(), now.getTime() + 12 * HOUR);
  assert.equal(s['paymentPlan.graceUsed'], true);

  const used = computeDepositState({ plan: { ...late, graceUsed: true }, depositStatus: 'VERIFYING', received: 0, now });
  assert.equal(used['paymentPlan.deadlineAt'], undefined, 'đã dùng gia hạn tự động thì không cộng nữa');

  const roomy = computeDepositState({ plan: plan(), depositStatus: 'VERIFYING', received: 0, now });
  assert.equal(roomy['paymentPlan.deadlineAt'], undefined, 'hạn còn > 12h thì giữ nguyên, không tiêu lượt gia hạn');
});

test('đã vào luồng hoàn tiền thì chỉ cập nhật số tiền, không đổi trạng thái', () => {
  const s = computeDepositState({ plan: plan(), depositStatus: 'REFUND_PENDING', received: 500000, now });
  assert.equal(s.depositStatus, undefined);
  assert.equal(s.depositReceived, 500000);
});

test('hết hạn chỉ áp dụng cho đơn cọc PENDING + UNPAID quá hạn; VERIFYING không hết hạn', () => {
  const base = { orderType: 'CUSTOM_QUOTE', status: 'PENDING', depositStatus: 'UNPAID', paymentPlan: plan({ deadlineAt: new Date(now.getTime() - 1) }) };
  assert.equal(isDepositExpired(base, now), true);
  assert.equal(isDepositExpired({ ...base, depositStatus: 'VERIFYING' }, now), false);
  assert.equal(isDepositExpired({ ...base, status: 'CANCELLED' }, now), false);
  assert.equal(isDepositExpired({ ...base, paymentPlan: plan() }, now), false);
  assert.equal(isDepositExpired({ ...base, orderType: 'STANDARD' }, now), false);
});

test('chặn sản xuất: đơn cọc chưa PAID, đơn in 3D (quy tắc mới) chưa thanh toán đủ', () => {
  const deposit = { orderType: 'CUSTOM_QUOTE', depositStatus: 'UNPAID', depositReceived: 200000, paymentPlan: plan() };
  assert.match(productionBlockReason(deposit), /còn thiếu 300\.000đ/);
  assert.equal(productionBlockReason({ ...deposit, depositStatus: 'PAID', depositReceived: 500000 }), null);
  assert.match(productionBlockReason({ ...deposit, depositStatus: 'PAID', paymentPlan: plan({ expiredWithFunds: true }) }), /quá hạn/);

  const pod = { orderType: 'STANDARD', hasPrintOnDemandItems: true, paymentPolicyVersion: 2, paymentStatus: 'UNPAID' };
  assert.match(productionBlockReason(pod), /100%/);
  assert.equal(productionBlockReason({ ...pod, paymentStatus: 'PAID' }), null);
  // Đơn cũ (trước quy tắc mới) giữ nguyên hành vi cũ.
  assert.equal(productionBlockReason({ ...pod, paymentPolicyVersion: 1 }), null);
  assert.equal(productionBlockReason({ orderType: 'STANDARD', hasPrintOnDemandItems: false, paymentStatus: 'UNPAID' }), null);
});
