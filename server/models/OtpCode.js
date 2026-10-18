const mongoose = require('mongoose');

// Mã OTP gửi tới SĐT (SMS) hoặc email — mỗi document chỉ có 1 trong 2 field phoneNumber/email.
const otpCodeSchema = new mongoose.Schema({
  phoneNumber: { type: String, index: true, default: null },
  email: { type: String, index: true, default: null },
  code: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  consumed: { type: Boolean, default: false },
}, { timestamps: true });

// Auto-delete expired OTP documents.
otpCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('OtpCode', otpCodeSchema);
