const mongoose = require('mongoose');

/**
 * Lượt dùng mã công khai (Coupon) — mỗi khách chỉ dùng 1 mã đúng 1 lần.
 * owner = userId (đã đăng nhập) hoặc "phone:<sđt>" (khách vãng lai) để khách không đăng nhập
 * cũng không dùng lại được mã bằng cách đặt đơn mới.
 */
const couponUsageSchema = new mongoose.Schema({
  code: { type: String, required: true, uppercase: true, trim: true },
  owner: { type: String, required: true },
  orderNumber: { type: String, default: null },
}, { timestamps: true });

couponUsageSchema.index({ code: 1, owner: 1 }, { unique: true });

module.exports = mongoose.model('CouponUsage', couponUsageSchema);
