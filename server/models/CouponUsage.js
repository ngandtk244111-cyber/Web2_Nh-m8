const mongoose = require('mongoose');

/** Lượt dùng mã công khai (Coupon) */
const couponUsageSchema = new mongoose.Schema({
  code: { type: String, required: true, uppercase: true, trim: true },
  owner: { type: String, required: true },
  orderNumber: { type: String, default: null },
}, { timestamps: true });

couponUsageSchema.index({ code: 1, owner: 1 }, { unique: true });

module.exports = mongoose.model('CouponUsage', couponUsageSchema);
