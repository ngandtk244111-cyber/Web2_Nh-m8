const mongoose = require('mongoose');

const warrantySchema = new mongoose.Schema({
  warrantyCode: { type: String, required: true, unique: true },
  orderNumber: { type: String, required: true },
  // id của món trong order.items — phiếu tự cấp khi giao hàng (xem utils/warranty.js); phiếu tạo tay có thể trống.
  itemId: { type: String, default: null },
  productName: { type: String, required: true },
  productImage: { type: String, default: '' },
  customerName: { type: String, required: true },
  customerPhone: { type: String, required: true },
  purchasedAt: { type: Date, required: true },
  warrantyMonths: { type: Number, default: 12 },
  status: { type: String, enum: ['ACTIVE', 'CLAIMED', 'EXPIRED'], default: 'ACTIVE' },
  claimHistory: [{
    note: String,
    createdAt: { type: Date, default: Date.now },
  }],
  /** Ghi chú nội bộ của nhân viên (kể cả nhật ký gia hạn) — không trả về cho khách khi tra cứu. */
  adminNotes: [{
    note: String,
    author: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

warrantySchema.virtual('expiresAt').get(function () {
  const d = new Date(this.purchasedAt);
  d.setMonth(d.getMonth() + this.warrantyMonths);
  return d;
});

warrantySchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Warranty', warrantySchema);
