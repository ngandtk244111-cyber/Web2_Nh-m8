// Hai quy định đặt cọc ĐỘC LẬP, dùng field khác nhau trên Order:
//  1. Cọc COD đơn lớn (đơn mua từ giỏ hàng): order.depositAmount / order.depositPaidAt.
//  2. Cọc đơn đặt làm theo báo giá (orderType CUSTOM_QUOTE): order.paymentPlan.*, depositStatus, depositReceived.

// ================================================================ 1. Cọc COD đơn lớn
// Quy định đặt cọc đơn COD giá trị lớn (nội thất cồng kềnh, giao xa — tránh bom hàng):
// đơn COD từ 5.000.000đ phải chuyển khoản cọc trước 30% (làm tròn nghìn), phần còn lại trả khi nhận.
// Đơn nhỏ hơn vẫn COD 100% như cũ. my-client (core/data/deposit-policy.ts) và chatbot dùng cùng số này.
const DEPOSIT_THRESHOLD = 5000000;
const DEPOSIT_RATE = 0.3;

/** Số tiền cọc bắt buộc của đơn COD (0 nếu không phải cọc). */
function depositFor(total, paymentMethod) {
  if (paymentMethod !== 'COD' || !(total >= DEPOSIT_THRESHOLD)) return 0;
  return Math.round((total * DEPOSIT_RATE) / 1000) * 1000;
}

/** Đơn còn chờ khách chuyển cọc (chưa được nhân viên xác nhận đã nhận cọc). */
function awaitingDeposit(order) {
  return (order.depositAmount || 0) > 0 && !order.depositPaidAt;
}

// ================================================================ 2. Cọc đơn đặt làm theo báo giá
// Chính sách đặt cọc cho đơn đặt làm theo báo giá (CUSTOM_QUOTE).
// Các hàm tính tiền ở đây là hàm thuần (không đụng DB) để unit test được; cấu hình đọc từ
// AdminConfig key 'settings' (trang Cài đặt của my-admin), thiếu thì dùng mặc định bên dưới.
// Mọi số tiền là VND dạng số nguyên.

const AdminConfig = require('../models/AdminConfig');

const DEFAULT_DEPOSIT_POLICY = Object.freeze({
  defaultDepositRate: 50, // %
  minimumDepositAmount: 200000,
  quoteValidityDays: 7,
  depositPaymentDeadlineHours: 24,
  allowDepositOverride: true,
});

// Quy tắc cố định theo đặc tả (không cấu hình): làm tròn lên bội số 1.000đ, SLA đối soát 48h,
// được gia hạn tự động 12h một lần sau khi giao dịch bị từ chối / chưa đủ tiền.
const ROUNDING_UNIT = 1000;
const VERIFY_SLA_HOURS = 48;
const AUTO_GRACE_HOURS = 12;
const MAX_STAFF_EXTENSION_HOURS = 72;
const MAX_CUSTOMER_REPORTS = 5;
/** Phiên bản điều khoản cọc — lưu vào đơn để biết khách đã đồng ý bản nào. */
const DEPOSIT_TERMS_VERSION = 'DEPOSIT-2026-11';

function isNonNegativeInt(n) {
  return Number.isInteger(n) && n >= 0;
}

/** Làm tròn lên bội số `unit` (mặc định 1.000đ). */
function roundUpTo(amount, unit = ROUNDING_UNIT) {
  return Math.ceil(amount / unit) * unit;
}

/** Chuẩn hoá cấu hình đọc từ DB: giá trị sai kiểu / ngoài khoảng thì lấy mặc định. */
function normalizePolicy(raw = {}) {
  const D = DEFAULT_DEPOSIT_POLICY;
  /** Số trong khoảng [min, max] (integer nếu yêu cầu), ngược lại lấy mặc định. */
  const numberIn = (key, min, max, integer) => {
    const value = raw[key];
    if (value === undefined || value === null || value === '') return D[key];
    const n = Number(value);
    if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) return D[key];
    return n;
  };
  return {
    defaultDepositRate: numberIn('defaultDepositRate', 1, 100, false),
    minimumDepositAmount: numberIn('minimumDepositAmount', 0, 1_000_000_000, true),
    quoteValidityDays: numberIn('quoteValidityDays', 1, 60, true),
    depositPaymentDeadlineHours: numberIn('depositPaymentDeadlineHours', 1, 168, true),
    allowDepositOverride: typeof raw.allowDepositOverride === 'boolean' ? raw.allowDepositOverride : D.allowDepositOverride,
  };
}

/** Đọc chính sách cọc hiện hành từ Cài đặt. */
async function getDepositPolicy() {
  const doc = await AdminConfig.findOne({ key: 'settings' }, { value: 1 }).lean();
  return normalizePolicy(doc?.value || {});
}

/**
 * Tiền cọc mặc định (phương án B):
 *   min(total, roundUp1000(max(total * rate%, minimum)))
 * total = tiền hàng đặt làm sau chiết khấu, không gồm phí vận chuyển.
 */
function computeDefaultDeposit(total, policy = DEFAULT_DEPOSIT_POLICY) {
  if (!isNonNegativeInt(total)) throw new Error('Tổng tiền phải là số nguyên không âm');
  if (total === 0) return 0;
  const byRate = Math.ceil((total * policy.defaultDepositRate) / 100);
  const raw = Math.max(byRate, policy.minimumDepositAmount);
  return Math.min(total, roundUpTo(raw));
}

/**
 * Tiền cọc của 1 báo giá: mặc định theo chính sách, hoặc mức nhân viên đề xuất (phương án C).
 * Trả về { amount, rate, minimum, overridden, overrideReason } hoặc ném Error (message hiển thị được).
 */
function resolveQuoteDeposit(total, policy, override) {
  const base = {
    rate: policy.defaultDepositRate,
    minimum: policy.minimumDepositAmount,
  };
  if (override && override.amount !== undefined && override.amount !== null && override.amount !== '') {
    if (!policy.allowDepositOverride) throw new Error('Cài đặt hiện không cho phép đổi mức cọc theo báo giá');
    const amount = Number(override.amount);
    const reason = String(override.reason || '').trim();
    if (!Number.isInteger(amount) || amount <= 0) throw new Error('Mức cọc đề xuất phải là số nguyên dương');
    if (amount > total) throw new Error('Mức cọc đề xuất không được lớn hơn tổng tiền báo giá');
    if (reason.length < 5) throw new Error('Vui lòng ghi lý do đổi mức cọc (ít nhất 5 ký tự)');
    return { ...base, amount, overridden: true, overrideReason: reason.slice(0, 300) };
  }
  return { ...base, amount: computeDefaultDeposit(total, policy), overridden: false, overrideReason: '' };
}

/**
 * Chuẩn hoá và tính tiền các hạng mục báo giá. Không tin số tiền client gửi lên: chỉ nhận
 * số lượng, đơn giá, chiết khấu rồi tự tính thành tiền / tổng.
 */
function priceQuoteItems(rawItems, rawQuoteDiscount = 0) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) throw new Error('Báo giá cần ít nhất 1 hạng mục');
  if (rawItems.length > 50) throw new Error('Báo giá tối đa 50 hạng mục');
  const text = (v, max) => String(v ?? '').trim().slice(0, max);
  const items = rawItems.map((raw, index) => {
    const name = text(raw?.name, 200);
    const quantity = Number(raw?.quantity);
    const unitPrice = Number(raw?.unitPrice);
    const discount = raw?.discount === undefined || raw?.discount === '' || raw?.discount === null ? 0 : Number(raw.discount);
    const label = `Hạng mục ${index + 1}`;
    if (!name) throw new Error(`${label}: vui lòng nhập tên hạng mục`);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) throw new Error(`${label}: số lượng phải từ 1 đến 999`);
    if (!isNonNegativeInt(unitPrice) || unitPrice > 2_000_000_000) throw new Error(`${label}: đơn giá phải là số nguyên không âm`);
    const gross = quantity * unitPrice;
    if (!isNonNegativeInt(discount) || discount > gross) throw new Error(`${label}: chiết khấu không hợp lệ`);
    return {
      name,
      description: text(raw?.description, 1000),
      material: text(raw?.material, 200),
      size: text(raw?.size, 200),
      quantity,
      unitPrice,
      discount,
      lineTotal: gross - discount,
    };
  });
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const itemDiscountTotal = items.reduce((s, i) => s + i.discount, 0);
  const quoteDiscount = rawQuoteDiscount === undefined || rawQuoteDiscount === '' || rawQuoteDiscount === null ? 0 : Number(rawQuoteDiscount);
  if (!isNonNegativeInt(quoteDiscount) || quoteDiscount > subtotal - itemDiscountTotal) {
    throw new Error('Chiết khấu toàn báo giá không hợp lệ');
  }
  const total = subtotal - itemDiscountTotal - quoteDiscount;
  if (total <= 0) throw new Error('Tổng tiền báo giá phải lớn hơn 0');
  return { items, subtotal, itemDiscountTotal, quoteDiscount, total };
}

module.exports = {
  // Cọc COD đơn lớn
  DEPOSIT_THRESHOLD, DEPOSIT_RATE, depositFor, awaitingDeposit,
  // Cọc đơn đặt làm
  DEFAULT_DEPOSIT_POLICY,
  ROUNDING_UNIT,
  VERIFY_SLA_HOURS,
  AUTO_GRACE_HOURS,
  MAX_STAFF_EXTENSION_HOURS,
  MAX_CUSTOMER_REPORTS,
  DEPOSIT_TERMS_VERSION,
  roundUpTo,
  normalizePolicy,
  getDepositPolicy,
  computeDefaultDeposit,
  resolveQuoteDeposit,
  priceQuoteItems,
};
