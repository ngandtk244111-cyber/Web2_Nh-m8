const mongoose = require('mongoose');

// Sổ giao dịch thanh toán chuyển khoản cần đối soát thủ công (hiện dùng cho tiền cọc đơn đặt làm).
// Không sửa / xoá dòng đã có: khách báo chuyển -> REPORTED; nhân viên đối soát sao kê -> CONFIRMED
// (kèm số tiền thực nhận + mã giao dịch ngân hàng) hoặc REJECTED (bắt buộc lý do).
// Tổng tiền đã nhận của 1 đơn luôn tính lại từ các dòng CONFIRMED, không cộng dồn tay.

const paymentTransactionSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true, index: true },
  purpose: { type: String, enum: ['DEPOSIT', 'BALANCE', 'FULL'], default: 'DEPOSIT' },
  // INITIATED / FAILED: lượt trả qua cổng MoMo / ZaloPay (chưa / không thành công) — không tính vào tiền đã nhận.
  status: { type: String, enum: ['REPORTED', 'CONFIRMED', 'REJECTED', 'INITIATED', 'FAILED'], required: true },
  source: { type: String, enum: ['CUSTOMER', 'STAFF', 'GATEWAY'], required: true },

  // Trả qua cổng: mã giao dịch phía shop gửi sang cổng (orderId MoMo / app_trans_id ZaloPay), số tiền server
  // yêu cầu cổng thu, và cờ giao dịch thử (cổng sandbox / trang thanh toán thử) — không phải tiền thật.
  gateway: { type: String, enum: ['MOMO', 'ATM', 'ZALOPAY', null], default: null },
  gatewayRef: { type: String, default: null },
  expectedAmount: { type: Number, default: null },
  sandbox: { type: Boolean, default: false },
  failReason: { type: String, default: '' },

  // Khách báo: số tiền khách nói đã chuyển + ghi chú (vd. mã giao dịch trên app ngân hàng).
  reportedAmount: { type: Number, default: null },
  reportedNote: { type: String, default: '' },
  reportedAt: { type: Date, default: null },
  reporterUserId: { type: String, default: null },

  // Nhân viên đối soát.
  receivedAmount: { type: Number, default: null },
  // Mã giao dịch trên sao kê ngân hàng (chuẩn hoá in hoa, bỏ khoảng trắng). Một mã chỉ được xác nhận 1 lần
  // trên toàn hệ thống — unique index bên dưới chặn cả khi 2 nhân viên bấm cùng lúc.
  bankTxnRef: { type: String, default: null },
  receivedAt: { type: Date, default: null },
  verifiedBy: { type: String, default: null },
  verifiedByName: { type: String, default: '' },
  verifiedAt: { type: Date, default: null },
  rejectReason: { type: String, default: '' },
  staffNote: { type: String, default: '' },
}, {
  timestamps: true,
  toJSON: {
    transform(_doc, ret) {
      delete ret.verifiedBy;
      delete ret.reporterUserId;
      return ret;
    },
  },
});

paymentTransactionSchema.index(
  { bankTxnRef: 1 },
  { unique: true, partialFilterExpression: { status: 'CONFIRMED', bankTxnRef: { $type: 'string' } } },
);

paymentTransactionSchema.index(
  { gatewayRef: 1 },
  { unique: true, partialFilterExpression: { gatewayRef: { $type: 'string' } } },
);

/** Chuẩn hoá mã giao dịch ngân hàng để so trùng: in hoa, bỏ khoảng trắng. */
paymentTransactionSchema.statics.normalizeRef = function (ref) {
  return String(ref || '').replace(/\s+/g, '').toUpperCase().slice(0, 100);
};

module.exports = mongoose.model('PaymentTransaction', paymentTransactionSchema);
