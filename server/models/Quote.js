const mongoose = require('mongoose');

// Báo giá có phiên bản cho 1 yêu cầu đặt làm (CustomRequest). Mỗi lần đổi giá / nội dung sau khi
// đã gửi khách là 1 phiên bản mới; bản cũ chuyển SUPERSEDED. Báo giá đã gửi (SENT) trở đi không sửa
// trực tiếp — chỉ DRAFT mới sửa được. Giá, tiền cọc và chính sách cọc được chụp lại lúc gửi khách để
// đổi Cài đặt sau này không làm thay đổi báo giá / đơn cũ.
//
// DRAFT -> SENT -> ACCEPTED | REJECTED | EXPIRED | SUPERSEDED

const quoteItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: '' },
  material: { type: String, default: '' },
  size: { type: String, default: '' },
  quantity: { type: Number, required: true },
  unitPrice: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  lineTotal: { type: Number, required: true },
}, { _id: false });

const quoteSchema = new mongoose.Schema({
  customRequestId: { type: String, required: true }, // CustomRequest.id
  requestCode: { type: String, required: true },
  version: { type: Number, required: true },
  status: {
    type: String,
    enum: ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'SUPERSEDED'],
    default: 'DRAFT',
  },
  items: { type: [quoteItemSchema], default: [] },
  subtotal: { type: Number, required: true },
  itemDiscountTotal: { type: Number, default: 0 },
  quoteDiscount: { type: Number, default: 0 },
  total: { type: Number, required: true },
  estimatedDays: { type: Number, required: true },
  note: { type: String, default: '' },

  // Đề xuất đổi mức cọc của nhân viên (phương án C) — áp dụng khi gửi báo giá.
  depositOverride: {
    type: new mongoose.Schema({ amount: Number, reason: String }, { _id: false }),
    default: null,
  },
  // Chụp lúc gửi khách (SENT): tiền cọc, phần còn lại (chưa gồm phí ship) và chính sách áp dụng.
  deposit: {
    type: new mongoose.Schema({
      amount: Number,
      remaining: Number,
      rate: Number,
      minimum: Number,
      overridden: Boolean,
      overrideReason: String,
    }, { _id: false }),
    default: null,
  },
  policySnapshot: { type: mongoose.Schema.Types.Mixed, default: null },

  issuedAt: { type: Date, default: null },
  validUntil: { type: Date, default: null },
  acceptedAt: { type: Date, default: null },
  acceptedByUserId: { type: String, default: null },
  acceptedTermsVersion: { type: String, default: '' },
  rejectedAt: { type: Date, default: null },
  rejectReason: { type: String, default: '' },
  supersededAt: { type: Date, default: null },
  expiredAt: { type: Date, default: null },

  createdBy: { type: String, default: '' },
  createdByName: { type: String, default: '' },
  sentBy: { type: String, default: '' },
  sentByName: { type: String, default: '' },
}, {
  timestamps: true,
  toJSON: {
    transform(_doc, ret) {
      delete ret.createdBy;
      delete ret.sentBy;
      return ret;
    },
  },
});

quoteSchema.index({ customRequestId: 1, version: 1 }, { unique: true });
quoteSchema.index({ customRequestId: 1, status: 1 });

/** Báo giá đã gửi nhưng quá hạn (theo giờ server) — chưa cần ghi DB vẫn coi như hết hạn. */
quoteSchema.methods.isExpiredAt = function (now = new Date()) {
  return this.status === 'SENT' && !!this.validUntil && this.validUntil.getTime() <= now.getTime();
};

module.exports = mongoose.model('Quote', quoteSchema);
