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
  // Tin do trợ lý tự động gửi (sender 'staff', không có staffId) kèm các nút dẫn tới trang liên quan.
  auto: { type: Boolean, default: false },
  links: { type: [{ label: String, url: String, _id: false }], default: undefined },
}, { timestamps: true });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
