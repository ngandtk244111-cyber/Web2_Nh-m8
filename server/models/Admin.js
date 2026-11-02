const mongoose = require('mongoose');

// Tài khoản quản trị my-admin — tách collection riêng với User (khách hàng) vì admin không có
// các field liên quan mua sắm (coins, addresses...). Đăng nhập bằng username + password (bcrypt),
// các request sau dùng token do server ký — xem middleware/auth.js.
const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  fullName: { type: String, default: '' },
  code: { type: String, default: '' },
  email: { type: String, default: '' },
  phone: { type: String, default: '' },
  department: { type: String, default: '' },
  role: { type: String, default: '' },
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
