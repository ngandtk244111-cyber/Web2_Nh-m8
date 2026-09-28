const mongoose = require('mongoose');

// Lịch sử trò chuyện với trợ lý AI Goh của khách đã đăng nhập (khách vãng lai lưu ở localStorage).
// `id` do client sinh để tin nhắn đầu tiên lưu được ngay, không chờ server cấp. `messages` giữ
// nguyên hình dạng AiChatMessage phía FE (ai-assistant.service.ts), kể cả thẻ sản phẩm gợi ý.
const aiConversationSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, default: 'Cuộc trò chuyện mới' },
  messages: { type: [mongoose.Schema.Types.Mixed], default: [] },
  brief: { type: mongoose.Schema.Types.Mixed, default: null },
  conceptImage: { type: String, default: null },
}, { timestamps: true });

module.exports = mongoose.model('AiConversation', aiConversationSchema);
