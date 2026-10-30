const crypto = require('crypto');
const UserVoucher = require('../models/UserVoucher');
const Coupon = require('../models/Coupon');
const CouponUsage = require('../models/CouponUsage');

const DAY_MS = 24 * 60 * 60 * 1000;
/** Voucher nhận được có hiệu lực 30 ngày. */
const VOUCHER_TTL_DAYS = 30;

/**
 * Các mệnh giá voucher — server quyết định, không tin giá trị client gửi lên.
 * label: chữ ngắn hiển thị trên vòng quay / hộp quà.
 */
const VOUCHER_TIERS = {
  V10K: { label: '10K', title: 'Giảm 10.000đ', discountAmount: 10000, minSpend: 99000 },
  V20K: { label: '20K', title: 'Giảm 20.000đ', discountAmount: 20000, minSpend: 199000 },
  V50K: { label: '50K', title: 'Giảm 50.000đ', discountAmount: 50000, minSpend: 499000 },
  V100K: { label: '100K', title: 'Giảm 100.000đ', discountAmount: 100000, minSpend: 999000 },
  P5: { label: '5%', title: 'Giảm 5%', discountPercent: 5, maxDiscount: 50000, minSpend: 0 },
  P8: { label: '8%', title: 'Giảm 8%', discountPercent: 8, maxDiscount: 80000, minSpend: 200000 },
  P10: { label: '10%', title: 'Giảm 10%', discountPercent: 10, maxDiscount: 100000, minSpend: 300000 },
  P15: { label: '15%', title: 'Giảm 15%', discountPercent: 15, maxDiscount: 150000, minSpend: 300000 },
};

function tierDescription(tier) {
  const min = tier.minSpend ? `Đơn từ ${tier.minSpend.toLocaleString('vi-VN')}đ` : 'Mọi đơn hàng';
  const cap = tier.discountPercent ? ` · Tối đa ${tier.maxDiscount.toLocaleString('vi-VN')}đ` : '';
  return min + cap;
}

function generateCode() {
  return 'LM' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

/**
 * Phát 1 voucher cho user. Idempotent theo (user, source, refId) — gọi lại trả về null, không phải lỗi.
 */
async function awardVoucher({ userId, tierKey, source, refId, note }) {
  const tier = VOUCHER_TIERS[tierKey];
  if (!userId || !tier || !source || !refId) return null;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await UserVoucher.create({
        user: userId,
        code: generateCode(),
        title: tier.title,
        description: note ? `${note} · ${tierDescription(tier)}` : tierDescription(tier),
        discountPercent: tier.discountPercent || 0,
        discountAmount: tier.discountAmount || 0,
        maxDiscount: tier.maxDiscount || tier.discountAmount || 0,
        minSpend: tier.minSpend || 0,
        source,
        refId: String(refId),
        expiresAt: new Date(Date.now() + VOUCHER_TTL_DAYS * DAY_MS),
      });
    } catch (err) {
      if (err.code !== 11000) throw err;
      if (err.keyPattern?.code) continue; // trùng mã ngẫu nhiên — sinh mã khác
      return null; // đã phát cho (user, source, refId) này rồi
    }
  }
  return null;
}

/** Số tiền giảm của 1 voucher/coupon cho subtotal — 0 nếu chưa đủ điều kiện. */
function voucherDiscount(v, subtotal) {
  if (!v || subtotal < (v.minSpend || 0)) return 0;
  if (v.discountAmount) return Math.min(v.discountAmount, subtotal);
  const calc = Math.round((subtotal * (v.discountPercent || 0)) / 100);
  return v.maxDiscount ? Math.min(calc, v.maxDiscount) : calc;
}

/** Voucher cá nhân còn dùng được (chưa dùng, chưa hết hạn) của user theo mã. */
function findUsableVoucher(userId, code) {
  if (!userId || !code) return null;
  return UserVoucher.findOne({
    user: userId,
    code: String(code).trim().toUpperCase(),
    usedAt: null,
    expiresAt: { $gt: new Date() },
  }).lean();
}

/** Chủ sở hữu lượt dùng mã công khai: tài khoản, hoặc số điện thoại nếu khách không đăng nhập. */
function couponOwner(userId, phone) {
  if (userId) return String(userId);
  const digits = String(phone || '').replace(/\D/g, '');
  return digits ? `phone:${digits}` : null;
}

class VoucherError extends Error {}

/**
 * QUY TẮC: mỗi mã chỉ dùng được 1 lần — dùng rồi là hết mã.
 * - Voucher cá nhân: đánh dấu usedAt ngay (điều kiện usedAt: null nên 2 đơn đặt cùng lúc không dùng trùng được).
 * - Mã công khai của shop: mỗi khách (tài khoản hoặc SĐT) dùng 1 lần, ghi vào CouponUsage (unique).
 * Giữ chỗ mã TRƯỚC khi tạo đơn; tạo đơn lỗi thì gọi release(), tạo xong thì attach(orderNumber).
 * Mã không hợp lệ / đã dùng / chưa đủ giá trị tối thiểu -> ném VoucherError (thông điệp tiếng Việt).
 */
async function reserveDiscountCode({ code, userId, phone, subtotal }) {
  const none = { discount: 0, release: async () => {}, attach: async () => {} };
  const clean = String(code || '').trim().toUpperCase();
  if (!clean) return none;

  const coupon = await Coupon.findOne({ code: clean, active: true }).lean();
  if (coupon) {
    if (subtotal < (coupon.minSpend || 0)) {
      throw new VoucherError(`Mã ${clean} chỉ áp dụng cho đơn từ ${coupon.minSpend.toLocaleString('vi-VN')}đ.`);
    }
    const owner = couponOwner(userId, phone);
    if (!owner) throw new VoucherError('Vui lòng nhập số điện thoại để dùng mã giảm giá.');
    let usage;
    try {
      usage = await CouponUsage.create({ code: clean, owner });
    } catch (err) {
      if (err.code === 11000) throw new VoucherError(`Bạn đã dùng mã ${clean} rồi — mỗi mã chỉ dùng được 1 lần.`);
      throw err;
    }
    return {
      discount: voucherDiscount(coupon, subtotal),
      release: () => CouponUsage.deleteOne({ _id: usage._id }),
      attach: (orderNumber) => CouponUsage.updateOne({ _id: usage._id }, { orderNumber }),
    };
  }

  if (!userId) throw new VoucherError('Mã giảm giá không hợp lệ hoặc đã hết hạn.');
  const voucher = await UserVoucher.findOne({ user: userId, code: clean }).lean();
  if (!voucher) throw new VoucherError('Mã giảm giá không hợp lệ hoặc đã hết hạn.');
  if (voucher.usedAt) throw new VoucherError(`Voucher ${clean} đã được dùng rồi.`);
  if (new Date(voucher.expiresAt) <= new Date()) throw new VoucherError(`Voucher ${clean} đã hết hạn.`);
  if (subtotal < (voucher.minSpend || 0)) {
    throw new VoucherError(`Voucher ${clean} chỉ áp dụng cho đơn từ ${voucher.minSpend.toLocaleString('vi-VN')}đ.`);
  }
  const locked = await UserVoucher.findOneAndUpdate(
    { _id: voucher._id, usedAt: null },
    { usedAt: new Date() },
    { new: true }
  );
  if (!locked) throw new VoucherError(`Voucher ${clean} đã được dùng rồi.`);
  return {
    discount: voucherDiscount(voucher, subtotal),
    release: () => UserVoucher.updateOne({ _id: voucher._id }, { usedAt: null, usedOrderNumber: null }),
    attach: (orderNumber) => UserVoucher.updateOne({ _id: voucher._id }, { usedOrderNumber: orderNumber }),
  };
}

/** Đơn bị huỷ: trả lại mã đã dùng cho đơn đó (voucher còn hạn thì khách dùng lại được). */
async function releaseCodesForOrder(orderNumber) {
  await UserVoucher.updateMany({ usedOrderNumber: orderNumber }, { usedAt: null, usedOrderNumber: null });
  await CouponUsage.deleteMany({ orderNumber });
}

/** Mã công khai khách đã dùng (để ẩn khỏi danh sách chọn voucher). */
async function usedCouponCodes(userId) {
  const owner = couponOwner(userId);
  if (!owner) return [];
  return (await CouponUsage.find({ owner }).select('code').lean()).map(u => u.code);
}

module.exports = {
  VOUCHER_TIERS, VOUCHER_TTL_DAYS, awardVoucher, voucherDiscount, findUsableVoucher, tierDescription,
  reserveDiscountCode, releaseCodesForOrder, usedCouponCodes, VoucherError,
};
