const mongoose = require('mongoose');

// userId = null nghĩa là thông báo chung (mọi người xem được, kể cả khách chưa đăng nhập).
const notificationSchema = new mongoose.Schema({
  userId: { type: String, default: null },
  title: { type: String, required: true },
  message: { type: String, required: true },
  link: { type: String, default: null },
  read: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
