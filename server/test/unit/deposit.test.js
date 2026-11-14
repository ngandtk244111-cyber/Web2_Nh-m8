// Unit test hàm thuần tính tiền cọc / báo giá — không cần database.
// Chạy: npm run test:unit (trong thư mục server)
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_DEPOSIT_POLICY, computeDefaultDeposit, resolveQuoteDeposit, priceQuoteItems, normalizePolicy, roundUpTo,
} = require('../../utils/deposit');

test('cọc mặc định 50%, tối thiểu 200.000đ, không vượt tổng (bảng ví dụ đặc tả)', () => {
  const cases = [
    [150000, 150000],
    [300000, 200000],
    [500000, 250000],
    [900000, 450000],
    [2000000, 1000000],
    [5000000, 2500000],
  ];
  for (const [total, expected] of cases) {
    assert.equal(computeDefaultDeposit(total, DEFAULT_DEPOSIT_POLICY), expected, `total ${total}`);
  }
});

test('cọc làm tròn lên bội số 1.000đ và không vượt tổng tiền hàng', () => {
  assert.equal(computeDefaultDeposit(1234567), 618000); // 617.283,5 -> 618.000
  assert.equal(computeDefaultDeposit(400001), 201000); // 200.000,5 -> 201.000
  assert.equal(computeDefaultDeposit(200500), 200000); // max(100.250, 200.000) = 200.000 <= tổng
  assert.equal(computeDefaultDeposit(199999), 199999); // tổng nhỏ hơn mức tối thiểu -> trả đủ tổng
  assert.equal(computeDefaultDeposit(0), 0);
  assert.equal(roundUpTo(1), 1000);
  assert.equal(roundUpTo(1000), 1000);
});

test('tiền cọc chỉ nhận tổng là số nguyên không âm', () => {
  assert.throws(() => computeDefaultDeposit(-1));
  assert.throws(() => computeDefaultDeposit(100.5));
  assert.throws(() => computeDefaultDeposit('500000'));
});

test('đổi mức cọc theo báo giá (phương án C): bắt buộc lý do, không vượt tổng, tôn trọng cấu hình', () => {
  const policy = { ...DEFAULT_DEPOSIT_POLICY };
  const ok = resolveQuoteDeposit(1000000, policy, { amount: 700000, reason: 'Vật liệu gỗ óc chó đặt riêng' });
  assert.deepEqual([ok.amount, ok.overridden], [700000, true]);
  assert.throws(() => resolveQuoteDeposit(1000000, policy, { amount: 700000, reason: '' }), /lý do/);
  assert.throws(() => resolveQuoteDeposit(1000000, policy, { amount: 1000001, reason: 'quá tổng tiền' }), /lớn hơn/);
  assert.throws(() => resolveQuoteDeposit(1000000, policy, { amount: 0, reason: 'không cọc đồng nào' }), /dương/);
  assert.throws(() => resolveQuoteDeposit(1000000, { ...policy, allowDepositOverride: false }, { amount: 700000, reason: 'Vật liệu đặc biệt' }), /không cho phép/);
  const def = resolveQuoteDeposit(1000000, policy, null);
  assert.deepEqual([def.amount, def.overridden], [500000, false]);
});

test('báo giá: server tự tính thành tiền / tổng, bỏ qua số tiền client gửi', () => {
  const priced = priceQuoteItems([
    { name: 'Kệ gỗ', quantity: 2, unitPrice: 300000, discount: 50000, lineTotal: 1, total: 1 },
    { name: 'Đèn', quantity: 1, unitPrice: 200000 },
  ], 50000);
  assert.equal(priced.subtotal, 800000);
  assert.equal(priced.itemDiscountTotal, 50000);
  assert.equal(priced.quoteDiscount, 50000);
  assert.equal(priced.total, 700000);
  assert.equal(priced.items[0].lineTotal, 550000);
});

test('báo giá: từ chối dữ liệu sai', () => {
  assert.throws(() => priceQuoteItems([]), /ít nhất 1/);
  assert.throws(() => priceQuoteItems([{ name: '', quantity: 1, unitPrice: 1 }]), /tên/);
  assert.throws(() => priceQuoteItems([{ name: 'A', quantity: 0, unitPrice: 1 }]), /số lượng/);
  assert.throws(() => priceQuoteItems([{ name: 'A', quantity: 1, unitPrice: -5 }]), /đơn giá/);
  assert.throws(() => priceQuoteItems([{ name: 'A', quantity: 1, unitPrice: 100, discount: 101 }]), /chiết khấu/);
  assert.throws(() => priceQuoteItems([{ name: 'A', quantity: 1, unitPrice: 100 }], 101), /Chiết khấu toàn/);
  assert.throws(() => priceQuoteItems([{ name: 'A', quantity: 1, unitPrice: 100, discount: 100 }]), /lớn hơn 0/);
});

test('cấu hình cọc sai kiểu / ngoài khoảng thì dùng mặc định', () => {
  assert.deepEqual(normalizePolicy({}), { ...DEFAULT_DEPOSIT_POLICY });
  const p = normalizePolicy({ defaultDepositRate: 'abc', minimumDepositAmount: -1, quoteValidityDays: 0, depositPaymentDeadlineHours: 1.5, allowDepositOverride: 'yes' });
  assert.deepEqual(p, { ...DEFAULT_DEPOSIT_POLICY });
  const q = normalizePolicy({ defaultDepositRate: 30, minimumDepositAmount: 100000, quoteValidityDays: 10, depositPaymentDeadlineHours: 48, allowDepositOverride: false });
  assert.deepEqual(q, { defaultDepositRate: 30, minimumDepositAmount: 100000, quoteValidityDays: 10, depositPaymentDeadlineHours: 48, allowDepositOverride: false });
});
