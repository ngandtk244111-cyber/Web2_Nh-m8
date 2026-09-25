const mongoose = require('mongoose');

// Video chủ đề hiển thị ở mục "video" trang chủ my-client (carousel + viewer dạng reels).
// Chỉ nhân viên đăng/sửa qua my-admin; client chỉ đọc các video đang bật (active).
const videoSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  youtubeId: { type: String, required: true },
  poster: { type: String, default: '' },
  link: { type: String, default: '' },
  ctaLabel: { type: String, default: 'Xem thêm' },
  active: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
  createdBy: { type: String, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Video', videoSchema);
