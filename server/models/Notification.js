const mongoose = require('mongoose');

// userId = null nghĩa là thông báo chung (mọi người xem được, kể cả khách chưa đăng nhập).
// visibleAt: thông báo hẹn giờ — chỉ hiện trong danh sách khi thời điểm này đã tới (null = hiện ngay).
// refKey: khóa tham chiếu (vd "flash-sale:2026-09-25") để tìm/hủy đúng nhắc hẹn của 1 user.
const notificationSchema = new mongoose.Schema({
  userId: { type: String, default: null },
  title: { type: String, required: true },
  message: { type: String, required: true },
  link: { type: String, default: null },
  read: { type: Boolean, default: false },
  visibleAt: { type: Date, default: null },
  refKey: { type: String, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
