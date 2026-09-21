const mongoose = require('mongoose');

// Sổ địa chỉ giao hàng — subdocument nhúng thẳng trong User (tham khảo AuraPC-main:
// server/routes/authRoutes.js phần "ADDRESS BOOK"), không tách collection riêng vì
// địa chỉ luôn thuộc về đúng 1 user, không cần query độc lập.
const addressSchema = new mongoose.Schema({
  label: { type: String, default: 'Nhà riêng' },
  fullName: { type: String, required: true },
  phone: { type: String, required: true },
  city: { type: String, default: '' },
  district: { type: String, default: '' },
  ward: { type: String, default: '' },
  address: { type: String, default: '' },
  isDefault: { type: Boolean, default: false },
});

const userSchema = new mongoose.Schema({
  // sparse: cho phép tạm thời chưa có SĐT (tài khoản mới đăng nhập Google/Facebook, chưa gắn SĐT) —
  // route /register vẫn tự bắt buộc SĐT ở tầng application, chỉ nới ở tầng schema.
  phoneNumber: { type: String, unique: true, sparse: true, default: null },
  // Băm bằng bcrypt — không lưu plain text. Đăng nhập bằng SĐT + mật khẩu (tham khảo VitaCare-main),
  // không còn OTP-login/JWT. Tài khoản Google/Facebook không có password.
  password: { type: String, default: null },
  googleId: { type: String, unique: true, sparse: true, default: null },
  facebookId: { type: String, unique: true, sparse: true, default: null },
  fullName: { type: String, default: '' },
  email: { type: String, default: '' },
  gender: { type: String, enum: ['male', 'female', 'other', ''], default: '' },
  dateOfBirth: { type: String, default: '' },
  address: { type: mongoose.Schema.Types.Mixed, default: null },
  addresses: { type: [addressSchema], default: [] },
  avatar: { type: String, default: '' },
  active: { type: Boolean, default: true },
  lastLogin: { type: Date, default: null },
  coins: { type: Number, default: 0 },
}, {
  timestamps: true,
  // Không bao giờ trả password về client, kể cả vô tình join/log nguyên document.
  toJSON: {
    transform(_doc, ret) {
      delete ret.password;
      return ret;
    },
  },
});

module.exports = mongoose.model('User', userSchema);
