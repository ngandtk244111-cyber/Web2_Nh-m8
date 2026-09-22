const mongoose = require('mongoose');

// Tài khoản quản trị my-admin — tách collection riêng với User (khách hàng) vì admin không có
// các field liên quan mua sắm (coins, addresses...). Đăng nhập bằng username + password, cùng
// cơ chế bcrypt như User.js, không dùng token — nhất quán với mô hình auth "tin userId client
// gửi lên" mà toàn bộ Lam-a-main đang dùng (tham khảo VitaCare-main).
const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  fullName: { type: String, default: '' },
  active: { type: Boolean, default: true },
  lastLogin: { type: Date, default: null },
}, {
  timestamps: true,
  toJSON: {
    transform(_doc, ret) {
      delete ret.password;
      return ret;
    },
  },
});

module.exports = mongoose.model('Admin', adminSchema);
