const mongoose = require('mongoose');

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
  // unique + sparse: tài khoản email/Google/Facebook có thể không có SĐT (và ngược lại)
  phoneNumber: { type: String, unique: true, sparse: true },
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

// Dữ liệu cũ
userSchema.statics.unsetNullLoginIds = async function unsetNullLoginIds() {
  for (const field of LOGIN_ID_FIELDS) {
    await this.updateMany({ [field]: { $type: 'null' } }, { $unset: { [field]: 1 } });
  }
};

module.exports = mongoose.model('User', userSchema);
