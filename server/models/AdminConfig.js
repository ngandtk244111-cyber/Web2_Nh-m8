const mongoose = require('mongoose');

// Cấu hình my-admin lưu theo khóa (danh mục, nhà cung cấp, banner, cài đặt, phân quyền). Mỗi khóa
// là 1 document, ghi đè toàn bộ `value` mỗi lần lưu — xem routes/adminRoutes.js.
const adminConfigSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
  updatedBy: { type: String, default: null },
}, { timestamps: true, minimize: false });

module.exports = mongoose.model('AdminConfig', adminConfigSchema);
