const mongoose = require('mongoose');

const communityPostSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  author: { type: mongoose.Schema.Types.Mixed, required: true },
  title: { type: String, required: true },
  caption: { type: String, default: '' },
  imageUrl: { type: String, required: true },
  tags: { type: [String], default: [] },
  productTags: { type: [mongoose.Schema.Types.Mixed], default: [] },
  likesCount: { type: Number, default: 0 },
  commentsCount: { type: Number, default: 0 },
  comments: { type: [mongoose.Schema.Types.Mixed], default: [] },
  createdAt: { type: String, default: '' },
  // Thời điểm đăng thật (createdAt ở trên là nhãn hiển thị kiểu "Vừa xong"). Bài cũ chưa có
  // trường này thì route admin suy ra từ _id.
  postedAt: { type: Date, default: Date.now },
  // Kiểm duyệt: PUBLISHED hiện công khai; HIDDEN do nhân viên ẩn; REJECTED bị bộ lọc tự động chặn
  // ngay lúc đăng vì vi phạm tiêu chuẩn cộng đồng. HIDDEN/REJECTED không hiện ở my-client.
  status: { type: String, enum: ['PUBLISHED', 'HIDDEN', 'REJECTED'], default: 'PUBLISHED' },
  moderationReason: { type: String, default: '' },
  moderatedBy: { type: String, default: null },
  moderatedAt: { type: Date, default: null },
  isStaffPick: { type: Boolean, default: false },
});

module.exports = mongoose.model('CommunityPost', communityPostSchema);
