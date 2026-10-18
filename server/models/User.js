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
  // unique + sparse: tài khoản email/Google/Facebook có thể không có SĐT (và ngược lại). KHÔNG đặt
  // default: null cho 3 field phoneNumber/googleId/facebookId — sparse index vẫn đánh index giá trị
  // null lưu tường minh, nên chỉ cho tồn tại đúng 1 user thiếu field đó (lỗi E11000 khi đăng ký).
  phoneNumber: { type: String, unique: true, sparse: true },
  // Băm bằng bcrypt — không lưu plain text. Đăng nhập bằng SĐT + mật khẩu (tham khảo VitaCare-main),
  // không còn OTP-login/JWT. Tài khoản Google/Facebook không có password.
  password: { type: String, default: null },
  googleId: { type: String, unique: true, sparse: true },
  facebookId: { type: String, unique: true, sparse: true },
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

const LOGIN_ID_FIELDS = ['phoneNumber', 'googleId', 'facebookId'];

// Dữ liệu cũ (tạo khi schema còn default: null) có thể đang lưu null tường minh ở các field trên,
// chiếm mất "suất null" duy nhất của sparse unique index -> gỡ field đó đi. Idempotent, gọi mỗi
// lần server khởi động (xem index.js), không cần chạy migration tay trên từng database.
userSchema.statics.unsetNullLoginIds = async function unsetNullLoginIds() {
  for (const field of LOGIN_ID_FIELDS) {
    await this.updateMany({ [field]: { $type: 'null' } }, { $unset: { [field]: 1 } });
  }
};

module.exports = mongoose.model('User', userSchema);
