const mongoose = require('mongoose');

// Mã giảm giá — khớp interface Coupon (cart.model.ts) phía frontend.
const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  description: { type: String, default: '' },
  discountPercent: { type: Number, required: true, min: 0, max: 100 },
  maxDiscount: { type: Number, required: true, min: 0 },
  minSpend: { type: Number, default: 0, min: 0 },
  // 0 = không giới hạn tổng số lượt dùng; endDate null = không hết hạn.
  limitCount: { type: Number, default: 0, min: 0 },
  endDate: { type: Date, default: null },
  active: { type: Boolean, default: true },
  /** Hạn dùng — trống thì coi như hết hạn cuối tháng hiện tại (hiển thị), hết hạn thì không dùng được. */
  expiresAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Coupon', couponSchema);
