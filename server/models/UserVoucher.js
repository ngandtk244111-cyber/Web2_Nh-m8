const mongoose = require('mongoose');

/**
 * Voucher cá nhân của khách (thay cho Xu Luméa): nhận từ trò chơi, hoàn thiện hồ sơ, đánh giá...
 * Mỗi voucher là 1 mã riêng, dùng 1 lần, có hạn sử dụng. Khác Coupon (mã công khai ai cũng nhập được).
 */
const userVoucherSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  /** Giảm theo % (kèm maxDiscount) hoặc giảm thẳng số tiền — chỉ dùng 1 trong 2. */
  discountPercent: { type: Number, default: 0, min: 0, max: 100 },
  discountAmount: { type: Number, default: 0, min: 0 },
  maxDiscount: { type: Number, default: 0, min: 0 },
  minSpend: { type: Number, default: 0, min: 0 },
  /** Nguồn nhận voucher, vd 'GAME_WHEEL', 'PROFILE_COMPLETE'. */
  source: { type: String, required: true },
  /** Khoá idempotent theo (user, source): cùng refId không phát voucher lần 2. */
  refId: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  usedAt: { type: Date, default: null },
  usedOrderNumber: { type: String, default: null },
}, { timestamps: true });

userVoucherSchema.index({ user: 1, source: 1, refId: 1 }, { unique: true });

module.exports = mongoose.model('UserVoucher', userVoucherSchema);
