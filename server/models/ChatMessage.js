const mongoose = require('mongoose');

// Mỗi cuộc chat hỗ trợ = một sessionId (sinh theo trình duyệt ở my-client). Thông tin khách
// (userId/tên/SĐT) chỉ có khi khách đã đăng nhập lúc gửi tin; khách vãng lai để trống.
const chatMessageSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, index: true },
  sender: { type: String, enum: ['customer', 'staff'], required: true },
  text: { type: String, required: true },
  userId: { type: String, default: null },
  customerName: { type: String, default: null },
  customerPhone: { type: String, default: null },
  staffId: { type: String, default: null },
  // Tin của khách mà nhân viên chưa mở xem — dùng đếm "chưa đọc" trong my-admin.
  readByStaff: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
