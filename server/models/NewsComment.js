const mongoose = require('mongoose');

// Ý kiến bạn đọc dưới bài Tin tức. Lưu thành collection riêng (không nhúng vào NewsArticle như
// comments của CommunityPost) để trả lời lồng 1 cấp (parentId) và đếm like từng ý kiến dễ hơn.
const newsCommentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  articleId: { type: String, required: true, index: true },
  parentId: { type: String, default: null },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  authorName: { type: String, required: true },
  text: { type: String, required: true },
  likesCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('NewsComment', newsCommentSchema);
