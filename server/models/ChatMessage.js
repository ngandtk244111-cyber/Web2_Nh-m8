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
}, {
  timestamps: true,
  // Lịch sử chat đọc được chỉ bằng sessionId — không gửi id nhân viên ra ngoài (xem middleware/auth.js).
  toJSON: {
    transform(_doc, ret) {
      delete ret.staffId;
      return ret;
    },
  },
});

chatMessageSchema.post('save', async function (message) {
  if (message.sender !== 'staff' || message.auto) return;
  try {
    const customer = await this.constructor.findOne({ sessionId: message.sessionId, sender: 'customer', userId: { $ne: null } }).sort({ createdAt: -1 }).lean();
    if (customer?.userId) await require('./Notification').notifyUser(customer.userId, {
      title: 'Luméa đã trả lời tin nhắn hỗ trợ', message: message.text,
      link: '/notifications', refKey: 'support-chat:' + message._id,
    });
  } catch (err) { console.error('Support reply notification error', err.message); }
});

chatMessageSchema.index({ sessionId: 1, createdAt: 1 });
chatMessageSchema.index({ userId: 1, sessionId: 1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
