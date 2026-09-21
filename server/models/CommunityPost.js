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
});

module.exports = mongoose.model('CommunityPost', communityPostSchema);
