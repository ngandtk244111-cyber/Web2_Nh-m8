const mongoose = require('mongoose');

// Mã giảm giá — khớp interface Coupon (cart.model.ts) phía frontend.
const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  description: { type: String, default: '' },
  discountPercent: { type: Number, required: true, min: 0, max: 100 },
  maxDiscount: { type: Number, required: true, min: 0 },
  minSpend: { type: Number, default: 0, min: 0 },
  active: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Coupon', couponSchema);
