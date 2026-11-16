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
  // CLAIMED = khách vừa gửi yêu cầu, chờ tiếp nhận; PROCESSING = shop đã tiếp nhận, đang liên hệ / xử lý.
  status: { type: String, enum: ['ACTIVE', 'CLAIMED', 'PROCESSING', 'EXPIRED'], default: 'ACTIVE' },
  claimHistory: [{
    note: String,
    /** Ai viết dòng này (dòng cũ trước khi có trường này để trống). */
    by: { type: String, enum: ['CUSTOMER', 'STAFF', null], default: null },
    /** Ảnh khách chụp tình trạng sản phẩm khi gửi yêu cầu. */
    images: { type: [String], default: [] },
    /** Kết quả khi shop đóng yêu cầu. */
    result: { type: String, enum: ['REPAIR', 'REPRINT', 'REPLACE', 'REJECTED', null], default: null },
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
